import type { App } from '@wapcentral/types';
import { COLLECTIONS } from '@wapcentral/config';
import { CreateAppSchema, UpdateAppSchema } from '@wapcentral/validation';
import { Router } from 'express';
import type { Response } from 'express';

import { requireRole } from '../middleware/rbac.js';
import { logAdminAction } from '../services/auditService.js';
import { getFirestoreDb } from '../services/firestore.js';
import {
  generateIntegrationGuide,
  getIntegrationGuideFilename,
} from '../services/integrationGuideService.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const appsRouter: Router = Router();

// In-memory apps registry store for admin-api
let memoryApps: App[] = [
  {
    id: 'filezen',
    name: 'FileZen',
    packageId: 'com.webappypie.filezen',
    bundleId: 'com.webappypie.filezen.ios',
    platform: 'android',
    version: '1.0.0',
    environment: 'production',
    appKey: 'wap_key_filezen_prod',
    firebaseProjectId: 'filezen-510822',
    firebaseAndroidAppId: '1:424198485420:android:c10d373ee2d29d76dd3609',
    firebaseIosAppId: '1:424198485420:ios:c6c5a8a214ff4ecadd3609',
    fcmSenderId: '424198485420',
    allowedServices: ['ai', 'ocr', 'files', 'ads', 'notifications'],
    enabledModules: ['ai', 'ocr', 'files' as any, 'ads', 'notifications'],
    status: 'active',
    simpleAdsConfig: {
      adsEnabled: true,
      strategy: 'automatic',
      environment: 'testing',
      networks: {
        applovin: true,
        admob: true,
        meta: false,
        inmobi: false,
        unity: false,
        wapCustomAds: true,
      },
      enabledFormats: {
        banner: true,
        native: true,
        interstitial: true,
        rewarded: true,
        appOpen: true,
        rewardedInterstitial: true,
      },
      networkConfig: {
        enabled: true,
        applovin: {
          sdkKey: 'applovin_live_key_filezen_123',
          placementIds: {
            banner: 'max_banner_filezen_01',
            native: 'max_native_filezen_01',
            interstitial: 'max_interstitial_filezen_01',
            rewarded: 'max_rewarded_filezen_01',
            app_open: 'max_app_open_filezen_01',
            rewarded_interstitial: 'max_rew_inter_filezen_01',
          },
        },
        admob: {
          appId: 'ca-app-pub-3940256099942544~3347511713',
          bannerId: 'ca-app-pub-3940256099942544/6300978111',
          nativeId: 'ca-app-pub-3940256099942544/2247696110',
          interstitialId: 'ca-app-pub-3940256099942544/1033173712',
          rewardedId: 'ca-app-pub-3940256099942544/5224354917',
          appOpenId: 'ca-app-pub-3940256099942544/9257395921',
          rewardedInterstitialId: 'ca-app-pub-3940256099942544/5354046379',
        },
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'optilens',
    name: 'OptiLens AI',
    packageId: 'com.webappypie.optilens',
    bundleId: 'com.webappypie.optilens.ios',
    platform: 'android',
    version: '1.0.0',
    environment: 'production',
    appKey: 'wap_key_optilens_prod',
    firebaseProjectId: 'optilens-ai-prod',
    firebaseAndroidAppId: '1:987654321012:android:a1b2c3d4e5f6',
    firebaseIosAppId: '1:987654321012:ios:f6e5d4c3b2a1',
    fcmSenderId: '987654321012',
    allowedServices: ['image', 'ai', 'ads', 'notifications'],
    enabledModules: ['image_intelligence', 'ai', 'ads', 'notifications'],
    status: 'active',
    simpleAdsConfig: {
      adsEnabled: true,
      strategy: 'automatic',
      environment: 'production',
      networks: {
        applovin: true,
        admob: true,
        meta: true,
        inmobi: true,
        unity: true,
        wapCustomAds: true,
      },
      enabledFormats: {
        banner: true,
        native: true,
        interstitial: true,
        rewarded: true,
        appOpen: true,
        rewardedInterstitial: false,
      },
      networkConfig: {
        enabled: true,
        applovin: {
          sdkKey: 'applovin_live_key_optilens_456',
          placementIds: {
            banner: 'max_banner_optilens_01',
            native: 'max_native_optilens_01',
            interstitial: 'max_interstitial_optilens_01',
            rewarded: 'max_rewarded_optilens_01',
            app_open: 'max_app_open_optilens_01',
          },
        },
        admob: {
          appId: 'ca-app-pub-9999999999999999~1111111111',
          bannerId: 'ca-app-pub-9999999999999999/1111111111',
          nativeId: 'ca-app-pub-9999999999999999/2222222222',
          interstitialId: 'ca-app-pub-9999999999999999/3333333333',
          rewardedId: 'ca-app-pub-9999999999999999/4444444444',
          appOpenId: 'ca-app-pub-9999999999999999/5555555555',
        },
        meta: {
          placementIds: {
            banner: 'meta_banner_optilens_01',
            native: 'meta_native_optilens_01',
            interstitial: 'meta_interstitial_optilens_01',
            rewarded: 'meta_rewarded_optilens_01',
          },
        },
        inmobi: {
          accountId: 'inmobi_acc_optilens_77',
          placementIds: {
            banner: '1680000001',
            native: '1680000002',
            interstitial: '1680000003',
            rewarded: '1680000004',
          },
        },
        unity: {
          gameId: 'unity_game_optilens_888',
          placementIds: {
            banner: 'Banner_Android',
            interstitial: 'Interstitial_Android',
            rewarded: 'Rewarded_Android',
          },
        },
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
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

/**
 * Looks up an application by ID across Firestore collections, in-memory registry, and fallback records.
 */
export async function findAppById(appId: string): Promise<App | null> {
  try {
    const db = getFirestoreDb();
    const docSnap = await db.collection(COLLECTIONS.APPS).doc(appId).get();
    if (docSnap.exists) {
      const data = docSnap.data() as App;
      return {
        ...data,
        id: docSnap.id,
      };
    }

    // Secondary check: look up by packageId or name match in Firestore
    const col = db.collection(COLLECTIONS.APPS);
    if (typeof col.where === 'function') {
      const pkgQuery = await col.where('packageId', '==', appId).get();
      const firstDoc = pkgQuery.docs[0];
      if (firstDoc) {
        return {
          ...(firstDoc.data() as App),
          id: firstDoc.id,
        };
      }
    }
  } catch {
    // Non-blocking in mock environments
  }

  const memoryMatch = memoryApps.find((a) => a.id === appId);
  if (memoryMatch) return memoryMatch;

  return null;
}

// GET /v1/apps - List all registered apps (Viewer+)
// Masks secret App Key per security policy for listing APIs
appsRouter.get('/', requireRole('viewer'), (_req: AuthenticatedRequest, res: Response) => {
  const sanitized = memoryApps.map((a) => ({
    ...a,
    ...(a.appKey ? { appKey: '••••••••••••••••' } : {}),
  }));
  res.json({
    success: true,
    data: sanitized,
    total: memoryApps.length,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/apps/:id/integration-guide - Download App Integration Guide Markdown (Viewer+)
appsRouter.get(
  '/:id/integration-guide',
  requireRole('viewer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const appId = String(req.params['id'] || '');
    const app = await findAppById(appId);
    if (!app) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Application '${appId}' not found.` },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const markdown = await generateIntegrationGuide(app);
      const filename = getIntegrationGuideFilename(app.name);

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(markdown, 'utf-8'));
      res.send(markdown);
    } catch (err: any) {
      console.error(
        `[appsRouter] Error generating integration guide for '${appId}':`,
        err?.message || err,
      );
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message: 'Failed to generate application integration guide.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /v1/apps/:id - Get single app details (Viewer+)
appsRouter.get('/:id', requireRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
  const appId = String(req.params['id'] || '');
  const app = await findAppById(appId);
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
  const generatedKey =
    validated.appKey?.trim() ||
    `wap_key_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

  const newApp: App = {
    id: appId,
    name: validated.name,
    packageId: validated.packageId,
    ...(validated.bundleId ? { bundleId: validated.bundleId } : {}),
    platform: validated.platform,
    version: validated.version,
    environment: validated.environment,
    appKey: generatedKey,
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
    const maskedApp = {
      ...newApp,
      ...(newApp.appKey ? { appKey: '••••••••••••••••' } : {}),
    };
    await logAdminAction({
      action: 'app.create',
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      resourceType: 'app',
      resourceId: appId,
      changes: { app: { before: null, after: maskedApp } },
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

// POST /v1/apps/:id/regenerate-key - Regenerate X-App-Key (Editor+)
appsRouter.post(
  '/:id/regenerate-key',
  requireRole('editor'),
  async (req: AuthenticatedRequest, res: Response) => {
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

    const newKey = `wap_key_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const existing = memoryApps[appIndex]!;
    const updatedApp: App = {
      ...existing,
      appKey: newKey,
      updatedAt: new Date().toISOString(),
    };

    memoryApps[appIndex] = updatedApp;

    if (req.user) {
      await logAdminAction({
        action: 'app.regenerate_key',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        resourceType: 'app',
        resourceId: appId,
        changes: { appKey: { before: '••••••••••••••••', after: '••••••••••••••••' } },
      });
    }

    res.json({
      success: true,
      data: {
        id: appId,
        appKey: newKey,
      },
      message: 'App Key regenerated successfully. Previous key invalidated.',
      timestamp: updatedApp.updatedAt,
    });
  },
);
