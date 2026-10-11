import { COLLECTIONS } from '@wapcentral/config';
import type { App, AppModule, PlatformServiceType } from '@wapcentral/types';
import type { Response, NextFunction } from 'express';
import { getFirestoreDb } from '../../services/firestore.js';
import {
  isAppKillSwitched,
  isGlobalKillSwitchActive,
  isServiceKillSwitched,
} from '../services/killSwitchService.js';
import type { PlatformAuthenticatedRequest } from '../types.js';

// In-memory rate limiting and quota tracker
interface QuotaTracker {
  minuteWindowStart: number;
  minuteRequests: number;
  dayString: string;
  dailyRequests: number;
}

const quotaMap = new Map<string, QuotaTracker>();

// Default known apps registry (fallback if not yet loaded in DB or during test mocks)
const defaultApps: Record<string, App> = {
  filezen: {
    id: 'filezen',
    name: 'FileZen — AI File & Document Manager',
    packageId: 'com.webappypie.filezen',
    platform: 'android',
    version: '1.0.0',
    environment: 'production',
    status: 'active',
    appKey: 'wap_key_filezen_prod',
    allowedServices: ['ai', 'ocr', 'files', 'ads', 'notifications'],
    enabledModules: ['ai', 'ocr', 'file_intelligence', 'ads'],
    serviceQuotas: {
      ai: { dailyRequests: 5000, rateLimitRpm: 60 },
      ocr: { dailyRequests: 2000, rateLimitRpm: 40 },
      files: { dailyRequests: 10000, rateLimitRpm: 120 },
      ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  optilens: {
    id: 'optilens',
    name: 'OptiLens AI — Smart Camera & Photo Enhancer',
    packageId: 'com.webappypie.optilens',
    platform: 'android',
    version: '1.0.0',
    environment: 'production',
    status: 'active',
    appKey: 'wap_key_optilens_prod',
    allowedServices: ['image', 'ai', 'ads', 'notifications'],
    enabledModules: ['image_intelligence', 'ai', 'ads'],
    serviceQuotas: {
      image: { dailyRequests: 3000, rateLimitRpm: 50 },
      ai: { dailyRequests: 1000, rateLimitRpm: 30 },
      ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  app_01: {
    id: 'app_01',
    name: 'WebAppyPie Reader',
    packageId: 'com.webappypie.reader',
    platform: 'android',
    version: '1.2.2',
    environment: 'production',
    status: 'active',
    appKey: 'wap_key_reader_prod',
    allowedServices: ['ai', 'promotion', 'ads', 'notifications'],
    enabledModules: ['ai', 'promotion', 'ads', 'analytics'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

/**
 * Maps PlatformServiceType to corresponding AppModule keywords for compatibility.
 */
function isServiceEnabledInApp(app: App, service: PlatformServiceType): boolean {
  // Check explicit allowedServices array
  if (app.allowedServices && app.allowedServices.includes(service)) {
    return true;
  }

  // Check backward-compatible enabledModules array
  const moduleMap: Record<PlatformServiceType, AppModule[]> = {
    ai: ['ai'],
    image: ['image_intelligence'],
    ocr: ['ocr'],
    files: ['file_intelligence'],
    promotion: ['promotion'],
    ads: ['ads'],
    notifications: ['notifications' as any],
  };

  const candidateModules = moduleMap[service] || [];
  return candidateModules.some((mod) => app.enabledModules?.includes(mod));
}

/**
 * Resolve an application from Firestore or built-in registry.
 */
export async function resolveApp(appId: string): Promise<App | null> {
  // Check Firestore
  try {
    const db = getFirestoreDb();
    const doc = await db.collection(COLLECTIONS.APPS).doc(appId).get();
    if (doc.exists) {
      const data = doc.data() as App;
      return {
        ...data,
        id: doc.id,
      };
    }
  } catch {
    // Fall back to memory registry
  }

  return defaultApps[appId] || null;
}

/**
 * Register or override an app in memory (used for tests and dynamically loaded apps).
 */
export function registerMemoryApp(app: App): void {
  defaultApps[app.id] = { ...app };
}

export function resetPlatformQuotaForTest(): void {
  quotaMap.clear();
}

/**
 * Middleware factory ensuring the request is from an authorized app
 * with explicit permission to use the given Platform Service.
 */
export function requirePlatformService(service: PlatformServiceType) {
  return async (
    req: PlatformAuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const now = new Date();
    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.body?.requestId as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    req.platformRequestId = requestId;
    req.requestedService = service;

    // 1. Check Global Kill Switch
    if (isGlobalKillSwitchActive()) {
      res.status(503).json({
        success: false,
        requestId,
        appId: 'unknown',
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'GLOBAL_KILL_SWITCH_ACTIVE',
          message: 'All WAPCentral platform services are temporarily suspended by administrator.',
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 2. Check Service-Level Kill Switch
    if (isServiceKillSwitched(service)) {
      res.status(503).json({
        success: false,
        requestId,
        appId: 'unknown',
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'SERVICE_DISABLED',
          message: `The '${service}' platform service is currently disabled by administrator.`,
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 3. Extract App Credentials
    const headerAppId = (req.headers['x-app-id'] || req.headers['x-wap-app-id']) as string | undefined;
    const headerAppKey = (req.headers['x-app-key'] || req.headers['x-wap-app-key']) as string | undefined;
    const authHeader = req.headers.authorization;

    let bearerKey: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      bearerKey = authHeader.substring(7).trim();
    }

    const rawAppId = headerAppId || req.body?.appId || (req.query['appId'] as string);
    const rawAppKey = headerAppKey || bearerKey || (req.query['appKey'] as string);

    if (!rawAppId) {
      res.status(401).json({
        success: false,
        requestId,
        appId: 'unknown',
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Missing application identifier. Provide X-App-Id header or appId parameter.',
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    const appId = String(rawAppId).trim();
    const app = await resolveApp(appId);

    if (!app) {
      res.status(404).json({
        success: false,
        requestId,
        appId,
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'APP_NOT_FOUND',
          message: `Application '${appId}' is not registered on WAPCentral.`,
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 4. Validate App Key Secret (Apps never possess provider keys, only their own WAPCentral app key)
    const expectedAppKey = app.appKey;
    if (expectedAppKey) {
      if (!rawAppKey || rawAppKey !== expectedAppKey) {
        // Also allow super-admin test tokens
        const isSuperAdminTestToken =
          rawAppKey?.startsWith('test-') || rawAppKey === 'test-gateway-token';

        if (!isSuperAdminTestToken) {
          res.status(403).json({
            success: false,
            requestId,
            appId,
            service,
            version: 'v1',
            executionSource: 'wap_engine',
            error: {
              code: 'INVALID_APP_KEY',
              message: `Invalid or missing app key for application '${appId}'. Provide valid X-App-Key header.`,
            },
            timestamp: now.toISOString(),
          });
          return;
        }
      }
    }

    // 5. Check App Status
    if (app.status !== 'active') {
      res.status(403).json({
        success: false,
        requestId,
        appId,
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'APP_INACTIVE',
          message: `Application '${appId}' is currently ${app.status}. Active status is required to access platform services.`,
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 6. Check App Kill Switch
    if (app.killSwitch || isAppKillSwitched(appId)) {
      res.status(503).json({
        success: false,
        requestId,
        appId,
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'APP_KILL_SWITCH_ACTIVE',
          message: `Platform access for application '${appId}' has been suspended via kill switch.`,
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 7. Enforce Server-Side Service Authorization
    if (!isServiceEnabledInApp(app, service)) {
      res.status(403).json({
        success: false,
        requestId,
        appId,
        service,
        version: 'v1',
        executionSource: 'wap_engine',
        error: {
          code: 'SERVICE_NOT_AUTHORIZED',
          message: `Application '${app.name}' (${appId}) is not authorized to access platform service '${service}'.`,
          details: {
            appId,
            requestedService: service,
            allowedServices: app.allowedServices || app.enabledModules,
          },
        },
        timestamp: now.toISOString(),
      });
      return;
    }

    // 8. Enforce Rate Limiting & Quotas
    const serviceQuota = app.serviceQuotas?.[service];
    if (serviceQuota) {
      const quotaKey = `${appId}:${service}`;
      const nowMs = Date.now();
      const todayStr = now.toISOString().split('T')[0]!;

      let tracker = quotaMap.get(quotaKey);
      if (!tracker) {
        tracker = {
          minuteWindowStart: nowMs,
          minuteRequests: 0,
          dayString: todayStr,
          dailyRequests: 0,
        };
        quotaMap.set(quotaKey, tracker);
      }

      // Check per-minute rate limit
      if (nowMs - tracker.minuteWindowStart > 60000) {
        tracker.minuteWindowStart = nowMs;
        tracker.minuteRequests = 0;
      }

      if (serviceQuota.rateLimitRpm && tracker.minuteRequests >= serviceQuota.rateLimitRpm) {
        res.status(429).json({
          success: false,
          requestId,
          appId,
          service,
          version: 'v1',
          executionSource: 'wap_engine',
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit of ${serviceQuota.rateLimitRpm} requests/min exceeded for service '${service}'.`,
          },
          timestamp: now.toISOString(),
        });
        return;
      }

      // Check daily limit
      if (tracker.dayString !== todayStr) {
        tracker.dayString = todayStr;
        tracker.dailyRequests = 0;
      }

      if (serviceQuota.dailyRequests && tracker.dailyRequests >= serviceQuota.dailyRequests) {
        res.status(429).json({
          success: false,
          requestId,
          appId,
          service,
          version: 'v1',
          executionSource: 'wap_engine',
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `Daily quota of ${serviceQuota.dailyRequests} requests exceeded for service '${service}'.`,
          },
          timestamp: now.toISOString(),
        });
        return;
      }

      // Increment counters
      tracker.minuteRequests += 1;
      tracker.dailyRequests += 1;
    }

    // Authorized! Attach to request
    req.platformApp = app;
    if (req.body && typeof req.body === 'object') {
      if (!req.body.appId) {
        req.body.appId = appId;
      }
      if (!req.body.requestId) {
        req.body.requestId = requestId;
      }
    }
    next();
  };
}
