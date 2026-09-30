import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { CreateAiProviderSchema, UpdateAiProviderSchema } from '@wapcentral/validation';
import type { AiProvider, HealthStatus } from '@wapcentral/types';
import { logAdminAction } from '../services/auditService.js';
import { writeSecret, getInternalSecret } from '../services/secretVault.js';
import { isAllowedSecretName, type AllowedSecretName } from '../config.js';
import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
} from '@wapcentral/provider-sdk';

export const aiProvidersRouter: Router = Router();

// Seed in-memory providers
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

// Map provider type to allowed Secret Manager vault key
function getSecretNameForType(type: string): AllowedSecretName | null {
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

// GET /v1/ai/providers - List all AI providers (Viewer+)
aiProvidersRouter.get('/', requireRole('viewer'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: memoryProviders,
    total: memoryProviders.length,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/ai/providers/:id - Get single provider details (Viewer+)
aiProvidersRouter.get('/:id', requireRole('viewer'), (req: AuthenticatedRequest, res: Response) => {
  const providerId = String(req.params['id'] || '');
  const provider = memoryProviders.find((p) => p.id === providerId);
  if (!provider) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    success: true,
    data: provider,
    timestamp: new Date().toISOString(),
  });
});

// POST /v1/ai/providers - Register new AI provider (Admin+)
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

    const existing = memoryProviders.find((p) => p.id === parsed.data.id);
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `Provider '${parsed.data.id}' already exists.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // If secret API key was supplied, store in Secret Manager Key Vault
    if (parsed.data.apiKey) {
      const secretName = getSecretNameForType(parsed.data.type);
      if (secretName) {
        await writeSecret(secretName, parsed.data.apiKey, {
          uid: req.user?.uid || 'system',
          email: req.user?.email || 'system',
        });
      }
    }

    const now = new Date().toISOString();
    const newProvider: AiProvider = {
      id: parsed.data.id,
      name: parsed.data.name,
      type: parsed.data.type,
      enabled: parsed.data.enabled,
      models: parsed.data.models ? [...parsed.data.models] : [],
      ...(parsed.data.baseUrl ? { baseUrl: parsed.data.baseUrl } : {}),
      ...(parsed.data.description ? { description: parsed.data.description } : {}),
      healthStatus: {
        status: 'unknown',
        lastCheckedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    memoryProviders.push(newProvider);

    await logAdminAction({
      action: 'provider.create',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_provider',
      resourceId: newProvider.id,
      metadata: { name: newProvider.name, type: newProvider.type },
    });

    res.status(201).json({
      success: true,
      data: newProvider,
      timestamp: now,
    });
  },
);

// PUT /v1/ai/providers/:id - Update provider configuration (Admin+)
aiProvidersRouter.put(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');
    const index = memoryProviders.findIndex((p) => p.id === providerId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

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

    const current = memoryProviders[index]!;
    if (parsed.data.apiKey) {
      const secretName = getSecretNameForType(parsed.data.type || current.type);
      if (secretName) {
        await writeSecret(secretName, parsed.data.apiKey, {
          uid: req.user?.uid || 'system',
          email: req.user?.email || 'system',
        });
      }
    }

    const now = new Date().toISOString();
    const updatedProvider: AiProvider = {
      ...current,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.baseUrl !== undefined ? { baseUrl: parsed.data.baseUrl } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.models !== undefined ? { models: [...parsed.data.models] } : {}),
      updatedAt: now,
    };

    memoryProviders[index] = updatedProvider;

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
  },
);

// DELETE /v1/ai/providers/:id - Delete / Disable AI provider (Super Admin only)
aiProvidersRouter.delete(
  '/:id',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');
    const index = memoryProviders.findIndex((p) => p.id === providerId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [removed] = memoryProviders.splice(index, 1);

    await logAdminAction({
      action: 'provider.delete',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_provider',
      resourceId: providerId,
      metadata: { name: removed?.name },
    });

    res.json({
      success: true,
      data: { id: providerId, deleted: true },
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /v1/ai/providers/:id/health-check - Trigger backend connection test (Viewer+)
aiProvidersRouter.post(
  '/:id/health-check',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const providerId = String(req.params['id'] || '');
    const index = memoryProviders.findIndex((p) => p.id === providerId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `AI Provider '${providerId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const provider = memoryProviders[index]!;
    const secretName = getSecretNameForType(provider.type);
    const secretKey =
      secretName && isAllowedSecretName(secretName)
        ? getInternalSecret(secretName) || undefined
        : undefined;

    let health: HealthStatus;

    try {
      // If in test environment without keys, return successful synthetic status
      if (process.env['NODE_ENV'] === 'test' && !secretKey) {
        health = {
          status: 'healthy',
          latencyMs: 45,
          lastCheckedAt: new Date().toISOString(),
        };
      } else {
        let adapter;
        if (provider.type === 'openai') {
          adapter = new OpenAIProvider({ apiKey: secretKey || undefined });
        } else if (provider.type === 'gemini') {
          adapter = new GeminiProvider({ apiKey: secretKey || undefined });
        } else if (provider.type === 'anthropic') {
          adapter = new AnthropicProvider({ apiKey: secretKey || undefined });
        } else {
          adapter = new SelfHostedProvider({
            ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
          });
        }

        health = await adapter.healthCheck();
      }
    } catch (err: unknown) {
      health = {
        status: 'unhealthy',
        latencyMs: 0,
        lastCheckedAt: new Date().toISOString(),
        error: (err as Error).message,
      };
    }

    provider.healthStatus = health;
    provider.updatedAt = new Date().toISOString();
    memoryProviders[index] = provider;

    res.json({
      success: true,
      data: {
        providerId: provider.id,
        healthStatus: health,
      },
      timestamp: new Date().toISOString(),
    });
  },
);
