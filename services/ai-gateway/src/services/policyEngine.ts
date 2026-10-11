import { COLLECTIONS } from '@wapcentral/config';
import type { AiPolicy } from '@wapcentral/types';
import { getFirestoreDb } from './firestore.js';

// Cached active routing policies mapped by policy ID
const activePoliciesById = new Map<string, AiPolicy>();

// Last sync timestamp
let lastPoliciesSync = 0;
const SYNC_CACHE_TTL_MS = 10000; // 10 seconds cache TTL

// Global kill switch flag
let globalKillSwitch = false;

// Provider-specific kill switch flags
const providerKillSwitches = new Set<string>();

// Real Daily and Monthly request and token counters
// Keys:
// Daily:   "appId:feature:YYYY-MM-DD"
// Monthly: "appId:feature:YYYY-MM"
interface UsageCounter {
  requests: number;
  tokens: number;
}
const usageCounters = new Map<string, UsageCounter>();

// Sliding-window request timestamps for Rate Limiting (RPM)
// Key: policyId -> array of millisecond timestamps in the last 60 seconds
const rateLimitWindows = new Map<string, number[]>();

function getTodayKey(appId: string, feature: string): string {
  const dateStr = new Date().toISOString().split('T')[0]!;
  return `${appId}:${feature}:${dateStr}`;
}

function getMonthKey(appId: string, feature: string): string {
  const dateStr = new Date().toISOString().split('T')[0]!;
  const monthStr = dateStr.substring(0, 7);
  return `${appId}:${feature}:${monthStr}`;
}

function mapDocToPolicy(id: string, data: Record<string, any> | undefined): AiPolicy {
  const d = data || {};
  return {
    id,
    appId: d['appId'] || '',
    feature: d['feature'] || '',
    primaryProviderId: d['primaryProviderId'] || '',
    primaryModelId: d['primaryModelId'] || '',
    fallbackChain: (d['fallbackChain'] || []).map((fb: any) => ({
      providerId: fb.providerId,
      modelId: fb.modelId,
      priority: Number(fb.priority) || 1,
    })),
    quotas: d['quotas'] || {},
    circuitBreaker: d['circuitBreaker']
      ? {
          failureThreshold: Number(d['circuitBreaker'].failureThreshold) || 3,
          timeoutMs: Number(d['circuitBreaker'].timeoutMs) || 10000,
          recoveryTimeMs: Number(d['circuitBreaker'].recoveryTimeMs) || 30000,
        }
      : undefined,
    priority: Number(d['priority']) || 50,
    enabled: d['enabled'] ?? true,
    createdAt: typeof d['createdAt'] === 'string' ? d['createdAt'] : new Date().toISOString(),
    updatedAt: typeof d['updatedAt'] === 'string' ? d['updatedAt'] : new Date().toISOString(),
  };
}

/**
 * Synchronizes active policies from Firestore into the in-memory cache.
 * Strictly Firestore-backed: zero mock or static policies.
 */
export async function syncPoliciesFromFirestore(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastPoliciesSync < SYNC_CACHE_TTL_MS) {
    return;
  }

  try {
    const db = getFirestoreDb();
    const snap = await db.collection(COLLECTIONS.AI_POLICIES).get();
    activePoliciesById.clear();

    for (const doc of snap.docs) {
      const policy = mapDocToPolicy(doc.id, doc.data());
      activePoliciesById.set(policy.id, policy);
    }

    lastPoliciesSync = now;
  } catch {
    // Non-blocking catch: preserve existing cache if transient network failure occurs
  }
}

/**
 * Resolves the matching active policy for a given appId and feature.
 * Matches exact appId first, then falls back to global/wildcard ('global' or '*').
 * In case of multiple matching policies, highest priority takes precedence.
 */
export function getPolicy(appId: string, feature: string): AiPolicy | null {
  const allPolicies = Array.from(activePoliciesById.values()).reverse();

  // 1. Exact match on appId + feature
  const exactMatches = allPolicies.filter(
    (p) => p.appId === appId && p.feature === feature,
  );

  if (exactMatches.length > 0) {
    exactMatches.sort((a, b) => {
      const pDiff = (b.priority ?? 50) - (a.priority ?? 50);
      if (pDiff !== 0) return pDiff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    return exactMatches[0]!;
  }

  // 2. Global / wildcard fallback match
  const globalMatches = allPolicies.filter(
    (p) => (p.appId === 'global' || p.appId === '*') && p.feature === feature,
  );

  if (globalMatches.length > 0) {
    globalMatches.sort((a, b) => {
      const pDiff = (b.priority ?? 50) - (a.priority ?? 50);
      if (pDiff !== 0) return pDiff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    return globalMatches[0]!;
  }

  return null;
}

/**
 * Manually sets an active policy in cache (used for unit tests and local overrides).
 */
export function setPolicy(policy: AiPolicy): void {
  activePoliciesById.set(policy.id, policy);
}

/**
 * Deletes a policy from cache.
 */
export function removePolicy(policyId: string): void {
  activePoliciesById.delete(policyId);
}

export function isGlobalKillSwitchActive(): boolean {
  return globalKillSwitch;
}

export function setGlobalKillSwitch(active: boolean): void {
  globalKillSwitch = active;
}

export function isProviderKillSwitched(providerId: string): boolean {
  return providerKillSwitches.has(providerId);
}

export function setProviderKillSwitch(providerId: string, disabled: boolean): void {
  if (disabled) {
    providerKillSwitches.add(providerId);
  } else {
    providerKillSwitches.delete(providerId);
  }
}

export interface QuotaCheckResult {
  allowed: boolean;
  code?:
    | 'KILL_SWITCH_ACTIVE'
    | 'POLICY_DISABLED'
    | 'QUOTA_EXCEEDED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'TOKEN_LIMIT_EXCEEDED';
  reason?: string;
}

/**
 * Validates request against:
 * 1. Global kill switch
 * 2. Policy-level enabled status
 * 3. Rate limits (requests per minute)
 * 4. Per-request input token cap
 * 5. Daily request and token quotas
 * 6. Monthly request and token quotas
 */
export function checkQuotas(policy: AiPolicy, estimatedInputTokens = 0): QuotaCheckResult {
  // 1. Global kill switch
  if (globalKillSwitch) {
    return {
      allowed: false,
      code: 'KILL_SWITCH_ACTIVE',
      reason: 'AI Gateway is temporarily disabled via emergency global kill switch.',
    };
  }

  // 2. Policy-level active status
  if (!policy.enabled) {
    return {
      allowed: false,
      code: 'POLICY_DISABLED',
      reason: `AI routing for feature '${policy.feature}' is currently disabled.`,
    };
  }

  // 3. Rate limits (RPM: Requests Per Minute)
  if (policy.quotas.rateLimitRpm && policy.quotas.rateLimitRpm > 0) {
    const now = Date.now();
    const window = rateLimitWindows.get(policy.id) || [];
    // Prune timestamps older than 60 seconds
    const activeWindow = window.filter((t) => now - t < 60000);
    rateLimitWindows.set(policy.id, activeWindow);

    if (activeWindow.length >= policy.quotas.rateLimitRpm) {
      return {
        allowed: false,
        code: 'RATE_LIMIT_EXCEEDED',
        reason: `Rate limit of ${policy.quotas.rateLimitRpm} requests/minute for feature '${policy.feature}' has been exceeded.`,
      };
    }
  }

  // 4. Per-request input token cap
  if (
    policy.quotas.maxInputTokensPerRequest &&
    estimatedInputTokens > policy.quotas.maxInputTokensPerRequest
  ) {
    return {
      allowed: false,
      code: 'TOKEN_LIMIT_EXCEEDED',
      reason: `Estimated input tokens (${estimatedInputTokens}) exceeds max allowed per request (${policy.quotas.maxInputTokensPerRequest}).`,
    };
  }

  // 5. Daily request and token limits
  const dayKey = getTodayKey(policy.appId, policy.feature);
  const currentDay = usageCounters.get(dayKey) || { requests: 0, tokens: 0 };

  if (policy.quotas.dailyRequestLimit && currentDay.requests >= policy.quotas.dailyRequestLimit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Daily request quota for feature '${policy.feature}' (${policy.quotas.dailyRequestLimit}) has been reached.`,
    };
  }

  if (policy.quotas.dailyTokenLimit && currentDay.tokens >= policy.quotas.dailyTokenLimit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Daily token budget for feature '${policy.feature}' (${policy.quotas.dailyTokenLimit}) has been exhausted.`,
    };
  }

  // 6. Monthly request and token limits
  const monthKey = getMonthKey(policy.appId, policy.feature);
  const currentMonth = usageCounters.get(monthKey) || { requests: 0, tokens: 0 };

  if (
    policy.quotas.monthlyRequestLimit &&
    currentMonth.requests >= policy.quotas.monthlyRequestLimit
  ) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Monthly request quota for feature '${policy.feature}' (${policy.quotas.monthlyRequestLimit}) has been reached.`,
    };
  }

  if (policy.quotas.monthlyTokenLimit && currentMonth.tokens >= policy.quotas.monthlyTokenLimit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Monthly token budget for feature '${policy.feature}' (${policy.quotas.monthlyTokenLimit}) has been exhausted.`,
    };
  }

  return { allowed: true };
}

/**
 * Increments internal counters and rate-limiter sliding windows.
 */
export function incrementUsage(
  appId: string,
  feature: string,
  inputTokens: number,
  outputTokens: number,
  policyId?: string,
): void {
  const now = Date.now();
  const dayKey = getTodayKey(appId, feature);
  const monthKey = getMonthKey(appId, feature);
  const totalTokens = inputTokens + outputTokens;

  // Daily
  const day = usageCounters.get(dayKey) || { requests: 0, tokens: 0 };
  day.requests += 1;
  day.tokens += totalTokens;
  usageCounters.set(dayKey, day);

  // Monthly
  const month = usageCounters.get(monthKey) || { requests: 0, tokens: 0 };
  month.requests += 1;
  month.tokens += totalTokens;
  usageCounters.set(monthKey, month);

  // Rate Limiting window
  if (policyId) {
    const window = rateLimitWindows.get(policyId) || [];
    window.push(now);
    rateLimitWindows.set(policyId, window);
  }
}

/**
 * Resets state for unit testing.
 */
export function resetQuotasForTest(): void {
  usageCounters.clear();
  rateLimitWindows.clear();
  globalKillSwitch = false;
  providerKillSwitches.clear();
  activePoliciesById.clear();
  lastPoliciesSync = 0;
}
