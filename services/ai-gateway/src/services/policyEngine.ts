import type { AiPolicy } from '@wapcentral/types';

// In-memory active routing policies
const activePolicies = new Map<string, AiPolicy>();

// Global kill switch flag
let globalKillSwitch = false;

// Provider-specific kill switch flags
const providerKillSwitches = new Set<string>();

// Daily request and token counters: key = "appId:feature:YYYY-MM-DD"
interface DailyCounter {
  requests: number;
  tokens: number;
}
const dailyCounters = new Map<string, DailyCounter>();

function getTodayKey(appId: string, feature: string): string {
  const dateStr = new Date().toISOString().split('T')[0];
  return `${appId}:${feature}:${dateStr}`;
}

// Pre-populate with default policies
export function initializeDefaultPolicies(): void {
  activePolicies.clear();

  const chatPolicy: AiPolicy = {
    id: 'policy_chat_01',
    appId: 'app_01',
    feature: 'chat_assistant',
    primaryProviderId: 'gemini',
    primaryModelId: 'gemini-1.5-flash',
    fallbackChain: [
      {
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        priority: 1,
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-3-5-haiku',
        priority: 2,
      },
    ],
    quotas: {
      dailyRequestLimit: 50000,
      dailyTokenLimit: 10000000,
      maxInputTokensPerRequest: 8192,
      maxOutputTokensPerRequest: 2048,
    },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const imagePolicy: AiPolicy = {
    id: 'policy_image_01',
    appId: 'app_01',
    feature: 'image_analysis',
    primaryProviderId: 'openai',
    primaryModelId: 'gpt-4o',
    fallbackChain: [
      {
        providerId: 'gemini',
        modelId: 'gemini-1.5-pro',
        priority: 1,
      },
    ],
    quotas: {
      dailyRequestLimit: 10000,
      maxInputTokensPerRequest: 4096,
      maxOutputTokensPerRequest: 2048,
    },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activePolicies.set(`app_01:chat_assistant`, chatPolicy);
  activePolicies.set(`app_01:image_analysis`, imagePolicy);
}

// Seed on startup
initializeDefaultPolicies();

export function getPolicy(appId: string, feature: string): AiPolicy | null {
  // Check exact app + feature
  const exact = activePolicies.get(`${appId}:${feature}`);
  if (exact) return exact;

  // Check global fallback for feature
  const globalMatch = activePolicies.get(`global:${feature}`);
  if (globalMatch) return globalMatch;

  return null;
}

export function setPolicy(policy: AiPolicy): void {
  activePolicies.set(`${policy.appId}:${policy.feature}`, policy);
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
  code?: 'KILL_SWITCH_ACTIVE' | 'POLICY_DISABLED' | 'QUOTA_EXCEEDED' | 'TOKEN_LIMIT_EXCEEDED';
  reason?: string;
}

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

  // 3. Per-request input token cap
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

  // 4. Daily limits
  const key = getTodayKey(policy.appId, policy.feature);
  const current = dailyCounters.get(key) || { requests: 0, tokens: 0 };

  if (policy.quotas.dailyRequestLimit && current.requests >= policy.quotas.dailyRequestLimit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Daily request quota for feature '${policy.feature}' (${policy.quotas.dailyRequestLimit}) has been reached.`,
    };
  }

  if (policy.quotas.dailyTokenLimit && current.tokens >= policy.quotas.dailyTokenLimit) {
    return {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      reason: `Daily token budget for feature '${policy.feature}' has been exhausted.`,
    };
  }

  return { allowed: true };
}

export function incrementUsage(
  appId: string,
  feature: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const key = getTodayKey(appId, feature);
  const current = dailyCounters.get(key) || { requests: 0, tokens: 0 };
  current.requests += 1;
  current.tokens += inputTokens + outputTokens;
  dailyCounters.set(key, current);
}

export function resetQuotasForTest(): void {
  dailyCounters.clear();
  globalKillSwitch = false;
  providerKillSwitches.clear();
  initializeDefaultPolicies();
}
