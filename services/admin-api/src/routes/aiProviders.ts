import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
  type IProvider,
  buildDynamicCatalog,
} from '@wapcentral/provider-sdk';
import { COLLECTIONS } from '@wapcentral/config';
import type {
  AiProvider,
  HealthStatus,
  GatewayPayload,
  GatewayResponse,
  ChatMessage,
} from '@wapcentral/types';
import {
  CreateAiProviderSchema,
  UpdateAiProviderSchema,
  AiPlaygroundRequestSchema,
} from '@wapcentral/validation';
import { Router } from 'express';
import type { Response } from 'express';

import { isAllowedSecretName, type AllowedSecretName } from '../config.js';
import { requireRole } from '../middleware/rbac.js';
import { logAdminAction } from '../services/auditService.js';
import { getFirestoreDb } from '../services/firestore.js';
import { writeSecret, getInternalSecret } from '../services/secretVault.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const aiProvidersRouter: Router = Router();

// Map provider type to allowed Secret Manager vault key
export function getSecretNameForType(type: string): AllowedSecretName | null {
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

export function mapDocToProvider(id: string, data: Record<string, any> | undefined): AiProvider {
  const d = data || {};
  return {
    id,
    name: d['name'] || '',
    type: d['type'] || 'openai',
    enabled: d['enabled'] ?? true,
    models: (d['models'] || []).map((m: any) => ({
      id: m.id || `m_${m.modelId}`,
      providerId: m.providerId || id,
      modelId: m.modelId,
      name: m.name || m.modelId,
      enabled: m.enabled ?? true,
      ...(m.inputCostPer1kTokens !== undefined
        ? { inputCostPer1kTokens: m.inputCostPer1kTokens }
        : {}),
      ...(m.outputCostPer1kTokens !== undefined
        ? { outputCostPer1kTokens: m.outputCostPer1kTokens }
        : {}),
      ...(m.maxInputTokens !== undefined ? { maxInputTokens: m.maxInputTokens } : {}),
      ...(m.maxOutputTokens !== undefined ? { maxOutputTokens: m.maxOutputTokens } : {}),
    })),
    ...(d['baseUrl'] ? { baseUrl: d['baseUrl'] } : {}),
    ...(d['description'] ? { description: d['description'] } : {}),
    ...(d['secretName'] ? { secretName: d['secretName'] } : {}),
    ...(d['configured'] !== undefined ? { configured: d['configured'] } : {}),
    healthStatus: d['healthStatus'] || {
      status: 'unknown',
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: formatTimestamp(d['createdAt']),
    updatedAt: formatTimestamp(d['updatedAt']),
  };
}

// GET /v1/ai/providers - List all AI providers from Firestore (Viewer+)
aiProvidersRouter.get(
  '/',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection(COLLECTIONS.PROVIDERS).get();
      const providers = snapshot.docs
        .map((docSnap) => mapDocToProvider(docSnap.id, docSnap.data()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        success: true,
        data: providers,
        total: providers.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to retrieve AI providers',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/ai/providers/catalog - Dynamic Model Pricing & Context Catalog (Viewer+)
aiProvidersRouter.get(
  '/catalog',
  requireRole('viewer'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection(COLLECTIONS.PROVIDERS).get();
      const providers = snapshot.docs.map((docSnap) => mapDocToProvider(docSnap.id, docSnap.data()));
      const catalog = buildDynamicCatalog(providers);

      res.json({
        success: true,
        data: catalog,
        total: catalog.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to generate model catalog',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/ai/providers/:id - Get single provider details from Firestore (Viewer+)
aiProvidersRouter.get(
  '/:id',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const providerId = String(req.params['id'] || '');
      const db = getFirestoreDb();
      const docSnap = await db.collection(COLLECTIONS.PROVIDERS).doc(providerId).get();

      if (!docSnap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: mapDocToProvider(docSnap.id, docSnap.data()),
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to retrieve AI provider',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/ai/providers - Register new AI provider in Firestore (Admin+)
aiProvidersRouter.post(
  '/',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAiProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Provider configuration',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.PROVIDERS).doc(parsed.data.id);
      const existing = await docRef.get();

      if (existing.exists) {
        res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: `Provider '${parsed.data.id}' already exists.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check for duplicate provider types
      const allDocs = await db.collection(COLLECTIONS.PROVIDERS).get();
      const existingDoc = allDocs.docs.find((d) => (d.data() || {})['type'] === parsed.data.type);

      if (existingDoc) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_PROVIDER_TYPE',
            message: `A provider with type '${parsed.data.type}' already exists ('${existingDoc.id}'). Duplicate provider types are not allowed.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Resolve secret vault key: explicit secretName or mapped type
      const secretName =
        parsed.data.secretName && isAllowedSecretName(parsed.data.secretName)
          ? (parsed.data.secretName as AllowedSecretName)
          : getSecretNameForType(parsed.data.type);

      // If secret API key was supplied, store in Secret Manager Key Vault ONLY
      if (parsed.data.apiKey && secretName) {
        await writeSecret(secretName, parsed.data.apiKey, {
          uid: req.user?.uid || 'system',
          email: req.user?.email || 'system',
        });
      }

      const isConfigured =
        !!parsed.data.apiKey ||
        !!parsed.data.useExistingSecret ||
        (!!secretName && !!getInternalSecret(secretName));

      const now = new Date().toISOString();

      const modelsPayload = (parsed.data.models || []).map((m) => {
        const clean: Record<string, any> = {
          id: m.id,
          providerId: m.providerId,
          modelId: m.modelId,
          name: m.name,
          enabled: m.enabled ?? true,
        };
        if (m.inputCostPer1kTokens !== undefined) clean['inputCostPer1kTokens'] = m.inputCostPer1kTokens;
        if (m.outputCostPer1kTokens !== undefined) clean['outputCostPer1kTokens'] = m.outputCostPer1kTokens;
        if (m.maxInputTokens !== undefined) clean['maxInputTokens'] = m.maxInputTokens;
        if (m.maxOutputTokens !== undefined) clean['maxOutputTokens'] = m.maxOutputTokens;
        return clean;
      });

      // Safe Firestore document: NEVER store apiKey in Firestore!
      const providerDoc: Record<string, any> = {
        id: parsed.data.id,
        name: parsed.data.name,
        type: parsed.data.type,
        enabled: parsed.data.enabled,
        models: modelsPayload,
        ...(parsed.data.baseUrl ? { baseUrl: parsed.data.baseUrl } : {}),
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        ...(secretName ? { secretName } : {}),
        configured: isConfigured,
        healthStatus: {
          status: 'unknown',
          lastCheckedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(providerDoc);

      const createdProvider: AiProvider = {
        id: parsed.data.id,
        name: parsed.data.name,
        type: parsed.data.type,
        enabled: parsed.data.enabled,
        models: parsed.data.models ? [...parsed.data.models] : [],
        ...(parsed.data.baseUrl ? { baseUrl: parsed.data.baseUrl } : {}),
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        ...(secretName ? { secretName } : {}),
        configured: isConfigured,
        healthStatus: {
          status: 'unknown',
          lastCheckedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      await logAdminAction({
        action: 'provider.create',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_provider',
        resourceId: createdProvider.id,
        metadata: { name: createdProvider.name, type: createdProvider.type },
      });

      res.status(201).json({
        success: true,
        data: createdProvider,
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to register AI provider',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PUT /v1/ai/providers/:id - Update provider configuration in Firestore (Admin+)
aiProvidersRouter.put(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');
    const parsed = UpdateAiProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid provider update data',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.PROVIDERS).doc(providerId);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = existing.data() || {};

      // Check for duplicate provider types
      if (parsed.data.type !== undefined && parsed.data.type !== current['type']) {
        const allDocs = await db.collection(COLLECTIONS.PROVIDERS).get();
        const duplicate = allDocs.docs.find((d) => d.id !== providerId && (d.data() || {})['type'] === parsed.data.type);
        if (duplicate) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_PROVIDER_TYPE',
              message: `A provider with type '${parsed.data.type}' already exists ('${duplicate.id}'). Duplicate provider types are not allowed.`,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // If apiKey provided, write to Secret Manager ONLY
      if (parsed.data.apiKey) {
        const secretName = getSecretNameForType(parsed.data.type || current['type']);
        if (secretName) {
          await writeSecret(secretName, parsed.data.apiKey, {
            uid: req.user?.uid || 'system',
            email: req.user?.email || 'system',
          });
        }
      }

      const now = new Date().toISOString();

      // Safe update payload: NEVER store apiKey in Firestore!
      const updateData: Record<string, any> = {
        updatedAt: now,
      };
      if (parsed.data.name !== undefined) updateData['name'] = parsed.data.name;
      if (parsed.data.type !== undefined) {
        updateData['type'] = parsed.data.type;
        updateData['secretName'] = getSecretNameForType(parsed.data.type);
      }
      if (parsed.data.enabled !== undefined) updateData['enabled'] = parsed.data.enabled;
      if (parsed.data.baseUrl !== undefined) updateData['baseUrl'] = parsed.data.baseUrl;
      if (parsed.data.description !== undefined)
        updateData['description'] = parsed.data.description;
      if (parsed.data.models !== undefined) {
        updateData['models'] = parsed.data.models.map((m) => {
          const clean: Record<string, any> = {
            id: m.id,
            providerId: m.providerId,
            modelId: m.modelId,
            name: m.name,
            enabled: m.enabled ?? true,
          };
          if (m.inputCostPer1kTokens !== undefined) clean['inputCostPer1kTokens'] = m.inputCostPer1kTokens;
          if (m.outputCostPer1kTokens !== undefined) clean['outputCostPer1kTokens'] = m.outputCostPer1kTokens;
          if (m.maxInputTokens !== undefined) clean['maxInputTokens'] = m.maxInputTokens;
          if (m.maxOutputTokens !== undefined) clean['maxOutputTokens'] = m.maxOutputTokens;
          return clean;
        });
      }
      if (parsed.data.apiKey) updateData['configured'] = true;

      await docRef.set(updateData, { merge: true });

      const updatedSnap = await docRef.get();
      const updatedProvider = mapDocToProvider(providerId, updatedSnap.data());

      await logAdminAction({
        action: 'provider.update',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_provider',
        resourceId: providerId,
        metadata: { name: updatedProvider.name, enabled: updatedProvider.enabled },
      });

      res.json({
        success: true,
        data: updatedProvider,
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update AI provider',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /v1/ai/providers/:id - Delete AI provider from Firestore (Super Admin only)
aiProvidersRouter.delete(
  '/:id',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.PROVIDERS).doc(providerId);
      const existing = await docRef.get();

      if (!existing.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = existing.data() || {};
      await docRef.delete();

      await logAdminAction({
        action: 'provider.delete',
        actorUid: req.user?.uid || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        resourceType: 'ai_provider',
        resourceId: providerId,
        metadata: { name: current['name'] },
      });

      res.json({
        success: true,
        data: { id: providerId, deleted: true },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Failed to delete AI provider',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/ai/providers/:id/health-check - Trigger real backend adapter health check (Viewer+)
// Uses configured provider & Secret Manager credential. NEVER synthetic or Math.random().
aiProvidersRouter.post(
  '/:id/health-check',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');

    try {
      const db = getFirestoreDb();
      const docRef = db.collection(COLLECTIONS.PROVIDERS).doc(providerId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const provider = mapDocToProvider(docSnap.id, docSnap.data());
      const docData = docSnap.data() || {};
      const secretName =
        docData['secretName'] && isAllowedSecretName(docData['secretName'])
          ? (docData['secretName'] as AllowedSecretName)
          : getSecretNameForType(provider.type);
      const secretKey =
        secretName && isAllowedSecretName(secretName)
          ? (await getInternalSecret(secretName)) || undefined
          : undefined;

      let health: HealthStatus;

      try {
        let adapter;
        if (provider.type === 'openai') {
          adapter = new OpenAIProvider({ apiKey: secretKey });
        } else if (provider.type === 'gemini') {
          adapter = new GeminiProvider({ apiKey: secretKey });
        } else if (provider.type === 'anthropic') {
          adapter = new AnthropicProvider({ apiKey: secretKey });
        } else {
          adapter = new SelfHostedProvider({
            ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
          });
        }

        health = await adapter.healthCheck();
      } catch (err: unknown) {
        health = {
          status: 'unhealthy',
          latencyMs: 0,
          lastCheckedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const now = new Date().toISOString();
      await docRef.set(
        {
          healthStatus: health,
          updatedAt: now,
        },
        { merge: true },
      );

      res.json({
        success: true,
        data: {
          providerId: provider.id,
          healthStatus: health,
        },
        timestamp: now,
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Health check failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// ============================================================
// AI Playground Inference Handler (Super Admin ONLY)
// Executes real provider inference via provider adapter.
// Uses real Secret Manager credentials.
// Records telemetry to COLLECTIONS.USAGE_EVENTS and audit logs.
// ZERO secret exposure to client.
// ============================================================
export async function handlePlaygroundInference(
  req: AuthenticatedRequest,
  res: Response,
  explicitProviderId?: string,
): Promise<void> {
  const parsed = AiPlaygroundRequestSchema.safeParse({
    ...req.body,
    ...(explicitProviderId ? { providerId: explicitProviderId } : {}),
  });

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid AI Playground inference request',
        details: parsed.error.format(),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const { providerId, modelId, prompt, systemPrompt, temperature, maxTokens } = parsed.data;

  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTIONS.PROVIDERS).doc(providerId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `AI Provider '${providerId}' not found.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const provider = mapDocToProvider(docSnap.id, docSnap.data());

    if (!provider.enabled) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PROVIDER_DISABLED',
          message: `AI Provider '${provider.name}' (${provider.id}) is disabled. Enable it before running inference.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const targetModel = provider.models.find((m) => m.modelId === modelId);
    if (!targetModel) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MODEL_NOT_ALLOWLISTED',
          message: `Model '${modelId}' is not allowlisted for provider '${provider.name}'. Allowed models: ${provider.models.map((m) => m.modelId).join(', ') || 'None'}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!targetModel.enabled) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MODEL_DISABLED',
          message: `Model '${targetModel.name || modelId}' is currently disabled for provider '${provider.name}'.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const docData = docSnap.data() || {};
    const secretName =
      docData['secretName'] && isAllowedSecretName(docData['secretName'])
        ? (docData['secretName'] as AllowedSecretName)
        : getSecretNameForType(provider.type);

    const secretKey =
      secretName && isAllowedSecretName(secretName)
        ? (await getInternalSecret(secretName)) || undefined
        : undefined;

    if (provider.type !== 'self_hosted' && !secretKey) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CREDENTIAL_MISSING',
          message: `No API key found in Secret Manager for provider '${provider.name}' (${secretName || 'unknown'}). Please configure credentials first.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let adapter: IProvider;
    if (provider.type === 'openai') {
      adapter = new OpenAIProvider({ apiKey: secretKey });
    } else if (provider.type === 'gemini') {
      adapter = new GeminiProvider({ apiKey: secretKey });
    } else if (provider.type === 'anthropic') {
      adapter = new AnthropicProvider({ apiKey: secretKey });
    } else {
      adapter = new SelfHostedProvider({
        ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
        ...(secretKey ? { apiKey: secretKey } : {}),
      });
    }

    const messages: ChatMessage[] = [];
    if (systemPrompt && systemPrompt.trim().length > 0) {
      messages.push({ role: 'system', content: systemPrompt.trim() });
    }
    messages.push({ role: 'user', content: prompt.trim() });

    const payload: GatewayPayload = {
      type: 'generate',
      prompt: prompt.trim(),
      messages,
      ...(maxTokens ? { maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
    };

    const startTime = Date.now();
    let gatewayRes: GatewayResponse;
    try {
      gatewayRes = await adapter.generate({
        modelId,
        payload,
        timeoutMs: 30000,
      });
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      try {
        const failId = `use_fail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.collection(COLLECTIONS.USAGE_EVENTS).doc(failId).set({
          id: failId,
          appId: 'wapcentral_admin',
          providerId: provider.id,
          modelId,
          feature: 'ai_playground',
          requestId: `req_fail_${Date.now()}`,
          latencyMs,
          success: false,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // non-blocking
      }

      res.status(502).json({
        success: false,
        error: {
          code: 'GATEWAY_ERROR',
          message: `Inference failed on provider '${provider.name}': ${errorMsg}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const latencyMs = gatewayRes.latencyMs || (Date.now() - startTime);

    const inputTokens =
      gatewayRes.usage?.inputTokens ??
      Math.ceil((prompt.length + (systemPrompt?.length || 0)) / 4);
    const outputTokens =
      gatewayRes.usage?.outputTokens ?? Math.ceil(gatewayRes.content.length / 4);
    const totalTokens =
      gatewayRes.usage?.totalTokens ?? (inputTokens + outputTokens);

    const costEstimate =
      gatewayRes.costEstimate ||
      adapter.estimateCost({
        inputTokens,
        outputTokens,
        modelId,
      });

    try {
      const usageId = `use_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc(usageId).set({
        id: usageId,
        appId: 'wapcentral_admin',
        providerId: provider.id,
        modelId,
        feature: 'ai_playground',
        requestId: gatewayRes.requestId,
        inputTokens,
        outputTokens,
        costEstimateUsd: costEstimate.amountUsd,
        latencyMs,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-blocking
    }

    await logAdminAction({
      action: 'ai.playground_infer',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_provider',
      resourceId: provider.id,
      metadata: {
        modelId,
        latencyMs,
        inputTokens,
        outputTokens,
        totalTokens,
        costEstimateUsd: costEstimate.amountUsd,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        requestId: gatewayRes.requestId,
        providerId: provider.id,
        modelId,
        content: gatewayRes.content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
        costEstimate,
        latencyMs,
        raw: {
          requestId: gatewayRes.requestId,
          providerId: provider.id,
          modelId,
          content: gatewayRes.content,
          usage: {
            inputTokens,
            outputTokens,
            totalTokens,
          },
          costEstimate,
          latencyMs,
          cached: gatewayRes.cached ?? false,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Playground inference failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

// POST /v1/ai/providers/playground/infer - Execute AI Playground inference (Super Admin only)
aiProvidersRouter.post(
  '/playground/infer',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    await handlePlaygroundInference(req, res);
  },
);

// POST /v1/ai/providers/:id/infer - Execute AI Playground inference for specific provider (Super Admin only)
aiProvidersRouter.post(
  '/:id/infer',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    await handlePlaygroundInference(req, res, String(req.params['id']));
  },
);
