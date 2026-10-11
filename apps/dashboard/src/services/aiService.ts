import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, isOfflineMode, isTestEnv } from '../lib/firestore.js';
import { auth } from '../lib/firebase.js';
import { COLLECTIONS } from '@wapcentral/config';
import type {
  AiProvider,
  AiPolicy,
  HealthStatus,
  AiModel,
  AiPlaygroundRequest,
  AiPlaygroundResponse,
  PolicyUsageTelemetry,
  CircuitBreakerStatus,
  CircuitBreakerSnapshot,
  ModelCatalogItem,
} from '@wapcentral/types';
import { buildDynamicCatalog } from '@wapcentral/provider-sdk';
import {
  CreateAiProviderSchema,
  UpdateAiProviderSchema,
  CreateAiPolicySchema,
  UpdateAiPolicySchema,
  AiPlaygroundRequestSchema,
  type CreateAiProviderInput,
  type UpdateAiProviderInput,
  type CreateAiPolicyInput,
  type UpdateAiPolicyInput,
  type AiPlaygroundRequestInput,
} from '@wapcentral/validation';
import { recordAuditLog } from './auditService.js';

// ============================================================
// Unit Test In-Memory Store (Active ONLY when isOfflineMode = true)
// ============================================================
let testProviders: AiProvider[] = [];
let testPolicies: AiPolicy[] = [];

export function resetTestAiData(
  providers: AiProvider[] = [],
  policies: AiPolicy[] = [],
): void {
  testProviders = [...providers];
  testPolicies = [...policies];
}

/**
 * Returns the mapped Secret Manager vault key name for a provider type.
 * Never returns the secret value.
 */
export function getSecretNameForType(type: string): string | null {
  switch (type) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'gemini':
      return 'GEMINI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'self_hosted':
      return 'SELF_HOSTED_AI_CREDENTIALS';
    default:
      return null;
  }
}

// ============================================================
// Document Mapping Helpers
// ============================================================

/**
 * Safely serializes an AiModel for Firestore, ensuring optional fields
 * with undefined values are omitted entirely rather than written as undefined.
 */
export function serializeAiModel(m: AiModel): Record<string, any> {
  const model: Record<string, any> = {
    id: m.id,
    providerId: m.providerId,
    modelId: m.modelId,
    name: m.name,
    enabled: m.enabled ?? true,
  };
  if (m.inputCostPer1kTokens !== undefined && m.inputCostPer1kTokens !== null) {
    model.inputCostPer1kTokens = Number(m.inputCostPer1kTokens);
  }
  if (m.outputCostPer1kTokens !== undefined && m.outputCostPer1kTokens !== null) {
    model.outputCostPer1kTokens = Number(m.outputCostPer1kTokens);
  }
  if (m.maxInputTokens !== undefined && m.maxInputTokens !== null) {
    model.maxInputTokens = Number(m.maxInputTokens);
  }
  if (m.maxOutputTokens !== undefined && m.maxOutputTokens !== null) {
    model.maxOutputTokens = Number(m.maxOutputTokens);
  }
  return model;
}

/**
 * Recursively strips any keys with `undefined` values from an object or array.
 * Preserves Firestore FieldValue instances (like serverTimestamp()).
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    // Preserve Firestore FieldValue instances (e.g. serverTimestamp())
    const proto = Object.getPrototypeOf(data);
    if (
      (proto && proto.constructor && proto.constructor.name === 'FieldValue') ||
      '_methodName' in (data as any)
    ) {
      return data;
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value);
      }
    }
    return result as T;
  }
  return data;
}

function mapDocToProvider(docSnap: { id: string; data: () => Record<string, any> }): AiProvider {
  const data = docSnap.data();
  const provider: AiProvider = {
    id: docSnap.id,
    name: data['name'] || '',
    type: data['type'] || 'openai',
    enabled: data['enabled'] ?? true,
    models: (data['models'] || []).map((m: any) => ({
      id: m.id || `m_${m.modelId}`,
      providerId: m.providerId || docSnap.id,
      modelId: m.modelId,
      name: m.name || m.modelId,
      enabled: m.enabled ?? true,
      ...(m.inputCostPer1kTokens !== undefined && m.inputCostPer1kTokens !== null
        ? { inputCostPer1kTokens: Number(m.inputCostPer1kTokens) }
        : {}),
      ...(m.outputCostPer1kTokens !== undefined && m.outputCostPer1kTokens !== null
        ? { outputCostPer1kTokens: Number(m.outputCostPer1kTokens) }
        : {}),
      ...(m.maxInputTokens !== undefined && m.maxInputTokens !== null
        ? { maxInputTokens: Number(m.maxInputTokens) }
        : {}),
      ...(m.maxOutputTokens !== undefined && m.maxOutputTokens !== null
        ? { maxOutputTokens: Number(m.maxOutputTokens) }
        : {}),
    })),
    ...(data['baseUrl'] ? { baseUrl: data['baseUrl'] } : {}),
    ...(data['description'] ? { description: data['description'] } : {}),
    ...(data['secretName'] ? { secretName: data['secretName'] } : {}),
    ...(data['configured'] !== undefined ? { configured: data['configured'] } : {}),
    healthStatus: data['healthStatus'] || {
      status: 'unknown',
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt:
      data['createdAt']?.toDate?.()?.toISOString() ||
      (typeof data['createdAt'] === 'string' ? data['createdAt'] : new Date().toISOString()),
    updatedAt:
      data['updatedAt']?.toDate?.()?.toISOString() ||
      (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : new Date().toISOString()),
  };
  return provider;
}

function mapDocToPolicy(docSnap: { id: string; data: () => Record<string, any> }): AiPolicy {
  const data = docSnap.data();
  const policy: AiPolicy = {
    id: docSnap.id,
    appId: data['appId'],
    feature: data['feature'],
    primaryProviderId: data['primaryProviderId'],
    primaryModelId: data['primaryModelId'],
    fallbackChain: (data['fallbackChain'] || []).map((fb: any) => ({
      providerId: fb.providerId,
      modelId: fb.modelId,
      priority: Number(fb.priority) || 1,
    })),
    quotas: data['quotas'] || {},
    circuitBreaker: data['circuitBreaker']
      ? {
          failureThreshold: Number(data['circuitBreaker'].failureThreshold) || 3,
          timeoutMs: Number(data['circuitBreaker'].timeoutMs) || 10000,
          recoveryTimeMs: Number(data['circuitBreaker'].recoveryTimeMs) || 30000,
        }
      : undefined,
    priority: Number(data['priority']) || 50,
    enabled: data['enabled'] ?? true,
    createdAt:
      data['createdAt']?.toDate?.()?.toISOString() ||
      (typeof data['createdAt'] === 'string' ? data['createdAt'] : new Date().toISOString()),
    updatedAt:
      data['updatedAt']?.toDate?.()?.toISOString() ||
      (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : new Date().toISOString()),
  };
  return policy;
}

// ============================================================
// Provider Operations (Firestore Source of Truth)
// ============================================================

export function subscribeAiProviders(
  onData: (providers: AiProvider[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData([...testProviders]);
    return () => {};
  }

  try {
    let authUnsub: (() => void) | null = null;
    let firestoreUnsub: (() => void) | null = null;
    let isCleanedUp = false;

    const startFirestoreSubscription = () => {
      if (firestoreUnsub || isCleanedUp) return;

      // 1. Proactively fetch from backend API / Firestore to guarantee immediate display on load/refresh
      fetchAiProviders()
        .then((loaded) => {
          if (!isCleanedUp && loaded.length > 0) {
            onData(loaded);
          }
        })
        .catch((err) => {
          if (onError && err instanceof Error) onError(err);
        });

      // 2. Realtime listener without orderBy('createdAt') to prevent dropping unindexed docs
      const colRef = collection(db, COLLECTIONS.PROVIDERS);
      const q = query(colRef);

      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          const providers = snapshot.docs.map(mapDocToProvider);
          providers.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
            const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
            return timeB - timeA;
          });
          // Strictly Firestore data - zero mock fallback
          onData(providers);
        },
        (err) => {
          if (onError) onError(err);
        },
      );
    };

    if (auth.currentUser || isTestEnv) {
      startFirestoreSubscription();
    } else {
      authUnsub = auth.onAuthStateChanged((user) => {
        if (user && !firestoreUnsub && !isCleanedUp) {
          startFirestoreSubscription();
          if (authUnsub) {
            authUnsub();
            authUnsub = null;
          }
        }
      });
    }

    return () => {
      isCleanedUp = true;
      if (authUnsub) {
        authUnsub();
        authUnsub = null;
      }
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }
    };
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

export async function fetchAiProviders(): Promise<AiProvider[]> {
  if (isOfflineMode) {
    return [...testProviders];
  }

  // Attempt backend Admin API fetch first if in browser environment
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const headers: Record<string, string> = {};
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    }
    const res = await fetch('/api/admin/v1/ai/providers', { headers });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data as AiProvider[];
      }
    } else {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error?.message || `HTTP ${res.status}: Failed to retrieve AI Providers`);
    }
  }

  const colRef = collection(db, COLLECTIONS.PROVIDERS);
  const q = query(colRef);
  const snapshot = await getDocs(q);
  const providers = snapshot.docs.map(mapDocToProvider);
  providers.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return timeB - timeA;
  });
  return providers;
}

export async function createAiProvider(
  input: CreateAiProviderInput,
  actor: { uid: string; email: string },
): Promise<AiProvider> {
  const validated = CreateAiProviderSchema.parse(input);
  const now = new Date().toISOString();

  const secretName = validated.secretName || getSecretNameForType(validated.type);

  // If apiKey is provided, send to Secret Manager via backend Admin API
  if (validated.apiKey && secretName) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      }
      await fetch(`/api/admin/v1/secrets/${encodeURIComponent(secretName)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ value: validated.apiKey }),
      });
    } catch {
      // Backend secret rotation endpoint can be called when backend is running
    }
  }

  const isConfigured =
    !!validated.apiKey ||
    !!validated.useExistingSecret ||
    (!!secretName &&
      (secretName === 'OPENAI_API_KEY' ||
        secretName === 'GEMINI_API_KEY' ||
        secretName === 'ANTHROPIC_API_KEY'));

  // Construct safe Firestore document: NEVER store apiKey in Firestore!
  const modelsPayload = (validated.models || []).map(serializeAiModel);

  const providerDoc: Record<string, unknown> = {
    id: validated.id,
    name: validated.name,
    type: validated.type,
    enabled: validated.enabled ?? true,
    models: modelsPayload,
    ...(validated.baseUrl ? { baseUrl: validated.baseUrl } : {}),
    ...(validated.description ? { description: validated.description } : {}),
    ...(secretName ? { secretName } : {}),
    configured: isConfigured,
    healthStatus: {
      status: 'unknown',
      lastCheckedAt: now,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const sanitizedDoc = sanitizeForFirestore(providerDoc);

  const newProvider: AiProvider = {
    id: validated.id,
    name: validated.name,
    type: validated.type,
    enabled: validated.enabled ?? true,
    models: validated.models ? [...validated.models] : [],
    ...(validated.baseUrl ? { baseUrl: validated.baseUrl } : {}),
    ...(validated.description ? { description: validated.description } : {}),
    ...(secretName ? { secretName } : {}),
    configured: isConfigured,
    healthStatus: {
      status: 'unknown',
      lastCheckedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  if (isOfflineMode) {
    if (testProviders.some((p) => p.id === validated.id)) {
      throw new Error(`Provider '${validated.id}' already exists.`);
    }
    if (testProviders.some((p) => p.type === validated.type)) {
      throw new Error(`A provider with type '${validated.type}' already exists. Duplicate provider types are not allowed.`);
    }
    testProviders.push(newProvider);
  } else {
    // Check if provider with same type already exists
    const q = query(collection(db, COLLECTIONS.PROVIDERS));
    const snap = await getDocs(q);
    const existingType = snap.docs.find((d) => d.data()['type'] === validated.type);
    if (existingType) {
      throw new Error(`A provider with type '${validated.type}' already exists ('${existingType.id}'). Duplicate provider types are not allowed.`);
    }
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.PROVIDERS, validated.id);
    await setDoc(docRef, sanitizedDoc);
  }

  await recordAuditLog({
    action: 'provider.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: validated.id,
    changes: {
      name: { before: null, after: validated.name },
      type: { before: null, after: validated.type },
    },
  });

  return newProvider;
}

export async function updateAiProvider(
  id: string,
  input: UpdateAiProviderInput,
  actor: { uid: string; email: string },
): Promise<AiProvider> {
  const validated = UpdateAiProviderSchema.parse(input);
  const now = new Date().toISOString();

  const secretName =
    validated.secretName || getSecretNameForType(validated.type || 'openai');

  // If apiKey is provided, update secret in Secret Manager via backend
  if (validated.apiKey && secretName) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      }
      await fetch(`/api/admin/v1/secrets/${encodeURIComponent(secretName)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ value: validated.apiKey }),
      });
    } catch {
      // Backend secret rotation
    }
  }

  // Safe update payload: NEVER write apiKey to Firestore!
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (validated.name !== undefined) updateData['name'] = validated.name;
  if (validated.type !== undefined) {
    updateData['type'] = validated.type;
    if (secretName) updateData['secretName'] = secretName;
  }
  if (validated.enabled !== undefined) updateData['enabled'] = validated.enabled;
  if (validated.baseUrl !== undefined) updateData['baseUrl'] = validated.baseUrl;
  if (validated.description !== undefined) updateData['description'] = validated.description;
  if (validated.models !== undefined) {
    updateData['models'] = validated.models.map(serializeAiModel);
  }
  if (validated.apiKey || validated.useExistingSecret) updateData['configured'] = true;

  if (isOfflineMode) {
    if (validated.type) {
      const dup = testProviders.find((p) => p.id !== id && p.type === validated.type);
      if (dup) {
        throw new Error(`A provider with type '${validated.type}' already exists ('${dup.id}'). Duplicate provider types are not allowed.`);
      }
    }
    const existing = testProviders.find((p) => p.id === id);
    if (existing) {
      Object.assign(existing, validated, { updatedAt: now });
      delete (existing as any).apiKey;
      return existing;
    }
  } else {
    if (validated.type) {
      const q = query(collection(db, COLLECTIONS.PROVIDERS));
      const snap = await getDocs(q);
      const dup = snap.docs.find((d) => d.id !== id && d.data()['type'] === validated.type);
      if (dup) {
        throw new Error(`A provider with type '${validated.type}' already exists ('${dup.id}'). Duplicate provider types are not allowed.`);
      }
    }
    const sanitizedUpdate = sanitizeForFirestore(updateData);
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.PROVIDERS, id);
    await setDoc(docRef, sanitizedUpdate, { merge: true });
  }

  await recordAuditLog({
    action: 'provider.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: id,
    changes: {
      enabled: { before: null, after: validated.enabled },
    },
  });

  return {
    id,
    name: validated.name || '',
    type: validated.type || 'openai',
    enabled: validated.enabled ?? true,
    models: validated.models ? [...validated.models] : [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteAiProvider(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testProviders = testProviders.filter((p) => p.id !== id);
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.PROVIDERS, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'provider.delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_provider',
    resourceId: id,
    changes: {
      name: { before: null, after: null },
    },
  });
}

/**
 * Executes a real connection test against the provider adapter on the backend.
 * Uses Firebase ID Token authentication and never generates random / synthetic values.
 */
export async function checkProviderHealth(id: string): Promise<HealthStatus> {
  const now = new Date().toISOString();

  // In offline unit test mode, return deterministic test status
  if (isOfflineMode) {
    const testHealth: HealthStatus = {
      status: 'healthy',
      latencyMs: 45,
      lastCheckedAt: now,
    };
    const item = testProviders.find((p) => p.id === id);
    if (item) item.healthStatus = testHealth;
    return testHealth;
  }

  let errorMessage = 'Backend health check service unreachable';

  // Try real backend health check through Admin API with Firebase Auth token
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
      } catch (tokenErr) {
        errorMessage = `Authentication failed: ${tokenErr instanceof Error ? tokenErr.message : 'Unable to acquire token'}`;
      }
    } else {
      errorMessage = 'Authentication required: No user signed in';
    }

    const res = await fetch(`/api/admin/v1/ai/providers/${encodeURIComponent(id)}/health-check`, {
      method: 'POST',
      headers,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.healthStatus) {
        const health: HealthStatus = data.data.healthStatus;
        try {
          const docRef = doc(db, COLLECTIONS.PROVIDERS, id);
          await setDoc(docRef, { healthStatus: health, updatedAt: serverTimestamp() }, { merge: true });
        } catch {
          // Firestore status update
        }
        return health;
      }
    } else {
      try {
        const errJson = await res.json();
        errorMessage =
          errJson?.error?.message ||
          (errJson?.error?.code ? `[${errJson.error.code}] ${res.statusText || 'Request failed'}` : `HTTP ${res.status}: ${res.statusText || 'Request failed'}`);
      } catch {
        errorMessage = `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
      }
    }
  } catch {
    errorMessage = 'Backend health check service unreachable';
  }

  // In production with unreachable or failing backend: report real error status (NO Math.random() / fake success!)
  const errorHealth: HealthStatus = {
    status: 'unhealthy',
    latencyMs: 0,
    lastCheckedAt: now,
    error: errorMessage,
  };

  try {
    const docRef = doc(db, COLLECTIONS.PROVIDERS, id);
    await setDoc(docRef, { healthStatus: errorHealth, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // Firestore write error
  }

  return errorHealth;
}

// ============================================================
// Policy Operations (Firestore Source of Truth)
// ============================================================

export function computePolicyUsageTelemetry(
  policy: AiPolicy,
  events: Array<Record<string, any>>,
): PolicyUsageTelemetry {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0]!;
  const currentMonth = todayDate.substring(0, 7);

  let dailyRequests = 0;
  let dailyTokens = 0;
  let monthlyRequests = 0;
  let monthlyTokens = 0;
  let lastUsedAt: string | undefined = undefined;

  let consecutiveFailures = 0;
  let lastFailureTime: string | undefined = undefined;
  let lastFailureReason: string | undefined = undefined;

  const relevant = events
    .filter(
      (e) =>
        e &&
        (e['appId'] === policy.appId || policy.appId === 'global' || e['appId'] === 'wapcentral_admin') &&
        e['feature'] === policy.feature,
    )
    .sort((a, b) => (b['timestamp'] || '').localeCompare(a['timestamp'] || ''));

  if (relevant.length > 0) {
    lastUsedAt = relevant[0]?.['timestamp'];
  }

  for (const ev of relevant) {
    const ts = ev['timestamp'] || '';
    const dateStr = ts.split('T')[0] || '';
    const monthStr = dateStr.substring(0, 7);
    const tokens = (Number(ev['inputTokens']) || 0) + (Number(ev['outputTokens']) || 0);

    if (dateStr === todayDate) {
      dailyRequests += 1;
      dailyTokens += tokens;
    }
    if (monthStr === currentMonth) {
      monthlyRequests += 1;
      monthlyTokens += tokens;
    }
  }

  for (const ev of relevant) {
    if (!ev['success']) {
      consecutiveFailures += 1;
      if (!lastFailureTime) {
        lastFailureTime = ev['timestamp'];
        lastFailureReason = ev['error'] || 'Provider failure';
      }
    } else {
      break;
    }
  }

  const threshold = policy.circuitBreaker?.failureThreshold || 3;
  const recoveryTimeMs = policy.circuitBreaker?.recoveryTimeMs || 30000;
  let cbStatus: CircuitBreakerStatus = 'closed';
  let openedAt: string | undefined = undefined;

  if (consecutiveFailures >= threshold && lastFailureTime) {
    const elapsed = Date.now() - new Date(lastFailureTime).getTime();
    if (elapsed < recoveryTimeMs) {
      cbStatus = 'open';
      openedAt = lastFailureTime;
    } else {
      cbStatus = 'half_open';
    }
  }

  const cbSnapshot: CircuitBreakerSnapshot = {
    status: cbStatus,
    failureCount: consecutiveFailures,
    consecutiveSuccesses: consecutiveFailures === 0 && dailyRequests > 0 ? 1 : 0,
    ...(lastFailureTime ? { lastFailureTime } : {}),
    ...(lastFailureReason ? { lastFailureReason } : {}),
    ...(openedAt ? { openedAt } : {}),
  };

  return {
    policyId: policy.id,
    appId: policy.appId,
    feature: policy.feature,
    todayDate,
    currentMonth,
    dailyRequests,
    dailyTokens,
    monthlyRequests,
    monthlyTokens,
    remainingDailyRequests: policy.quotas.dailyRequestLimit
      ? Math.max(0, policy.quotas.dailyRequestLimit - dailyRequests)
      : undefined,
    remainingDailyTokens: policy.quotas.dailyTokenLimit
      ? Math.max(0, policy.quotas.dailyTokenLimit - dailyTokens)
      : undefined,
    remainingMonthlyRequests: policy.quotas.monthlyRequestLimit
      ? Math.max(0, policy.quotas.monthlyRequestLimit - monthlyRequests)
      : undefined,
    remainingMonthlyTokens: policy.quotas.monthlyTokenLimit
      ? Math.max(0, policy.quotas.monthlyTokenLimit - monthlyTokens)
      : undefined,
    circuitBreaker: cbSnapshot,
    ...(lastUsedAt ? { lastUsedAt } : {}),
  };
}

export function subscribeAiPolicies(
  onData: (policies: AiPolicy[]) => void,
  onError?: (err: Error) => void,
  appId?: string,
): () => void {
  if (isOfflineMode) {
    const filtered = appId ? testPolicies.filter((p) => p.appId === appId) : testPolicies;
    onData([...filtered]);
    return () => {};
  }

  try {
    let authUnsub: (() => void) | null = null;
    let firestoreUnsub: (() => void) | null = null;
    let isCleanedUp = false;

    const startFirestoreSubscription = () => {
      if (firestoreUnsub || isCleanedUp) return;

      // 1. Proactively fetch from backend Admin API with real server telemetry
      fetchAiPolicies(appId)
        .then((loaded) => {
          if (!isCleanedUp && loaded.length > 0) {
            onData(loaded);
          }
        })
        .catch((err) => {
          if (onError && err instanceof Error) onError(err);
        });

      // 2. Realtime listener without orderBy('createdAt')
      const colRef = collection(db, COLLECTIONS.AI_POLICIES);
      const q = query(colRef);

      firestoreUnsub = onSnapshot(
        q,
        async (snapshot) => {
          let policies = snapshot.docs.map(mapDocToPolicy);
          if (appId) {
            policies = policies.filter((p) => p.appId === appId);
          }
          policies.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

          try {
            const eventsSnap = await getDocs(collection(db, COLLECTIONS.USAGE_EVENTS));
            const events = eventsSnap.docs.map((d) => d.data());
            policies = policies.map((p) => ({
              ...p,
              usageStats: computePolicyUsageTelemetry(p, events),
            }));
          } catch {
            // non-blocking
          }

          onData(policies);
        },
        (err) => {
          if (onError) onError(err);
        },
      );
    };

    if (auth.currentUser || isTestEnv) {
      startFirestoreSubscription();
    } else {
      authUnsub = auth.onAuthStateChanged((user) => {
        if (user && !firestoreUnsub && !isCleanedUp) {
          startFirestoreSubscription();
          if (authUnsub) {
            authUnsub();
            authUnsub = null;
          }
        }
      });
    }

    return () => {
      isCleanedUp = true;
      if (authUnsub) {
        authUnsub();
        authUnsub = null;
      }
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }
    };
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

export async function fetchAiPolicies(appId?: string): Promise<AiPolicy[]> {
  if (isOfflineMode) {
    return appId ? testPolicies.filter((p) => p.appId === appId) : [...testPolicies];
  }

  // Attempt backend Admin API fetch first if in browser environment
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const headers: Record<string, string> = {};
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    }
    const url = appId ? `/api/admin/v1/ai/policies?appId=${encodeURIComponent(appId)}` : '/api/admin/v1/ai/policies';
    const res = await fetch(url, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        let list = json.data as AiPolicy[];
        if (appId) list = list.filter((p) => p.appId === appId);
        list.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
        return list;
      }
    } else {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error?.message || `HTTP ${res.status}: Failed to retrieve AI Policies`);
    }
  }

  const colRef = collection(db, COLLECTIONS.AI_POLICIES);
  const q = query(colRef);
  const snapshot = await getDocs(q);
  let policies = snapshot.docs.map(mapDocToPolicy);
  if (appId) {
    policies = policies.filter((p) => p.appId === appId);
  }
  policies.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
  return policies;
}

export async function createAiPolicy(
  input: CreateAiPolicyInput,
  actor: { uid: string; email: string },
): Promise<AiPolicy> {
  const validated = CreateAiPolicySchema.parse(input);
  const now = new Date().toISOString();
  const id = `policy_${Date.now()}`;

  const newPolicy: AiPolicy = {
    id,
    appId: validated.appId,
    feature: validated.feature,
    primaryProviderId: validated.primaryProviderId,
    primaryModelId: validated.primaryModelId,
    fallbackChain: validated.fallbackChain ? [...validated.fallbackChain] : [],
    quotas: validated.quotas ? { ...validated.quotas } : {},
    circuitBreaker: validated.circuitBreaker ? { ...validated.circuitBreaker } : undefined,
    priority: validated.priority ?? 50,
    enabled: validated.enabled !== undefined ? validated.enabled : true,
    createdAt: now,
    updatedAt: now,
  };

  if (isOfflineMode) {
    testPolicies.push(newPolicy);
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.AI_POLICIES, id);
    const sanitized = sanitizeForFirestore({
      ...newPolicy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(docRef, sanitized);
  }

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
  const validated = UpdateAiPolicySchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testPolicies.find((p) => p.id === id);
    if (!existing) throw new Error(`Policy '${id}' not found`);
    Object.assign(existing, validated, { updatedAt: now });
    return existing;
  }

  // Write directly to Firestore - NO silent try/catch!
  const docRef = doc(db, COLLECTIONS.AI_POLICIES, id);
  const sanitizedUpdate = sanitizeForFirestore({
    ...validated,
    updatedAt: serverTimestamp(),
  });
  await setDoc(docRef, sanitizedUpdate, { merge: true });

  await recordAuditLog({
    action: 'policy.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      feature: { before: null, after: validated.feature },
    },
  });

  return {
    id,
    appId: validated.appId || '',
    feature: validated.feature || '',
    primaryProviderId: validated.primaryProviderId || '',
    primaryModelId: validated.primaryModelId || '',
    fallbackChain: validated.fallbackChain ? [...validated.fallbackChain] : [],
    quotas: validated.quotas ? { ...validated.quotas } : {},
    circuitBreaker: validated.circuitBreaker ? { ...validated.circuitBreaker } : undefined,
    priority: validated.priority ?? 50,
    enabled: validated.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function toggleAiPolicy(
  id: string,
  actor: { uid: string; email: string },
): Promise<AiPolicy> {
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const policy = testPolicies.find((p) => p.id === id);
    if (!policy) throw new Error(`Policy '${id}' not found`);
    policy.enabled = !policy.enabled;
    policy.updatedAt = now;
    return policy;
  }

  // Fetch current state from Firestore to invert
  const docRef = doc(db, COLLECTIONS.AI_POLICIES, id);
  const snap = await getDocs(query(collection(db, COLLECTIONS.AI_POLICIES)));
  const found = snap.docs.find((d) => d.id === id);
  const currentEnabled = found ? found.data()['enabled'] ?? true : true;
  const nextEnabled = !currentEnabled;

  await setDoc(
    docRef,
    {
      enabled: nextEnabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await recordAuditLog({
    action: 'policy.toggle',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      enabled: { before: currentEnabled, after: nextEnabled },
    },
  });

  return {
    id,
    appId: found?.data()['appId'] || '',
    feature: found?.data()['feature'] || '',
    primaryProviderId: found?.data()['primaryProviderId'] || '',
    primaryModelId: found?.data()['primaryModelId'] || '',
    fallbackChain: found?.data()['fallbackChain'] || [],
    quotas: found?.data()['quotas'] || {},
    enabled: nextEnabled,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteAiPolicy(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testPolicies = testPolicies.filter((p) => p.id !== id);
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.AI_POLICIES, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'policy.delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'ai_policy',
    resourceId: id,
    changes: {
      feature: { before: null, after: null },
    },
  });
}

// ============================================================
// AI Playground Operations (Real Backend Inference)
// ============================================================

/**
 * Sends an AI Playground inference request to the backend.
 * Uses Firebase Auth ID Token for authentication and Super Admin verification.
 * Does NOT call OpenAI or any AI provider directly from the browser.
 * API keys remain server-side in Secret Manager.
 */
export async function runPlaygroundInference(
  input: AiPlaygroundRequestInput,
): Promise<AiPlaygroundResponse> {
  const validated = AiPlaygroundRequestSchema.parse(input);



  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (err: unknown) {
      throw new Error(`Authentication failed: ${err instanceof Error ? err.message : 'Unable to acquire token'}`);
    }
  } else if (!isTestEnv) {
    throw new Error('Authentication required: You must be logged in as Super Admin.');
  }

  const res = await fetch('/api/admin/v1/ai/playground/infer', {
    method: 'POST',
    headers,
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText || 'Inference request failed'}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errorMessage = errJson.error.message;
      } else if (errJson?.error?.code) {
        errorMessage = `[${errJson.error.code}] ${res.statusText || 'Inference failed'}`;
      }
    } catch {
      // JSON parse error
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error?.message || 'Invalid response from AI Gateway');
  }

  return data.data as AiPlaygroundResponse;
}

/**
 * Retrieves the unified Model Pricing & Context Catalog.
 * Dynamically builds from current provider configurations and official verified rate cards.
 * If backend endpoint is available, can fetch from /api/admin/v1/ai/models/catalog;
 * otherwise dynamically builds locally from active providers.
 */
export async function getModelCatalog(currentProviders?: AiProvider[]): Promise<ModelCatalogItem[]> {
  try {
    let providers = currentProviders;
    if (!providers) {
      if (isOfflineMode) {
        providers = [...testProviders];
      } else {
        const snap = await getDocs(collection(db, COLLECTIONS.PROVIDERS));
        providers = snap.docs.map(mapDocToProvider);
      }
    }
    return buildDynamicCatalog(providers);
  } catch {
    if (currentProviders && currentProviders.length > 0) {
      return buildDynamicCatalog(currentProviders);
    }
    return buildDynamicCatalog([]);
  }
}

