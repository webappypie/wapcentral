import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { UpsertFeatureFlagSchema } from '@wapcentral/validation';
import type { FeatureFlag } from '@wapcentral/types';
import { logAdminAction } from '../services/auditService.js';

export const flagsRouter: Router = Router();

let memoryFlags: FeatureFlag[] = [
  {
    id: 'flag_01',
    key: 'promotion_sdk_enabled',
    description: 'Master switch to enable WAP promo delivery',
    value: true,
    type: 'boolean',
    scope: 'global',
    enabled: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin@webappypie.com',
  },
];

// GET /v1/flags - List all feature flags (Viewer+)
flagsRouter.get('/', requireRole('viewer'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: memoryFlags,
    total: memoryFlags.length,
    timestamp: new Date().toISOString(),
  });
});

// POST /v1/flags - Upsert feature flag (Editor+)
flagsRouter.post('/', requireRole('editor'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = UpsertFeatureFlagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid feature flag input',
        details: parsed.error.format(),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const validated = parsed.data;
  const flagId = `flag_${Date.now()}`;
  const now = new Date().toISOString();

  const newFlag: FeatureFlag = {
    id: flagId,
    key: validated.key,
    description: validated.description,
    value: validated.value,
    type: validated.type,
    scope: validated.scope,
    ...(validated.appId ? { appId: validated.appId } : {}),
    ...(validated.environment ? { environment: validated.environment } : {}),
    enabled: validated.enabled,
    updatedAt: now,
    updatedBy: req.user?.email || 'admin@webappypie.com',
  };

  const existingIdx = memoryFlags.findIndex((f) => f.key === validated.key);
  const before = existingIdx >= 0 ? memoryFlags[existingIdx] : null;

  if (existingIdx >= 0) {
    memoryFlags[existingIdx] = newFlag;
  } else {
    memoryFlags.unshift(newFlag);
  }

  if (req.user) {
    await logAdminAction({
      action: 'flag.update',
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      resourceType: 'featureFlag',
      resourceId: newFlag.id,
      changes: { flag: { before, after: newFlag } },
    });
  }

  res.status(201).json({
    success: true,
    data: newFlag,
    timestamp: now,
  });
});

// PATCH /v1/flags/:id/toggle - Quick toggle flag state (Editor+)
flagsRouter.patch(
  '/:id/toggle',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
    const flagId = String(req.params['id'] || '');
    const flagIndex = memoryFlags.findIndex((f) => f.id === flagId);

    if (flagIndex === -1) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Feature flag '${flagId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const existing = memoryFlags[flagIndex]!;
    const nextEnabled =
      typeof req.body?.enabled === 'boolean' ? req.body.enabled : !existing.enabled;

    const updatedFlag: FeatureFlag = {
      ...existing,
      enabled: nextEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'admin@webappypie.com',
    };

    memoryFlags[flagIndex] = updatedFlag;

    if (req.user) {
      await logAdminAction({
        action: 'flag.update',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'featureFlag',
        resourceId: flagId,
        changes: { flag: { before: existing.enabled, after: nextEnabled } },
      });
    }

    res.json({
      success: true,
      data: updatedFlag,
      timestamp: updatedFlag.updatedAt,
    });
  },
);

// DELETE /v1/flags/:id - Delete feature flag (Admin+)
flagsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const flagId = String(req.params['id'] || '');
    const existing = memoryFlags.find((f) => f.id === flagId);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Feature flag '${flagId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    memoryFlags = memoryFlags.filter((f) => f.id !== flagId);

    if (req.user) {
      await logAdminAction({
        action: 'flag.update',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'featureFlag',
        resourceId: flagId,
        changes: { flag: { before: existing, after: null } },
      });
    }

    res.json({
      success: true,
      message: `Feature flag '${flagId}' deleted.`,
      timestamp: new Date().toISOString(),
    });
  },
);
