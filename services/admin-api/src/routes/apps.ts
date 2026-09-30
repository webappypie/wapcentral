import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { CreateAppSchema, UpdateAppSchema } from '@wapcentral/validation';
import type { App } from '@wapcentral/types';
import { logAdminAction } from '../services/auditService.js';

export const appsRouter: Router = Router();

// In-memory apps registry store for admin-api
let memoryApps: App[] = [
  {
    id: 'app_01',
    name: 'WebAppyPie Reader',
    packageId: 'com.webappypie.reader',
    platform: 'android',
    version: '1.2.0',
    environment: 'production',
    enabledModules: ['promotion', 'ads', 'analytics'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'app_02',
    name: 'Pie Calc Pro',
    packageId: 'com.webappypie.calc',
    bundleId: 'com.webappypie.calc',
    platform: 'ios',
    version: '2.0.4',
    environment: 'production',
    enabledModules: ['ads', 'promotion'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /v1/apps - List all registered apps (Viewer+)
appsRouter.get('/', requireRole('viewer'), (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: memoryApps,
    total: memoryApps.length,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/apps/:id - Get single app details (Viewer+)
appsRouter.get('/:id', requireRole('viewer'), (req: AuthenticatedRequest, res: Response) => {
  const appId = String(req.params['id'] || '');
  const app = memoryApps.find((a) => a.id === appId);
  if (!app) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Application '${appId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.json({ success: true, data: app, timestamp: new Date().toISOString() });
});

// POST /v1/apps - Register a new application (Editor+)
appsRouter.post('/', requireRole('editor'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CreateAppSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid application input data',
        details: parsed.error.format(),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const validated = parsed.data;
  const appId = `app_${Date.now()}`;
  const now = new Date().toISOString();

  const newApp: App = {
    id: appId,
    name: validated.name,
    packageId: validated.packageId,
    ...(validated.bundleId ? { bundleId: validated.bundleId } : {}),
    platform: validated.platform,
    version: validated.version,
    environment: validated.environment,
    ...(validated.firebaseProjectId ? { firebaseProjectId: validated.firebaseProjectId } : {}),
    ...(validated.storeUrl
      ? {
          storeUrl: {
            ...(validated.storeUrl.android ? { android: validated.storeUrl.android } : {}),
            ...(validated.storeUrl.ios ? { ios: validated.storeUrl.ios } : {}),
          },
        }
      : {}),
    ...(validated.adConfig
      ? {
          adConfig: {
            ...(validated.adConfig.admob ? { admob: validated.adConfig.admob } : {}),
            ...(validated.adConfig.meta ? { meta: validated.adConfig.meta } : {}),
            ...(validated.adConfig.applovin ? { applovin: validated.adConfig.applovin } : {}),
            ...(validated.adConfig.wapads ? { wapads: validated.adConfig.wapads } : {}),
            ...(validated.adConfig.mediationPriority
              ? { mediationPriority: validated.adConfig.mediationPriority }
              : {}),
          },
        }
      : {}),
    enabledModules: validated.enabledModules || [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  memoryApps.unshift(newApp);

  if (req.user) {
    await logAdminAction({
      action: 'app.create',
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      resourceType: 'app',
      resourceId: appId,
      changes: { app: { before: null, after: newApp } },
    });
  }

  res.status(201).json({
    success: true,
    data: newApp,
    timestamp: now,
  });
});

// PUT /v1/apps/:id - Update an application (Editor+)
appsRouter.put('/:id', requireRole('editor'), async (req: AuthenticatedRequest, res: Response) => {
  const appId = String(req.params['id'] || '');
  const appIndex = memoryApps.findIndex((a) => a.id === appId);

  if (appIndex === -1) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Application '${appId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const parsed = UpdateAppSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid update data',
        details: parsed.error.format(),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const existing = memoryApps[appIndex]!;
  const updatedApp: App = {
    ...existing,
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.packageId ? { packageId: parsed.data.packageId } : {}),
    ...(parsed.data.bundleId ? { bundleId: parsed.data.bundleId } : {}),
    ...(parsed.data.platform ? { platform: parsed.data.platform } : {}),
    ...(parsed.data.version ? { version: parsed.data.version } : {}),
    ...(parsed.data.environment ? { environment: parsed.data.environment } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.enabledModules ? { enabledModules: parsed.data.enabledModules } : {}),
    ...(parsed.data.adConfig ? { adConfig: parsed.data.adConfig } : {}),
    updatedAt: new Date().toISOString(),
  };

  memoryApps[appIndex] = updatedApp;

  if (req.user) {
    await logAdminAction({
      action: 'app.update',
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      resourceType: 'app',
      resourceId: appId,
      changes: { app: { before: existing, after: updatedApp } },
    });
  }

  res.json({
    success: true,
    data: updatedApp,
    timestamp: updatedApp.updatedAt,
  });
});

// DELETE /v1/apps/:id - Archive an application (Admin+)
appsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['id'] || '');
    const existing = memoryApps.find((a) => a.id === appId);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Application '${appId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    memoryApps = memoryApps.filter((a) => a.id !== appId);

    if (req.user) {
      await logAdminAction({
        action: 'app.archive',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'app',
        resourceId: appId,
        changes: { app: { before: existing, after: null } },
      });
    }

    res.json({
      success: true,
      message: `Application '${appId}' archived.`,
      timestamp: new Date().toISOString(),
    });
  },
);
