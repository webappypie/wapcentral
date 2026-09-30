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
  DetailedServiceHealth,
  AiServerMetrics,
  InfrastructureAlertRule,
  InfrastructureAlertTrigger,
  PlatformHealthOverview,
} from '@wapcentral/types';
import {
  CreateInfrastructureAlertRuleSchema,
  type CreateInfrastructureAlertRuleInput,
} from '@wapcentral/validation';
import {
  DEFAULT_MONITORED_SERVICES,
  probeServiceHeartbeat,
  checkAllMonitoredServices,
  collectAiServerMetrics,
  evaluateInfrastructureAlerts,
  computePlatformOverview,
} from '@wapcentral/workers';
import { recordAuditLog } from './auditService.js';

// ============================================================
// In-Memory Seed / Fallback Datasets
// ============================================================

const now = new Date();
const nowIso = now.toISOString();

let memoryServices: DetailedServiceHealth[] = DEFAULT_MONITORED_SERVICES.map((s) => ({
  serviceId: s.id,
  serviceName: s.name,
  category: s.category,
  status: s.id === 'openai' ? 'degraded' : 'healthy', // OpenAI slightly elevated for realism
  latencyMs: s.id === 'openai' ? 320 : s.expectedBaselineLatencyMs,
  errorRatePct: s.id === 'openai' ? 2.1 : 0.0,
  uptimePct30d: s.id === 'openai' ? 99.75 : 99.98,
  consecutiveFailures: 0,
  lastCheckedAt: nowIso,
  endpoint: s.endpoint,
  region: s.region,
  details: s.details,
}));

let memoryAiServerMetrics: AiServerMetrics = collectAiServerMetrics('self_hosted', {
  cpuUsagePct: 34.2,
  memoryUsedMb: 18432,
  memoryTotalMb: 65536,
  gpuUsagePct: 78.4,
  vramUsedMb: 68608,
  vramTotalMb: 81920,
  queueDepth: 8,
  activeStreams: 12,
  avgLatencyMs: 48,
  temperatureC: 62,
  modelLoaded: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  reportedAt: nowIso,
});

let memoryAlertRules: InfrastructureAlertRule[] = [
  {
    id: 'rule_infra_gateway_lat',
    name: 'AI Gateway High Latency',
    targetServiceId: 'ai-gateway',
    metric: 'latency_ms',
    threshold: 300,
    severity: 'warning',
    enabled: true,
    notifyEmails: ['ops-oncall@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'rule_infra_failures',
    name: 'Critical Service Heartbeat Failure',
    targetServiceId: 'all',
    metric: 'consecutive_failures',
    threshold: 3,
    severity: 'critical',
    enabled: true,
    notifyEmails: ['eng-lead@webappypie.com', 'ops-oncall@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'rule_infra_gpu_saturate',
    name: 'Self-Hosted AI Node High GPU Utilization',
    targetServiceId: 'self_hosted',
    metric: 'gpu_usage_pct',
    threshold: 85.0,
    severity: 'warning',
    enabled: true,
    notifyEmails: ['mlops@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'rule_infra_vram_critical',
    name: 'AI Node VRAM Exhaustion Warning',
    targetServiceId: 'self_hosted',
    metric: 'vram_usage_pct',
    threshold: 90.0,
    severity: 'critical',
    enabled: true,
    notifyEmails: ['mlops@webappypie.com'],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

// ============================================================
// Service Subscriptions
// ============================================================

/**
 * Subscribes to comprehensive health status across all services and platforms.
 */
export function subscribePlatformHealth(
  onData: (services: DetailedServiceHealth[], overview: PlatformHealthOverview) => void,
  onError?: (err: Error) => void,
): () => void {
  const publish = () => {
    try {
      const triggers = evaluateInfrastructureAlerts(
        memoryServices,
        [memoryAiServerMetrics],
        memoryAlertRules,
      );
      const overview = computePlatformOverview(memoryServices, triggers);
      onData([...memoryServices], overview);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  publish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.HEALTH_CHECKS);
    return onSnapshot(
      colRef,
      () => publish(),
      (err) => {
        publish();
        if (onError) onError(err);
      },
    );
  } catch {
    publish();
    return () => {};
  }
}

/**
 * Subscribes to live self-hosted AI compute telemetry.
 */
export function subscribeAiServerMetrics(
  onData: (metrics: AiServerMetrics) => void,
  onError?: (err: Error) => void,
): () => void {
  const publish = () => {
    try {
      onData({ ...memoryAiServerMetrics });
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  publish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const docRef = doc(db, COLLECTIONS.AI_SERVER_METRICS, 'self_hosted');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          memoryAiServerMetrics = snap.data() as AiServerMetrics;
        }
        publish();
      },
      (err) => {
        publish();
        if (onError) onError(err);
      },
    );
  } catch {
    publish();
    return () => {};
  }
}

/**
 * Subscribes to infrastructure alert rules and evaluated live triggers.
 */
export function subscribeInfrastructureAlerts(
  onData: (rules: InfrastructureAlertRule[], triggers: InfrastructureAlertTrigger[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const publish = () => {
    try {
      const triggers = evaluateInfrastructureAlerts(
        memoryServices,
        [memoryAiServerMetrics],
        memoryAlertRules,
      );
      onData([...memoryAlertRules], triggers);
    } catch (err: unknown) {
      if (onError && err instanceof Error) onError(err);
    }
  };

  publish();

  if (isOfflineMode) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.INFRASTRUCTURE_ALERTS);
    return onSnapshot(
      colRef,
      () => publish(),
      (err) => {
        publish();
        if (onError) onError(err);
      },
    );
  } catch {
    publish();
    return () => {};
  }
}

// ============================================================
// Service Actions & Operations
// ============================================================

/**
 * Triggers a manual heartbeat probe for a specific service or all services.
 */
export async function triggerServiceHealthCheck(
  serviceId?: string,
): Promise<DetailedServiceHealth[]> {
  if (serviceId) {
    const def = DEFAULT_MONITORED_SERVICES.find((s) => s.id === serviceId);
    if (!def) throw new Error(`Unknown service id: ${serviceId}`);

    const existing = memoryServices.find((s) => s.serviceId === serviceId);
    const updated = await probeServiceHeartbeat(def, { previousHealth: existing });

    memoryServices = memoryServices.map((s) => (s.serviceId === serviceId ? updated : s));

    if (!isOfflineMode) {
      try {
        const docRef = doc(db, COLLECTIONS.HEALTH_CHECKS, serviceId);
        await setDoc(docRef, { ...updated, lastCheckedAt: serverTimestamp() }, { merge: true });
      } catch {
        // Fallback to memory
      }
    }

    return [...memoryServices];
  }

  // Check all services
  const results = await checkAllMonitoredServices(DEFAULT_MONITORED_SERVICES);
  memoryServices = results;

  if (!isOfflineMode) {
    try {
      for (const res of results) {
        const docRef = doc(db, COLLECTIONS.HEALTH_CHECKS, res.serviceId);
        await setDoc(docRef, { ...res, lastCheckedAt: serverTimestamp() }, { merge: true });
      }
    } catch {
      // Fallback
    }
  }

  return [...memoryServices];
}

/**
 * Creates a new infrastructure alert rule.
 */
export async function createInfrastructureAlertRule(
  input: CreateInfrastructureAlertRuleInput,
  actor: { uid: string; email: string },
): Promise<InfrastructureAlertRule> {
  const validated = CreateInfrastructureAlertRuleSchema.parse(input);
  const ruleId = `rule_infra_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const newRule: InfrastructureAlertRule = {
    id: ruleId,
    name: validated.name,
    targetServiceId: validated.targetServiceId,
    metric: validated.metric,
    threshold: validated.threshold,
    severity: validated.severity,
    enabled: validated.enabled,
    notifyEmails: validated.notifyEmails || [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  memoryAlertRules = [newRule, ...memoryAlertRules];

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.INFRASTRUCTURE_ALERTS, ruleId);
      await setDoc(docRef, {
        ...newRule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Fallback to memory
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'infra_alert_rule',
    resourceId: ruleId,
    changes: {
      rule: { before: null, after: newRule },
    },
  });

  return newRule;
}

/**
 * Toggles an infrastructure alert rule on or off.
 */
export async function toggleInfrastructureAlertRule(
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
      const docRef = doc(db, COLLECTIONS.INFRASTRUCTURE_ALERTS, ruleId);
      await setDoc(docRef, { enabled, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      // Fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'infra_alert_rule',
    resourceId: ruleId,
    changes: {
      enabled: { before: !enabled, after: enabled },
    },
  });
}

/**
 * Deletes an infrastructure alert rule.
 */
export async function deleteInfrastructureAlertRule(
  ruleId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const existing = memoryAlertRules.find((r) => r.id === ruleId);
  memoryAlertRules = memoryAlertRules.filter((r) => r.id !== ruleId);

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.INFRASTRUCTURE_ALERTS, ruleId);
      await deleteDoc(docRef);
    } catch {
      // Fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'infra_alert_rule',
    resourceId: ruleId,
    changes: {
      rule: { before: existing ?? null, after: null },
    },
  });
}

/**
 * Simulates AI server compute telemetry (useful for MLOps testing and monitoring validation).
 */
export function simulateAiServerLoad(patch: Partial<AiServerMetrics>): AiServerMetrics {
  memoryAiServerMetrics = collectAiServerMetrics('self_hosted', patch);
  return memoryAiServerMetrics;
}
