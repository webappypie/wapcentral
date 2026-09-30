import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isOfflineMode } from '../lib/firestore.js';
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
// Realistic Mock / Seed Datasets for In-Memory Fallback
// ============================================================

const now = new Date();
const nowIso = now.toISOString();

function generateMockUsageEvents(): UsageEvent[] {
  const events: UsageEvent[] = [];
  const providers = ['gemini', 'openai', 'anthropic', 'self_hosted'];
  const apps = ['app_01', 'app_02', 'app_03'];
  const features = ['chat_assistant', 'image_analysis', 'semantic_search', 'auto_summarize'];

  // Seed events across the last 30 days
  for (let i = 0; i < 30; i++) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = dayDate.toISOString().split('T')[0]!;

    // Multiple calls per day
    for (let c = 0; c < 5; c++) {
      const provider = providers[(i + c) % providers.length]!;
      const app = apps[(i + c) % apps.length]!;
      const feature = features[c % features.length]!;
      const input = 300 + c * 150 + i * 20;
      const output = 150 + c * 80 + i * 10;
      const isError = i === 0 && c === 2; // Introduce recent error for alert evaluation

      let costPer1k = 0.0005;
      if (provider === 'openai') costPer1k = 0.005;
      else if (provider === 'anthropic') costPer1k = 0.003;
      else if (provider === 'self_hosted') costPer1k = 0.0001;

      const cost = Number((((input + output) / 1000) * costPer1k).toFixed(5));

      events.push({
        id: `evt_${dayStr}_${c}`,
        appId: app,
        providerId: provider,
        modelId:
          provider === 'gemini'
            ? 'gemini-1.5-flash'
            : provider === 'openai'
              ? 'gpt-4o'
              : 'claude-3-5-sonnet',
        feature,
        requestId: `req_${dayStr}_${c}`,
        inputTokens: input,
        outputTokens: output,
        costEstimateUsd: cost,
        latencyMs: 120 + c * 40 + (i % 5) * 15,
        success: !isError,
        ...(isError ? { error: 'Rate limit exceeded on provider tier' } : {}),
        timestamp: `${dayStr}T${String(10 + c * 2).padStart(2, '0')}:30:00Z`,
      });
    }
  }

  return events;
}

let memoryUsageEvents: UsageEvent[] = generateMockUsageEvents();

let memoryCampaigns: Campaign[] = [
  {
    id: 'camp_01',
    name: 'WebAppyPie Reader Spring Promo',
    promotedAppId: 'app_01',
    targetAppIds: ['app_02', 'app_03'],
    title: 'Read Books Anywhere',
    description: 'Get free access to thousands of books offline.',
    ctaText: 'Install Reader',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.reader',
    layoutVariant: 'banner',
    priority: 85,
    enabled: true,
    status: 'published',
    analytics: {
      impressions: 12450,
      clicks: 860,
      ctr: 6.91,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'camp_02',
    name: 'Pie Calc Pro Cross-Sell',
    promotedAppId: 'app_02',
    targetAppIds: ['app_01'],
    title: 'Upgrade Your Math Tools',
    description: 'Scientific calculator with graphing and unit conversion.',
    ctaText: 'Try Free',
    storeUrl: 'https://apps.apple.com/app/pie-calc-pro/id123456789',
    layoutVariant: 'interstitial',
    priority: 70,
    enabled: true,
    status: 'published',
    analytics: {
      impressions: 8900,
      clicks: 410,
      ctr: 4.61,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'camp_03',
    name: 'WAP Notes AI Launch',
    promotedAppId: 'app_03',
    targetAppIds: ['app_01', 'app_02'],
    title: 'AI Note Taking & Summaries',
    description: 'Summarize meeting recordings and drafts in seconds.',
    ctaText: 'Get Started',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.notes',
    layoutVariant: 'native',
    priority: 90,
    enabled: true,
    status: 'published',
    analytics: {
      impressions: 15300,
      clicks: 1220,
      ctr: 7.97,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

let memoryPromotionEvents: PromotionEvent[] = [
  {
    id: 'pe_01',
    eventType: 'impression',
    campaignId: 'camp_01',
    appId: 'app_02',
    timestamp: nowIso,
  },
  {
    id: 'pe_02',
    eventType: 'click',
    campaignId: 'camp_01',
    appId: 'app_02',
    timestamp: nowIso,
  },
];

let memoryAlertRules: CostAlertRule[] = [
  {
    id: 'rule_daily_cap',
    name: 'Global Daily AI Cost Threshold',
    metric: 'daily_cost_usd',
    threshold: 5.0,
    enabled: true,
    notifyEmails: ['ops@webappypie.com', 'admin@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'rule_monthly_budget',
    name: 'Monthly Budget Projection Cap',
    metric: 'monthly_cost_usd',
    threshold: 150.0,
    enabled: true,
    notifyEmails: ['billing@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'rule_notes_errors',
    name: 'Notes AI Error Rate Threshold',
    appId: 'app_03',
    metric: 'error_rate_pct',
    threshold: 5.0,
    enabled: true,
    notifyEmails: ['eng-lead@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

let memoryRetentionPolicy: DataRetentionPolicy = {
  usageEventsTtlDays: 90,
  promotionEventsTtlDays: 90,
  auditLogsTtlDays: 365,
  lastPrunedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  prunedCount: 1420,
};

// ============================================================
// Service Methods
// ============================================================

/**
 * Subscribes to multi-dimensional AI usage analytics and trends.
 */
export function subscribeUsageAnalytics(
  daysLookback: number,
  onData: (data: UsageAggregationSummary) => void,
  onError?: (err: Error) => void,
): () => void {
  const computeAndPublish = () => {
    try {
      const summary = aggregateUsageBreakdowns(memoryUsageEvents, daysLookback);
      onData(summary);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  computeAndPublish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.USAGE_EVENTS);
    return onSnapshot(
      colRef,
      () => {
        computeAndPublish();
      },
      (err) => {
        computeAndPublish();
        if (onError) onError(err);
      },
    );
  } catch {
    computeAndPublish();
    return () => {};
  }
}

/**
 * Subscribes to campaign promotion performance metrics (Impressions, Clicks, CTR).
 */
export function subscribeCampaignAnalytics(
  onData: (data: CampaignPerformance[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const computeAndPublish = () => {
    try {
      const performance = aggregateCampaignPerformance(memoryCampaigns, memoryPromotionEvents);
      onData(performance);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  computeAndPublish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.CAMPAIGNS);
    return onSnapshot(
      colRef,
      () => {
        computeAndPublish();
      },
      (err) => {
        computeAndPublish();
        if (onError) onError(err);
      },
    );
  } catch {
    computeAndPublish();
    return () => {};
  }
}

/**
 * Subscribes to Cost Alert Rules and evaluated active triggers.
 */
export function subscribeCostAlerts(
  onData: (rules: CostAlertRule[], triggers: CostAlertTrigger[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const computeAndPublish = () => {
    try {
      const triggers = evaluateCostAlerts(memoryUsageEvents, memoryAlertRules);
      onData([...memoryAlertRules], triggers);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  computeAndPublish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.COST_ALERTS);
    return onSnapshot(
      colRef,
      () => {
        computeAndPublish();
      },
      (err) => {
        computeAndPublish();
        if (onError) onError(err);
      },
    );
  } catch {
    computeAndPublish();
    return () => {};
  }
}

/**
 * Creates a new Cost Alert Rule.
 */
export async function createCostAlertRule(
  input: CreateCostAlertRuleInput,
  actor: { uid: string; email: string },
): Promise<CostAlertRule> {
  const validated = CreateCostAlertRuleSchema.parse(input);
  const ruleId = `rule_${Date.now()}`;
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

  memoryAlertRules = [newRule, ...memoryAlertRules];

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
      await setDoc(docRef, {
        ...newRule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Memory fallback
    }
  }

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

/**
 * Toggles an alert rule on/off.
 */
export async function toggleCostAlertRule(
  ruleId: string,
  enabled: boolean,
  actor: { uid: string; email: string },
): Promise<void> {
  const existing = memoryAlertRules.find((r) => r.id === ruleId);
  if (existing) {
    existing.enabled = enabled;
    existing.updatedAt = new Date().toISOString();
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
      await setDoc(docRef, { enabled, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      // Memory fallback
    }
  }

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

/**
 * Deletes a cost alert rule.
 */
export async function deleteCostAlertRule(
  ruleId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const existing = memoryAlertRules.find((r) => r.id === ruleId);
  memoryAlertRules = memoryAlertRules.filter((r) => r.id !== ruleId);

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.COST_ALERTS, ruleId);
      await deleteDoc(docRef);
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'alert_rule',
    resourceId: ruleId,
    changes: {
      rule: { before: existing ?? null, after: null },
    },
  });
}

/**
 * Subscribes to the data retention policy.
 */
export function subscribeDataRetentionPolicy(
  onData: (policy: DataRetentionPolicy) => void,
): () => void {
  onData({ ...memoryRetentionPolicy });

  if (isOfflineMode) return () => {};

  try {
    const docRef = doc(db, COLLECTIONS.DATA_RETENTION, 'global');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DataRetentionPolicy;
          memoryRetentionPolicy = { ...data };
          onData(memoryRetentionPolicy);
        } else {
          onData(memoryRetentionPolicy);
        }
      },
      () => onData(memoryRetentionPolicy),
    );
  } catch {
    onData(memoryRetentionPolicy);
    return () => {};
  }
}

/**
 * Updates the global data retention policy.
 */
export async function updateDataRetentionPolicy(
  policy: DataRetentionPolicyInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = DataRetentionPolicySchema.parse(policy);
  const updated: DataRetentionPolicy = {
    ...memoryRetentionPolicy,
    ...validated,
  };
  memoryRetentionPolicy = updated;

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.DATA_RETENTION, 'global');
      await setDoc(docRef, updated, { merge: true });
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'retention_policy',
    resourceId: 'global',
    changes: {
      policy: { before: memoryRetentionPolicy, after: updated },
    },
  });
}

/**
 * Triggers manual pruning of expired usage events according to the active TTL.
 */
export async function triggerManualRetentionPruning(actor: {
  uid: string;
  email: string;
}): Promise<{ prunedCount: number; timestamp: string }> {
  const refDate = new Date();
  const { retained, prunedCount } = pruneExpiredEvents(
    memoryUsageEvents,
    memoryRetentionPolicy.usageEventsTtlDays,
    refDate,
  );

  memoryUsageEvents = retained;
  const timestamp = refDate.toISOString();

  memoryRetentionPolicy = {
    ...memoryRetentionPolicy,
    lastPrunedAt: timestamp,
    prunedCount: (memoryRetentionPolicy.prunedCount || 0) + prunedCount,
  };

  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'retention_cleanup',
    resourceId: 'global',
    metadata: {
      prunedCount,
      retainedCount: retained.length,
      ttlDays: memoryRetentionPolicy.usageEventsTtlDays,
    },
  });

  return { prunedCount, timestamp };
}
