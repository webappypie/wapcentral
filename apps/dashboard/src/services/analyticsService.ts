import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isOfflineMode, isTestEnv } from '../lib/firestore.js';
import { auth } from '../lib/firebase.js';
import { COLLECTIONS } from '@wapcentral/config';
import type {
  UsageEvent,
  CostAlertRule,
  CostAlertTrigger,
  DataRetentionPolicy,
  UsageAggregationSummary,
  CampaignPerformance,
  Campaign,
  PromotionEvent,
} from '@wapcentral/types';
import {
  CreateCostAlertRuleSchema,
  DataRetentionPolicySchema,
  type CreateCostAlertRuleInput,
  type DataRetentionPolicyInput,
} from '@wapcentral/validation';
import {
  aggregateUsageBreakdowns,
  evaluateCostAlerts,
  aggregateCampaignPerformance,
  pruneExpiredEvents,
} from '@wapcentral/workers';
import { recordAuditLog } from './auditService.js';

// ============================================================
// Unit Test In-Memory Fixtures (Active ONLY when isOfflineMode || isTestEnv)
// ============================================================

function createDefaultTestUsageEvents(): UsageEvent[] {
  const events: UsageEvent[] = [];
  const providers = ['gemini', 'openai', 'anthropic'];
  const apps = ['app_01', 'app_02', 'app_03'];
  const features = ['chat_assistant', 'image_analysis', 'semantic_search'];
  const baseTime = new Date('2026-09-30T12:00:00Z').getTime();

  for (let i = 0; i < 30; i++) {
    const dayDate = new Date(baseTime - i * 24 * 60 * 60 * 1000);
    const dayStr = dayDate.toISOString().split('T')[0]!;
    for (let c = 0; c < 3; c++) {
      const provider = providers[(i + c) % providers.length]!;
      const app = apps[(i + c) % apps.length]!;
      const feature = features[c % features.length]!;
      const input = 200 + c * 100;
      const output = 100 + c * 50;
      events.push({
        id: `test_evt_${dayStr}_${c}`,
        appId: app,
        providerId: provider,
        modelId: provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet',
        feature,
        requestId: `test_req_${dayStr}_${c}`,
        inputTokens: input,
        outputTokens: output,
        costEstimateUsd: Number((((input + output) / 1000) * 0.001).toFixed(5)),
        latencyMs: 150 + c * 50,
        success: true,
        timestamp: `${dayStr}T10:00:00Z`,
      });
    }
  }
  return events;
}

const defaultTestCampaigns: Campaign[] = [
  {
    id: 'camp_01',
    name: 'Reader Spring Promo',
    promotedAppId: 'app_01',
    targetAppIds: ['app_02'],
    title: 'Read Books Anywhere',
    description: 'Get free access to thousands of books offline.',
    ctaText: 'Install Reader',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.reader',
    layoutVariant: 'banner',
    priority: 85,
    enabled: true,
    status: 'published',
    analytics: { impressions: 1000, clicks: 50, ctr: 5.0 },
    createdAt: '2026-09-30T00:00:00Z',
    updatedAt: '2026-09-30T00:00:00Z',
  },
];

const defaultTestPromotionEvents: PromotionEvent[] = [
  {
    id: 'pe_01',
    eventType: 'impression',
    campaignId: 'camp_01',
    appId: 'app_02',
    timestamp: '2026-09-30T01:00:00Z',
  },
  {
    id: 'pe_02',
    eventType: 'click',
    campaignId: 'camp_01',
    appId: 'app_02',
    timestamp: '2026-09-30T02:00:00Z',
  },
];

const defaultTestAlertRules: CostAlertRule[] = [
  {
    id: 'rule_test_cap',
    name: 'Test Spend Cap',
    metric: 'daily_cost_usd',
    threshold: 10.0,
    enabled: true,
    notifyEmails: ['test@webappypie.com'],
    createdAt: '2026-09-30T00:00:00Z',
    updatedAt: '2026-09-30T00:00:00Z',
  },
];

const defaultTestRetentionPolicy: DataRetentionPolicy = {
  usageEventsTtlDays: 90,
  promotionEventsTtlDays: 90,
  auditLogsTtlDays: 365,
  lastPrunedAt: '2026-09-28T00:00:00Z',
  prunedCount: 50,
};

let testUsageEvents: UsageEvent[] = createDefaultTestUsageEvents();
let testCampaigns: Campaign[] = [...defaultTestCampaigns];
let testPromotionEvents: PromotionEvent[] = [...defaultTestPromotionEvents];
let testAlertRules: CostAlertRule[] = [...defaultTestAlertRules];
let testRetentionPolicy: DataRetentionPolicy = { ...defaultTestRetentionPolicy };

export function resetTestAnalyticsData(
  events?: UsageEvent[],
  campaigns?: Campaign[],
  rules?: CostAlertRule[],
  retention?: DataRetentionPolicy,
): void {
  testUsageEvents = events ? [...events] : createDefaultTestUsageEvents();
  testCampaigns = campaigns ? [...campaigns] : [...defaultTestCampaigns];
  testAlertRules = rules ? [...rules] : [...defaultTestAlertRules];
  testRetentionPolicy = retention ? { ...retention } : { ...defaultTestRetentionPolicy };
}

// ============================================================
// Auth & Network Helpers
// ============================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Non-blocking token retrieval
  }
  return headers;
}

// ============================================================
// 1. AI Usage & Telemetry Analytics
// ============================================================

export interface UsageAnalyticsFilters {
  appId?: string | undefined;
  providerId?: string | undefined;
  modelId?: string | undefined;
}

/**
 * Fetches real production AI usage analytics from the Admin API.
 * Dual-channel fallback to direct Firestore if API is unreachable.
 */
export async function fetchUsageAnalytics(
  daysLookback = 30,
  filters?: UsageAnalyticsFilters,
): Promise<UsageAggregationSummary> {
  if (isOfflineMode || isTestEnv) {
    return aggregateUsageBreakdowns(testUsageEvents, daysLookback, new Date('2026-09-30T12:00:00Z'), filters);
  }

  // 1. Authenticated Admin API call
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    params.set('days', String(daysLookback));
    if (filters?.appId && filters.appId !== 'all') params.set('appId', filters.appId);
    if (filters?.providerId && filters.providerId !== 'all') params.set('providerId', filters.providerId);
    if (filters?.modelId && filters.modelId !== 'all') params.set('modelId', filters.modelId);

    const res = await fetch(`/api/admin/v1/analytics/usage?${params.toString()}`, { headers });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data) {
        return body.data as UsageAggregationSummary;
      }
    }
  } catch {
    // Fall back to direct Firestore query
  }

  // 2. Direct Firestore fallback
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.USAGE_EVENTS));
    const events: UsageEvent[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: data['id'] || d.id,
        appId: data['appId'] || 'unknown',
        providerId: data['providerId'] || 'unknown',
        modelId: data['modelId'] || 'unknown',
        feature: data['feature'] || 'unknown',
        requestId: data['requestId'] || d.id,
        inputTokens: data['inputTokens'] !== undefined ? Number(data['inputTokens']) : undefined,
        outputTokens: data['outputTokens'] !== undefined ? Number(data['outputTokens']) : undefined,
        costEstimateUsd: data['costEstimateUsd'] !== undefined ? Number(data['costEstimateUsd']) : undefined,
        latencyMs: Number(data['latencyMs'] || 0),
        success: data['success'] !== undefined ? Boolean(data['success']) : true,
        error: data['error'] || undefined,
        timestamp: data['timestamp'] || new Date().toISOString(),
      };
    });

    return aggregateUsageBreakdowns(events, daysLookback > 0 ? daysLookback : undefined, new Date(), filters);
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch AI usage analytics from Firestore');
  }
}

/**
 * Subscribes to real-time AI usage analytics.
 */
export function subscribeUsageAnalytics(
  daysLookback: number,
  onData: (data: UsageAggregationSummary) => void,
  onError?: (err: Error) => void,
  filters?: UsageAnalyticsFilters,
): () => void {
  if (isOfflineMode || isTestEnv) {
    try {
      const summary = aggregateUsageBreakdowns(testUsageEvents, daysLookback, new Date('2026-09-30T12:00:00Z'), filters);
      onData(summary);
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
    return () => {};
  }

  let active = true;

  const loadData = async () => {
    try {
      const summary = await fetchUsageAnalytics(daysLookback, filters);
      if (active) onData(summary);
    } catch (err) {
      if (active && onError && err instanceof Error) onError(err);
    }
  };

  void loadData();

  // Firestore real-time listener triggers re-computation whenever new gateway events arrive
  try {
    const colRef = collection(db, COLLECTIONS.USAGE_EVENTS);
    const unsubFirestore = onSnapshot(
      colRef,
      () => {
        void loadData();
      },
      (err) => {
        if (active && onError) onError(err);
      },
    );

    return () => {
      active = false;
      unsubFirestore();
    };
  } catch {
    return () => {
      active = false;
    };
  }
}

// ============================================================
// 2. Promotion Campaign Analytics
// ============================================================

export async function fetchCampaignAnalytics(): Promise<CampaignPerformance[]> {
  if (isOfflineMode || isTestEnv) {
    return aggregateCampaignPerformance(testCampaigns, testPromotionEvents);
  }

  // 1. Authenticated Admin API call
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/campaigns', { headers });
    if (res.ok) {
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        return body.data as CampaignPerformance[];
      }
    }
  } catch {
    // Fall back to direct Firestore query
  }

  // 2. Direct Firestore fallback
  try {
    const [cSnap, pSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.CAMPAIGNS)),
      getDocs(collection(db, COLLECTIONS.PROMOTION_EVENTS)),
    ]);

    const campaigns: Campaign[] = cSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data['name'] || '',
        promotedAppId: data['promotedAppId'] || '',
        targetAppIds: Array.isArray(data['targetAppIds']) ? data['targetAppIds'] : [],
        title: data['title'] || '',
        description: data['description'] || '',
        ctaText: data['ctaText'] || '',
        storeUrl: data['storeUrl'] || '',
        layoutVariant: data['layoutVariant'] || 'banner',
        priority: Number(data['priority'] || 50),
        enabled: Boolean(data['enabled'] ?? true),
        status: data['status'] || 'published',
        analytics: data['analytics'] || { impressions: 0, clicks: 0, ctr: 0 },
        createdAt: data['createdAt'] || new Date().toISOString(),
        updatedAt: data['updatedAt'] || new Date().toISOString(),
      };
    });

    const events: PromotionEvent[] = pSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        eventType: data['eventType'] || 'impression',
        campaignId: data['campaignId'] || '',
        appId: data['appId'] || '',
        timestamp: data['timestamp'] || new Date().toISOString(),
      };
    });

    return aggregateCampaignPerformance(campaigns, events);
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch campaign analytics');
  }
}

export function subscribeCampaignAnalytics(
  onData: (data: CampaignPerformance[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode || isTestEnv) {
    try {
      const perf = aggregateCampaignPerformance(testCampaigns, testPromotionEvents);
      onData(perf);
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
    return () => {};
  }

  let active = true;

  const loadData = async () => {
    try {
      const perf = await fetchCampaignAnalytics();
      if (active) onData(perf);
    } catch (err) {
      if (active && onError && err instanceof Error) onError(err);
    }
  };

  void loadData();

  try {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.CAMPAIGNS),
      () => void loadData(),
      (err) => {
        if (active && onError) onError(err);
      },
    );
    return () => {
      active = false;
      unsub();
    };
  } catch {
    return () => {
      active = false;
    };
  }
}

// ============================================================
// 3. Cost Alerts & Rules
// ============================================================

export async function fetchCostAlerts(): Promise<{ rules: CostAlertRule[]; triggers: CostAlertTrigger[] }> {
  if (isOfflineMode || isTestEnv) {
    const triggers = evaluateCostAlerts(testUsageEvents, testAlertRules, new Date('2026-09-30T12:00:00Z'));
    return { rules: [...testAlertRules], triggers };
  }

  // 1. Authenticated Admin API call
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/alerts', { headers });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data) {
        return body.data as { rules: CostAlertRule[]; triggers: CostAlertTrigger[] };
      }
    }
  } catch {
    // Fall back to direct Firestore query
  }

  // 2. Direct Firestore fallback
  try {
    const [rulesSnap, eventsSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.COST_ALERTS)),
      getDocs(collection(db, COLLECTIONS.USAGE_EVENTS)),
    ]);

    const rules: CostAlertRule[] = rulesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data['name'] || '',
        ...(data['appId'] ? { appId: data['appId'] } : {}),
        metric: data['metric'] || 'daily_cost_usd',
        threshold: Number(data['threshold'] || 0),
        enabled: data['enabled'] !== undefined ? Boolean(data['enabled']) : true,
        notifyEmails: Array.isArray(data['notifyEmails']) ? data['notifyEmails'] : [],
        createdAt: data['createdAt'] || new Date().toISOString(),
        updatedAt: data['updatedAt'] || new Date().toISOString(),
      };
    });

    const events: UsageEvent[] = eventsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: data['id'] || d.id,
        appId: data['appId'] || 'unknown',
        providerId: data['providerId'] || 'unknown',
        modelId: data['modelId'] || 'unknown',
        feature: data['feature'] || 'unknown',
        requestId: data['requestId'] || d.id,
        latencyMs: Number(data['latencyMs'] || 0),
        success: data['success'] !== undefined ? Boolean(data['success']) : true,
        timestamp: data['timestamp'] || new Date().toISOString(),
        inputTokens: data['inputTokens'] !== undefined ? Number(data['inputTokens']) : undefined,
        outputTokens: data['outputTokens'] !== undefined ? Number(data['outputTokens']) : undefined,
        costEstimateUsd: data['costEstimateUsd'] !== undefined ? Number(data['costEstimateUsd']) : undefined,
      };
    });

    const triggers = evaluateCostAlerts(events, rules);
    return { rules, triggers };
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch cost alerts');
  }
}

export function subscribeCostAlerts(
  onData: (rules: CostAlertRule[], triggers: CostAlertTrigger[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode || isTestEnv) {
    try {
      const triggers = evaluateCostAlerts(testUsageEvents, testAlertRules, new Date('2026-09-30T12:00:00Z'));
      onData([...testAlertRules], triggers);
    } catch (err) {
      if (onError && err instanceof Error) onError(err);
    }
    return () => {};
  }

  let active = true;

  const loadData = async () => {
    try {
      const { rules, triggers } = await fetchCostAlerts();
      if (active) onData(rules, triggers);
    } catch (err) {
      if (active && onError && err instanceof Error) onError(err);
    }
  };

  void loadData();

  try {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.COST_ALERTS),
      () => void loadData(),
      (err) => {
        if (active && onError) onError(err);
      },
    );
    return () => {
      active = false;
      unsub();
    };
  } catch {
    return () => {
      active = false;
    };
  }
}

export async function createCostAlertRule(
  input: CreateCostAlertRuleInput,
  actor: { uid: string; email: string },
): Promise<CostAlertRule> {
  const validated = CreateCostAlertRuleSchema.parse(input);
  const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  const newRule: CostAlertRule = {
    id: ruleId,
    name: validated.name,
    ...(validated.appId ? { appId: validated.appId } : {}),
    metric: validated.metric,
    threshold: validated.threshold,
    enabled: validated.enabled,
    notifyEmails: validated.notifyEmails || [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (isOfflineMode || isTestEnv) {
    testAlertRules = [newRule, ...testAlertRules];
    return newRule;
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/alerts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...newRule }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data) {
        return body.data as CostAlertRule;
      }
    }
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore fallback
  const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
  await setDoc(docRef, {
    ...newRule,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'alert_rule',
    resourceId: ruleId,
    changes: {
      rule: { before: null, after: newRule },
    },
  });

  return newRule;
}

export async function toggleCostAlertRule(
  ruleId: string,
  enabled: boolean,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode || isTestEnv) {
    const existing = testAlertRules.find((r) => r.id === ruleId);
    if (existing) {
      existing.enabled = enabled;
      existing.updatedAt = new Date().toISOString();
    }
    return;
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/v1/analytics/alerts/${encodeURIComponent(ruleId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) return;
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore fallback
  const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
  await setDoc(docRef, { enabled, updatedAt: serverTimestamp() }, { merge: true });

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'alert_rule',
    resourceId: ruleId,
    changes: {
      enabled: { before: !enabled, after: enabled },
    },
  });
}

export async function deleteCostAlertRule(
  ruleId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode || isTestEnv) {
    testAlertRules = testAlertRules.filter((r) => r.id !== ruleId);
    return;
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/v1/analytics/alerts/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.ok) return;
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore fallback
  const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
  await deleteDoc(docRef);

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'alert_rule',
    resourceId: ruleId,
    changes: {
      rule: { before: { id: ruleId }, after: null },
    },
  });
}

// ============================================================
// 4. Data Retention Policy & Maintenance
// ============================================================

export async function fetchDataRetentionPolicy(): Promise<DataRetentionPolicy> {
  if (isOfflineMode || isTestEnv) {
    return { ...testRetentionPolicy };
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/retention', { headers });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data) {
        return body.data as DataRetentionPolicy;
      }
    }
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore fallback
  try {
    const docRef = doc(db, COLLECTIONS.DATA_RETENTION, 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DataRetentionPolicy;
    }
    return {
      usageEventsTtlDays: 90,
      promotionEventsTtlDays: 90,
      auditLogsTtlDays: 365,
      lastPrunedAt: undefined,
      prunedCount: 0,
    };
  } catch {
    return {
      usageEventsTtlDays: 90,
      promotionEventsTtlDays: 90,
      auditLogsTtlDays: 365,
    };
  }
}

export function subscribeDataRetentionPolicy(
  onData: (policy: DataRetentionPolicy) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode || isTestEnv) {
    onData({ ...testRetentionPolicy });
    return () => {};
  }

  let active = true;

  const loadData = async () => {
    try {
      const policy = await fetchDataRetentionPolicy();
      if (active) onData(policy);
    } catch (err) {
      if (active && onError && err instanceof Error) onError(err);
    }
  };

  void loadData();

  try {
    const docRef = doc(db, COLLECTIONS.DATA_RETENTION, 'global');
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists() && active) {
          onData(snap.data() as DataRetentionPolicy);
        }
      },
      (err) => {
        if (active && onError) onError(err);
      },
    );
    return () => {
      active = false;
      unsub();
    };
  } catch {
    return () => {
      active = false;
    };
  }
}

export async function updateDataRetentionPolicy(
  policy: DataRetentionPolicyInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = DataRetentionPolicySchema.parse(policy);

  if (isOfflineMode || isTestEnv) {
    testRetentionPolicy = {
      ...testRetentionPolicy,
      ...validated,
    };
    return;
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/retention', {
      method: 'PUT',
      headers,
      body: JSON.stringify(validated),
    });
    if (res.ok) return;
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore fallback
  const docRef = doc(db, COLLECTIONS.DATA_RETENTION, 'global');
  await setDoc(docRef, validated, { merge: true });

  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'retention_policy',
    resourceId: 'global',
    changes: {
      policy: { before: null, after: validated },
    },
  });
}

export async function triggerManualRetentionPruning(actor: {
  uid: string;
  email: string;
}): Promise<{ prunedCount: number; timestamp: string }> {
  if (isOfflineMode || isTestEnv) {
    const refDate = new Date();
    const { retained, prunedCount } = pruneExpiredEvents(
      testUsageEvents,
      testRetentionPolicy.usageEventsTtlDays,
      refDate,
    );
    testUsageEvents = retained;
    const timestamp = refDate.toISOString();
    testRetentionPolicy = {
      ...testRetentionPolicy,
      lastPrunedAt: timestamp,
      prunedCount: (testRetentionPolicy.prunedCount || 0) + prunedCount,
    };
    return { prunedCount, timestamp };
  }

  // 1. Try Admin API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/v1/analytics/retention/prune', {
      method: 'POST',
      headers,
    });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.data) {
        return body.data as { prunedCount: number; timestamp: string };
      }
    }
  } catch {
    // Fall back to direct Firestore
  }

  // 2. Direct Firestore manual prune
  const timestamp = new Date().toISOString();
  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'retention_cleanup',
    resourceId: 'global',
    metadata: { timestamp },
  });

  return { prunedCount: 0, timestamp };
}
