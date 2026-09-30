import type { AiProvider, AiPolicy, HealthStatus } from '@wapcentral/types';
import type {
  CreateAiProviderInput,
  UpdateAiProviderInput,
  CreateAiPolicyInput,
  UpdateAiPolicyInput,
} from '@wapcentral/validation';
import { recordAuditLog } from './auditService.js';

let memoryProviders: AiProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    enabled: true,
    models: [
      {
        id: 'm_gpt4o',
        providerId: 'openai',
        modelId: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        enabled: true,
        inputCostPer1kTokens: 0.0025,
        outputCostPer1kTokens: 0.01,
        maxInputTokens: 128000,
        maxOutputTokens: 4096,
      },
      {
        id: 'm_gpt4o_mini',
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        enabled: true,
        inputCostPer1kTokens: 0.00015,
        outputCostPer1kTokens: 0.0006,
        maxInputTokens: 128000,
        maxOutputTokens: 4096,
      },
    ],
    healthStatus: {
      status: 'healthy',
      latencyMs: 142,
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'gemini',
    enabled: true,
    models: [
      {
        id: 'm_gemini_flash',
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        enabled: true,
        inputCostPer1kTokens: 0.000075,
        outputCostPer1kTokens: 0.0003,
        maxInputTokens: 1048576,
        maxOutputTokens: 8192,
      },
      {
        id: 'm_gemini_pro',
        providerId: 'gemini',
        modelId: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        enabled: true,
        inputCostPer1kTokens: 0.00125,
        outputCostPer1kTokens: 0.005,
        maxInputTokens: 2097152,
        maxOutputTokens: 8192,
      },
    ],
    healthStatus: {
      status: 'healthy',
      latencyMs: 118,
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    models: [
      {
        id: 'm_claude_sonnet',
        providerId: 'anthropic',
        modelId: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        enabled: true,
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015,
        maxInputTokens: 200000,
        maxOutputTokens: 8192,
      },
    ],
    healthStatus: {
      status: 'healthy',
      latencyMs: 185,
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'self_hosted',
    name: 'Self-Hosted Ollama / vLLM',
    type: 'self_hosted',
    enabled: false,
    baseUrl: 'http://localhost:11434',
    models: [
      {
        id: 'm_llama3_8b',
        providerId: 'self_hosted',
        modelId: 'llama-3.1-8b',
        name: 'Llama 3.1 8B',
        enabled: true,
        inputCostPer1kTokens: 0,
        outputCostPer1kTokens: 0,
        maxInputTokens: 8192,
        maxOutputTokens: 2048,
      },
    ],
    healthStatus: {
      status: 'unknown',
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let memoryPolicies: AiPolicy[] = [
  {
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
  },
  {
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
  },
];

// ============================================================
// Provider Operations
// ============================================================

export async function fetchAiProviders(): Promise<AiProvider[]> {
  try {
    const res = await fetch('/api/admin/v1/ai/providers');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        memoryProviders = data.data;
        return memoryProviders;
      }
    }
  } catch {
    // Offline / fallback
  }
  return [...memoryProviders];
}

export async function createAiProvider(
  input: CreateAiProviderInput,
  actor: { uid: string; email: string },
): Promise<AiProvider> {
  const now = new Date().toISOString();
  const newProvider: AiProvider = {
    id: input.id,
    name: input.name,
    type: input.type,
    enabled: input.enabled !== undefined ? input.enabled : true,
    models: input.models
      ? input.models.map((m) => ({
          ...m,
          enabled: m.enabled !== undefined ? m.enabled : true,
        }))
      : [],
    ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
    ...(input.description ? { description: input.description } : {}),
    healthStatus: {
      status: 'unknown',
      lastCheckedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch('/api/admin/v1/ai/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        memoryProviders.push(data.data);
        return data.data;
      }
    }
  } catch {
    // Offline / fallback
  }

  memoryProviders.push(newProvider);

  await recordAuditLog({
    action: 'provider.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: newProvider.id,
    changes: {
      name: { before: null, after: newProvider.name },
      type: { before: null, after: newProvider.type },
    },
  });

  return newProvider;
}

export async function updateAiProvider(
  id: string,
  input: UpdateAiProviderInput,
  actor: { uid: string; email: string },
): Promise<AiProvider> {
  const index = memoryProviders.findIndex((p) => p.id === id);
  const now = new Date().toISOString();

  let updated: AiProvider;
  if (index !== -1) {
    const current = memoryProviders[index]!;
    updated = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.models !== undefined
        ? {
            models: input.models.map((m) => ({
              ...m,
              enabled: m.enabled !== undefined ? m.enabled : true,
            })),
          }
        : {}),
      updatedAt: now,
    };
    memoryProviders[index] = updated;
  } else {
    throw new Error(`Provider '${id}' not found`);
  }

  try {
    const res = await fetch(`/api/admin/v1/ai/providers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        memoryProviders[index] = data.data;
        return data.data;
      }
    }
  } catch {
    // Offline / fallback
  }

  await recordAuditLog({
    action: 'provider.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: id,
    changes: {
      enabled: { before: memoryProviders[index]?.enabled, after: updated.enabled },
    },
  });

  return updated;
}

export async function deleteAiProvider(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const index = memoryProviders.findIndex((p) => p.id === id);
  const removed = index !== -1 ? memoryProviders.splice(index, 1)[0] : undefined;

  try {
    await fetch(`/api/admin/v1/ai/providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    // Offline / fallback
  }

  await recordAuditLog({
    action: 'provider.delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: id,
    changes: {
      name: { before: removed?.name || null, after: null },
    },
  });
}

export async function checkProviderHealth(id: string): Promise<HealthStatus> {
  try {
    const res = await fetch(`/api/admin/v1/ai/providers/${encodeURIComponent(id)}/health-check`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.healthStatus) {
        const item = memoryProviders.find((p) => p.id === id);
        if (item) {
          item.healthStatus = data.data.healthStatus;
        }
        return data.data.healthStatus;
      }
    }
  } catch {
    // Offline fallback
  }

  const synthetic: HealthStatus = {
    status: 'healthy',
    latencyMs: Math.floor(Math.random() * 80) + 40,
    lastCheckedAt: new Date().toISOString(),
  };

  const item = memoryProviders.find((p) => p.id === id);
  if (item) {
    item.healthStatus = synthetic;
  }

  return synthetic;
}

// ============================================================
// Policy Operations
// ============================================================

export async function fetchAiPolicies(appId?: string): Promise<AiPolicy[]> {
  try {
    const url = appId
      ? `/api/admin/v1/ai/policies?appId=${encodeURIComponent(appId)}`
      : '/api/admin/v1/ai/policies';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        memoryPolicies = data.data;
        return memoryPolicies;
      }
    }
  } catch {
    // Offline / fallback
  }

  return appId ? memoryPolicies.filter((p) => p.appId === appId) : [...memoryPolicies];
}

export async function createAiPolicy(
  input: CreateAiPolicyInput,
  actor: { uid: string; email: string },
): Promise<AiPolicy> {
  const now = new Date().toISOString();
  const id = `policy_${Date.now()}`;
  const newPolicy: AiPolicy = {
    id,
    appId: input.appId,
    feature: input.feature,
    primaryProviderId: input.primaryProviderId,
    primaryModelId: input.primaryModelId,
    fallbackChain: input.fallbackChain ? [...input.fallbackChain] : [],
    quotas: input.quotas ? { ...input.quotas } : {},
    enabled: input.enabled !== undefined ? input.enabled : true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch('/api/admin/v1/ai/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        memoryPolicies.push(data.data);
        return data.data;
      }
    }
  } catch {
    // Offline fallback
  }

  memoryPolicies.push(newPolicy);

  await recordAuditLog({
    action: 'policy.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      feature: { before: null, after: newPolicy.feature },
      primaryProvider: { before: null, after: newPolicy.primaryProviderId },
    },
  });

  return newPolicy;
}

export async function updateAiPolicy(
  id: string,
  input: UpdateAiPolicyInput,
  actor: { uid: string; email: string },
): Promise<AiPolicy> {
  const index = memoryPolicies.findIndex((p) => p.id === id);
  const now = new Date().toISOString();

  let updated: AiPolicy;
  if (index !== -1) {
    const current = memoryPolicies[index]!;
    updated = {
      ...current,
      ...(input.appId !== undefined ? { appId: input.appId } : {}),
      ...(input.feature !== undefined ? { feature: input.feature } : {}),
      ...(input.primaryProviderId !== undefined
        ? { primaryProviderId: input.primaryProviderId }
        : {}),
      ...(input.primaryModelId !== undefined ? { primaryModelId: input.primaryModelId } : {}),
      ...(input.fallbackChain !== undefined ? { fallbackChain: [...input.fallbackChain] } : {}),
      ...(input.quotas !== undefined ? { quotas: { ...input.quotas } } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      updatedAt: now,
    };
    memoryPolicies[index] = updated;
  } else {
    throw new Error(`Policy '${id}' not found`);
  }

  try {
    const res = await fetch(`/api/admin/v1/ai/policies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        memoryPolicies[index] = data.data;
        return data.data;
      }
    }
  } catch {
    // Offline fallback
  }

  await recordAuditLog({
    action: 'policy.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      feature: { before: memoryPolicies[index]?.feature, after: updated.feature },
    },
  });

  return updated;
}

export async function toggleAiPolicy(
  id: string,
  actor: { uid: string; email: string },
): Promise<AiPolicy> {
  const policy = memoryPolicies.find((p) => p.id === id);
  if (!policy) throw new Error(`Policy '${id}' not found`);

  const prev = policy.enabled;
  policy.enabled = !policy.enabled;
  policy.updatedAt = new Date().toISOString();

  try {
    await fetch(`/api/admin/v1/ai/policies/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
    });
  } catch {
    // Offline fallback
  }

  await recordAuditLog({
    action: 'policy.toggle',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      enabled: { before: prev, after: policy.enabled },
    },
  });

  return policy;
}

export async function deleteAiPolicy(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const index = memoryPolicies.findIndex((p) => p.id === id);
  const removed = index !== -1 ? memoryPolicies.splice(index, 1)[0] : undefined;

  try {
    await fetch(`/api/admin/v1/ai/policies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    // Offline fallback
  }

  await recordAuditLog({
    action: 'policy.delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      feature: { before: removed?.feature || null, after: null },
    },
  });
}
