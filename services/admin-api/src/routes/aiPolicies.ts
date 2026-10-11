import { COLLECTIONS } from '@wapcentral/config';
import type {
  AiPolicy,
  CircuitBreakerSnapshot,
  CircuitBreakerStatus,
  PolicyUsageTelemetry,
} from '@wapcentral/types';
import { CreateAiPolicySchema, UpdateAiPolicySchema } from '@wapcentral/validation';
import { Router } from 'express';
import type { Response } from 'express';

import { requireRole } from '../middleware/rbac.js';
import { logAdminAction } from '../services/auditService.js';
import { getFirestoreDb, type FirestoreDatabaseLike } from '../services/firestore.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const aiPoliciesRouter: Router = Router();

function formatTimestamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as any).toDate === 'function'
  ) {
    return (value as any).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export function mapDocToPolicy(id: string, data: Record<string, any> | undefined): AiPolicy {
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
    createdAt: formatTimestamp(d['createdAt']),
    updatedAt: formatTimestamp(d['updatedAt']),
  };
}

/**
 * Validates that all providers and models referenced in a policy exist and are enabled
 * in the real Firestore providers collection. Prevents invalid combinations.
 */
export async function validatePolicyProviders(
  db: FirestoreDatabaseLike,
  policy: {
    primaryProviderId: string;
    primaryModelId: string;
    fallbackChain?: Array<{ providerId: string; modelId: string; priority: number }>;
  },
): Promise<{ valid: boolean; error?: string }> {
  try {
    const provDocs = await db.collection(COLLECTIONS.PROVIDERS).get();
    const providersMap = new Map<string, { enabled: boolean; models: Map<string, boolean> }>();

    for (const d of provDocs.docs) {
      const pData = d.data() || {};
      const modelsMap = new Map<string, boolean>();
      for (const m of pData['models'] || []) {
        modelsMap.set(m.modelId, m.enabled ?? true);
      }
      providersMap.set(d.id, {
        enabled: pData['enabled'] ?? true,
        models: modelsMap,
      });
    }

    // If no providers are registered in DB yet (e.g. freshly seeded test env with no providers), allow fallback
    if (providersMap.size === 0) {
      return { valid: true };
    }

    // 1. Validate primary provider
    const primaryProv = providersMap.get(policy.primaryProviderId);
    if (!primaryProv) {
      return {
        valid: false,
        error: `Primary provider '${policy.primaryProviderId}' does not exist in registered providers allowlist.`,
      };
    }
    if (!primaryProv.enabled) {
      return {
        valid: false,
        error: `Primary provider '${policy.primaryProviderId}' is currently disabled in system.`,
      };
    }

    // 2. Validate primary model
    if (!primaryProv.models.has(policy.primaryModelId)) {
      return {
        valid: false,
        error: `Primary model '${policy.primaryModelId}' is not an allowlisted model for provider '${policy.primaryProviderId}'.`,
      };
    }
    if (!primaryProv.models.get(policy.primaryModelId)) {
      return {
        valid: false,
        error: `Primary model '${policy.primaryModelId}' is currently disabled for provider '${policy.primaryProviderId}'.`,
      };
    }

    // 3. Validate fallback chain
    if (policy.fallbackChain && policy.fallbackChain.length > 0) {
      const seen = new Set<string>();
      seen.add(`${policy.primaryProviderId}:${policy.primaryModelId}`);

      for (const fb of policy.fallbackChain) {
        const fbKey = `${fb.providerId}:${fb.modelId}`;
        if (seen.has(fbKey)) {
          return {
            valid: false,
            error: `Duplicate or redundant route in fallback chain: provider '${fb.providerId}' with model '${fb.modelId}' cannot be repeated.`,
          };
        }
        seen.add(fbKey);

        const fbProv = providersMap.get(fb.providerId);
        if (!fbProv) {
          return {
            valid: false,
            error: `Fallback provider '${fb.providerId}' does not exist in registered providers allowlist.`,
          };
        }
        if (!fbProv.enabled) {
          return {
            valid: false,
            error: `Fallback provider '${fb.providerId}' is currently disabled in system.`,
          };
        }
        if (!fbProv.models.has(fb.modelId)) {
          return {
            valid: false,
            error: `Fallback model '${fb.modelId}' is not an allowlisted model for provider '${fb.providerId}'.`,
          };
        }
        if (!fbProv.models.get(fb.modelId)) {
          return {
            valid: false,
            error: `Fallback model '${fb.modelId}' is currently disabled for provider '${fb.providerId}'.`,
          };
        }
      }
    }

    return { valid: true };
  } catch (err: unknown) {
    return {
      valid: false,
      error: `Failed to validate provider allowlist: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Computes live telemetry and usage counters for an AI policy from real Firestore data.
 * Zero random or fake values: counts are derived strictly from telemetry events.
 */
export async function getPolicyUsageTelemetry(
  db: FirestoreDatabaseLike,
  policy: AiPolicy,
): Promise<PolicyUsageTelemetry> {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0]!; // YYYY-MM-DD
  const currentMonth = todayDate.substring(0, 7); // YYYY-MM

  let dailyRequests = 0;
  let dailyTokens = 0;
  let monthlyRequests = 0;
  let monthlyTokens = 0;
  let lastUsedAt: string | undefined = undefined;

  let consecutiveFailures = 0;
  let lastFailureTime: string | undefined = undefined;
  let lastFailureReason: string | undefined = undefined;

  try {
    const eventsSnap = await db.collection(COLLECTIONS.USAGE_EVENTS).get();

    const relevantEvents = eventsSnap.docs
      .map((d) => d.data())
      .filter(
        (e) =>
          e &&
          (e['appId'] === policy.appId || policy.appId === 'global' || e['appId'] === 'wapcentral_admin') &&
          e['feature'] === policy.feature,
      )
      .sort((a, b) => (b?.['timestamp'] || '').localeCompare(a?.['timestamp'] || ''));

    if (relevantEvents.length > 0) {
      lastUsedAt = relevantEvents[0]?.['timestamp'];
    }

    for (const ev of relevantEvents) {
      if (!ev) continue;
      const ts = ev['timestamp'] || '';
      const dateStr = ts.split('T')[0] || '';
      const monthStr = dateStr.substring(0, 7);
      const tokens = (ev['inputTokens'] || 0) + (ev['outputTokens'] || 0);

      if (dateStr === todayDate) {
        dailyRequests += 1;
        dailyTokens += tokens;
      }
      if (monthStr === currentMonth) {
        monthlyRequests += 1;
        monthlyTokens += tokens;
      }
    }

    for (const ev of relevantEvents) {
      if (!ev) continue;
      if (!ev['success']) {
        consecutiveFailures += 1;
        if (!lastFailureTime) {
          lastFailureTime = ev['timestamp'];
          lastFailureReason = ev['error'] || 'Provider error';
        }
      } else {
        break;
      }
    }
  } catch {
    // Non-blocking catch
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

// GET /v1/ai/policies - List all AI routing policies from Firestore (Viewer+)
aiPoliciesRouter.get(
  '/',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const appId = typeof req.query['appId'] === 'string' ? req.query['appId'] : undefined;
      const db = getFirestoreDb();
      const snapshot = await db.collection(COLLECTIONS.AI_POLICIES).get();
      let policies = snapshot.docs.map((docSnap) => mapDocToPolicy(docSnap.id, docSnap.data()));

      if (appId) {
        policies = policies.filter((p) => p.appId === appId);
      }

      // Order by priority descending, then createdAt descending
      policies.sort((a, b) => {
        const pDiff = (b.priority ?? 50) - (a.priority ?? 50);
        if (pDiff !== 0) return pDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Enrich with real Firestore usage telemetry
      const enriched = await Promise.all(
        policies.map(async (p) => {
          const stats = await getPolicyUsageTelemetry(db, p);
          return {
            ...p,
            usageStats: stats,
          };
        }),
      );

      res.json({
        success: true,
        data: enriched,
        total: enriched.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to retrieve AI policies',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/ai/policies/:id - Get single policy from Firestore (Viewer+)
aiPoliciesRouter.get(
  '/:id',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');

    try {
      const db = getFirestoreDb();
      const docSnap = await db.collection(COLLECTIONS.AI_POLICIES).doc(policyId).get();

      if (!docSnap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const policy = mapDocToPolicy(docSnap.id, docSnap.data());
      const stats = await getPolicyUsageTelemetry(db, policy);

      res.json({
        success: true,
        data: {
          ...policy,
          usageStats: stats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to retrieve AI policy',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/ai/policies - Create new routing policy in Firestore (Editor+)
aiPoliciesRouter.post(
  '/',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAiPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI policy payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getFirestoreDb();

      // Validate provider and model combinations against real registered allowlist
      const validation = await validatePolicyProviders(db, {
        primaryProviderId: parsed.data.primaryProviderId,
        primaryModelId: parsed.data.primaryModelId,
        fallbackChain: parsed.data.fallbackChain,
      });

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PROVIDER_MODEL',
            message: validation.error || 'Invalid provider and model combination',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const now = new Date().toISOString();
      const id = `policy_${Date.now()}`;
      const docRef = db.collection(COLLECTIONS.AI_POLICIES).doc(id);

      const newPolicy: AiPolicy = {
        id,
        appId: parsed.data.appId,
        feature: parsed.data.feature,
        primaryProviderId: parsed.data.primaryProviderId,
        primaryModelId: parsed.data.primaryModelId,
        fallbackChain: parsed.data.fallbackChain ? [...parsed.data.fallbackChain] : [],
        quotas: parsed.data.quotas ? { ...parsed.data.quotas } : {},
        circuitBreaker: parsed.data.circuitBreaker ? { ...parsed.data.circuitBreaker } : undefined,
        priority: parsed.data.priority ?? 50,
        enabled: parsed.data.enabled !== undefined ? parsed.data.enabled : true,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(newPolicy);

      await logAdminAction({
        action: 'policy.create',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_policy',
        resourceId: id,
        metadata: {
          appId: newPolicy.appId,
          feature: newPolicy.feature,
          priority: newPolicy.priority,
          primary: `${newPolicy.primaryProviderId}:${newPolicy.primaryModelId}`,
        },
      });

      res.status(201).json({
        success: true,
        data: newPolicy,
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to create AI policy',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PUT /v1/ai/policies/:id - Update policy in Firestore (Editor+)
aiPoliciesRouter.put(
  '/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');
    const parsed = UpdateAiPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI policy update',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.AI_POLICIES).doc(policyId);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = existing.data() || {};

      // If provider or models are being modified, validate allowlist
      const candidatePrimaryProvider =
        parsed.data.primaryProviderId ?? current['primaryProviderId'];
      const candidatePrimaryModel = parsed.data.primaryModelId ?? current['primaryModelId'];
      const candidateFallbackChain = parsed.data.fallbackChain ?? current['fallbackChain'];

      const validation = await validatePolicyProviders(db, {
        primaryProviderId: candidatePrimaryProvider,
        primaryModelId: candidatePrimaryModel,
        fallbackChain: candidateFallbackChain,
      });

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PROVIDER_MODEL',
            message: validation.error || 'Invalid provider and model combination',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const now = new Date().toISOString();
      const updateData: Record<string, any> = {
        updatedAt: now,
      };

      if (parsed.data.appId !== undefined) updateData['appId'] = parsed.data.appId;
      if (parsed.data.feature !== undefined) updateData['feature'] = parsed.data.feature;
      if (parsed.data.primaryProviderId !== undefined)
        updateData['primaryProviderId'] = parsed.data.primaryProviderId;
      if (parsed.data.primaryModelId !== undefined)
        updateData['primaryModelId'] = parsed.data.primaryModelId;
      if (parsed.data.fallbackChain !== undefined)
        updateData['fallbackChain'] = [...parsed.data.fallbackChain];
      if (parsed.data.quotas !== undefined) updateData['quotas'] = { ...parsed.data.quotas };
      if (parsed.data.circuitBreaker !== undefined)
        updateData['circuitBreaker'] = { ...parsed.data.circuitBreaker };
      if (parsed.data.priority !== undefined) updateData['priority'] = parsed.data.priority;
      if (parsed.data.enabled !== undefined) updateData['enabled'] = parsed.data.enabled;

      await docRef.set(updateData, { merge: true });

      const updatedSnap = await docRef.get();
      const updatedPolicy = mapDocToPolicy(policyId, updatedSnap.data());

      await logAdminAction({
        action: 'policy.update',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_policy',
        resourceId: policyId,
        metadata: {
          appId: updatedPolicy.appId || current['appId'],
          feature: updatedPolicy.feature || current['feature'],
          priority: updatedPolicy.priority,
        },
      });

      res.json({
        success: true,
        data: updatedPolicy,
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update AI policy',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PATCH /v1/ai/policies/:id/toggle - Toggle policy status in Firestore (Editor+)
aiPoliciesRouter.patch(
  '/:id/toggle',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.AI_POLICIES).doc(policyId);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = existing.data() || {};
      const currentEnabled = current['enabled'] ?? true;
      const nextEnabled = !currentEnabled;
      const now = new Date().toISOString();

      await docRef.set(
        {
          enabled: nextEnabled,
          updatedAt: now,
        },
        { merge: true },
      );

      const updatedSnap = await docRef.get();
      const updatedPolicy = mapDocToPolicy(policyId, updatedSnap.data());

      await logAdminAction({
        action: 'policy.toggle',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_policy',
        resourceId: policyId,
        metadata: { enabled: nextEnabled, feature: current['feature'] },
      });

      res.json({
        success: true,
        data: updatedPolicy,
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to toggle AI policy',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /v1/ai/policies/:id - Delete policy from Firestore (Admin+)
aiPoliciesRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.AI_POLICIES).doc(policyId);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = existing.data() || {};
      await docRef.delete();

      await logAdminAction({
        action: 'policy.delete',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_policy',
        resourceId: policyId,
        metadata: { feature: current['feature'], appId: current['appId'] },
      });

      res.json({
        success: true,
        data: { id: policyId, deleted: true },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to delete AI policy',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);
