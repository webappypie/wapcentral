import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { CreateAiPolicySchema, UpdateAiPolicySchema } from '@wapcentral/validation';
import type { AiPolicy } from '@wapcentral/types';
import { logAdminAction } from '../services/auditService.js';

export const aiPoliciesRouter: Router = Router();

// Seed in-memory policies
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

// GET /v1/ai/policies - List all AI routing policies (Viewer+)
aiPoliciesRouter.get('/', requireRole('viewer'), (req: AuthenticatedRequest, res: Response) => {
  const appId = req.query['appId'] ? String(req.query['appId']) : undefined;
  const filtered = appId ? memoryPolicies.filter((p) => p.appId === appId) : memoryPolicies;

  res.json({
    success: true,
    data: filtered,
    total: filtered.length,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/ai/policies/:id - Get single policy (Viewer+)
aiPoliciesRouter.get('/:id', requireRole('viewer'), (req: AuthenticatedRequest, res: Response) => {
  const policyId = String(req.params['id'] || '');
  const policy = memoryPolicies.find((p) => p.id === policyId);
  if (!policy) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    success: true,
    data: policy,
    timestamp: new Date().toISOString(),
  });
});

// POST /v1/ai/policies - Create new routing policy (Editor+)
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

    const now = new Date().toISOString();
    const id = `policy_${Date.now()}`;

    const newPolicy: AiPolicy = {
      id,
      appId: parsed.data.appId,
      feature: parsed.data.feature,
      primaryProviderId: parsed.data.primaryProviderId,
      primaryModelId: parsed.data.primaryModelId,
      fallbackChain: parsed.data.fallbackChain ? [...parsed.data.fallbackChain] : [],
      quotas: parsed.data.quotas ? { ...parsed.data.quotas } : {},
      enabled: parsed.data.enabled !== undefined ? parsed.data.enabled : true,
      createdAt: now,
      updatedAt: now,
    };

    memoryPolicies.push(newPolicy);

    await logAdminAction({
      action: 'policy.create',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_policy',
      resourceId: id,
      metadata: { appId: newPolicy.appId, feature: newPolicy.feature },
    });

    res.status(201).json({
      success: true,
      data: newPolicy,
      timestamp: now,
    });
  },
);

// PUT /v1/ai/policies/:id - Update policy (Editor+)
aiPoliciesRouter.put(
  '/:id',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');
    const index = memoryPolicies.findIndex((p) => p.id === policyId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

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

    const now = new Date().toISOString();
    const current = memoryPolicies[index]!;
    const updatedPolicy: AiPolicy = {
      ...current,
      ...(parsed.data.appId !== undefined ? { appId: parsed.data.appId } : {}),
      ...(parsed.data.feature !== undefined ? { feature: parsed.data.feature } : {}),
      ...(parsed.data.primaryProviderId !== undefined
        ? { primaryProviderId: parsed.data.primaryProviderId }
        : {}),
      ...(parsed.data.primaryModelId !== undefined
        ? { primaryModelId: parsed.data.primaryModelId }
        : {}),
      ...(parsed.data.fallbackChain !== undefined
        ? { fallbackChain: [...parsed.data.fallbackChain] }
        : {}),
      ...(parsed.data.quotas !== undefined ? { quotas: { ...parsed.data.quotas } } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      updatedAt: now,
    };

    memoryPolicies[index] = updatedPolicy;

    await logAdminAction({
      action: 'policy.update',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_policy',
      resourceId: policyId,
      metadata: { appId: updatedPolicy.appId, feature: updatedPolicy.feature },
    });

    res.json({
      success: true,
      data: updatedPolicy,
      timestamp: now,
    });
  },
);

// PATCH /v1/ai/policies/:id/toggle - Toggle policy status (Editor+)
aiPoliciesRouter.patch(
  '/:id/toggle',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');
    const index = memoryPolicies.findIndex((p) => p.id === policyId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const current = memoryPolicies[index]!;
    current.enabled = !current.enabled;
    current.updatedAt = new Date().toISOString();
    memoryPolicies[index] = current;

    await logAdminAction({
      action: 'policy.toggle',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_policy',
      resourceId: policyId,
      metadata: { enabled: current.enabled },
    });

    res.json({
      success: true,
      data: current,
      timestamp: new Date().toISOString(),
    });
  },
);

// DELETE /v1/ai/policies/:id - Delete policy (Admin+)
aiPoliciesRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const policyId = String(req.params['id'] || '');
    const index = memoryPolicies.findIndex((p) => p.id === policyId);
    if (index === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Routing policy '${policyId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [removed] = memoryPolicies.splice(index, 1);

    await logAdminAction({
      action: 'policy.delete',
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email || 'unknown',
      resourceType: 'ai_policy',
      resourceId: policyId,
      metadata: { feature: removed?.feature },
    });

    res.json({
      success: true,
      data: { id: policyId, deleted: true },
      timestamp: new Date().toISOString(),
    });
  },
);
