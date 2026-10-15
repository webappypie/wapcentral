import {
  PlatformAiClassifyRequestSchema,
  PlatformAiExtractRequestSchema,
  PlatformAiGenerateRequestSchema,
  PlatformAiSummarizeRequestSchema,
  PlatformAiTranslateRequestSchema,
  PlatformAiVisionRequestSchema,
  PlatformFileClassifyRequestSchema,
  PlatformFileSearchRequestSchema,
  PlatformImageAnalyzeRequestSchema,
  PlatformImageEnhanceRequestSchema,
  PlatformOcrExtractRequestSchema,
  PlatformAdTrackRequestSchema,
  RegisterNotificationDeviceSchema,
  UnregisterNotificationDeviceSchema,
  UpdateNotificationPreferencesSchema,
  PlatformNotificationEventRequestSchema,
  TrackNotificationEventSchema,
  BatchAdTelemetryEventSchema,
  AdTelemetryEventInputSchema,
} from '@wapcentral/validation';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { requirePlatformService, resolveApp } from '../middleware/platformAuth.js';
import {
  resolveEffectiveAdConfig,
  trackCustomAdEvent,
} from '../../services/adConfigService.js';
import { AnalyticsEventService } from '../../services/analytics/analyticsEventService.js';
import {
  buildPromotionPayload,
  getPromotionSigningSecret,
  matchCampaignForApp,
  recordPromotionEvent,
} from '../../services/promotionDeliveryService.js';
import {
  getEffectiveNotificationConfig,
  registerDevice,
  unregisterDevice,
  getBellNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createApplicationEvent,
  getNotificationPreferences,
  updateNotificationPreferences,
  trackNotificationEvent,
} from '../../services/notificationService.js';
import {
  executeAiClassify,
  executeAiExtract,
  executeAiGenerate,
  executeAiSummarize,
  executeAiTranslate,
  executeAiVision,
} from '../services/platformAiService.js';
import { executeImageAnalyze, executeImageEnhance } from '../services/platformImageService.js';
import { executeOcrExtract } from '../services/platformOcrService.js';
import { executeFileClassify, executeFileSearch } from '../services/platformFileService.js';
import {
  getKillSwitchState,
  setAppKillSwitch,
  setGlobalKillSwitch,
  setServiceKillSwitch,
} from '../services/killSwitchService.js';
import type { PlatformAuthenticatedRequest } from '../types.js';

export const platformRouter: Router = Router();

// ============================================================
// Health & Diagnostic Endpoint
// ============================================================
platformRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'WAPCentral Platform Services API Gateway',
    version: 'v1',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      ai: ['/generate', '/vision', '/classify', '/summarize', '/translate', '/extract'],
      image: ['/enhance', '/analyze'],
      ocr: ['/extract'],
      files: ['/search', '/classify'],
    },
  });
});

// ============================================================
// App Discovery & Permissions Endpoint
// ============================================================
platformRouter.get('/apps/:id', async (req: Request, res: Response) => {
  const appId = String(req.params['id'] || '');
  const app = await resolveApp(appId);
  if (!app) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Application '${appId}' not found.` },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Return public registration details — NEVER return appKey or secrets!
  res.json({
    success: true,
    data: {
      id: app.id,
      name: app.name,
      platform: app.platform,
      version: app.version,
      status: app.status,
      allowedServices: app.allowedServices || app.enabledModules,
      enabledModules: app.enabledModules,
      serviceQuotas: app.serviceQuotas,
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// A. AI Services Endpoints
// ============================================================

// POST /ai/generate
platformRouter.post(
  '/ai/generate',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiGenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Generate request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await executeAiGenerate(parsed.data, req.platformRequestId!);
      res.status(200).json({
        success: true,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        data: result.data,
        executionSource: result.executionSource,
        usage: result.usage,
        costEstimate: result.costEstimate,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(502).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: err instanceof Error ? err.message : 'AI generation failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /ai/vision
platformRouter.post(
  '/ai/vision',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiVisionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Vision request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await executeAiVision(parsed.data, req.platformRequestId!);
      res.status(200).json({
        success: true,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        data: result.data,
        executionSource: result.executionSource,
        usage: result.usage,
        costEstimate: result.costEstimate,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      res.status(502).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'AI_VISION_ERROR',
          message: err instanceof Error ? err.message : 'Vision analysis failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /ai/classify
platformRouter.post(
  '/ai/classify',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiClassifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Classify request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeAiClassify(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ai',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /ai/summarize
platformRouter.post(
  '/ai/summarize',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiSummarizeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Summarize request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeAiSummarize(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ai',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /ai/translate
platformRouter.post(
  '/ai/translate',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiTranslateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Translate request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeAiTranslate(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ai',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /ai/extract
platformRouter.post(
  '/ai/extract',
  requirePlatformService('ai'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAiExtractRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ai',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid AI Extract request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeAiExtract(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ai',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// B. Image Intelligence Endpoints
// ============================================================

// POST /image/enhance
platformRouter.post(
  '/image/enhance',
  requirePlatformService('image'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformImageEnhanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'image',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Image Enhance request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeImageEnhance(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'image',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /image/analyze
platformRouter.post(
  '/image/analyze',
  requirePlatformService('image'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformImageAnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'image',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Image Analyze request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeImageAnalyze(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'image',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// C. OCR / Document Intelligence Endpoint
// ============================================================

// POST /ocr/extract
platformRouter.post(
  '/ocr/extract',
  requirePlatformService('ocr'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformOcrExtractRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ocr',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid OCR Extract request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeOcrExtract(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ocr',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// D. File Intelligence Endpoints
// ============================================================

// POST /files/search
platformRouter.post(
  '/files/search',
  requirePlatformService('files'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformFileSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'files',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid File Search request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeFileSearch(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'files',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /files/classify
platformRouter.post(
  '/files/classify',
  requirePlatformService('files'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformFileClassifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'files',
        version: 'v1',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid File Classify request',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await executeFileClassify(parsed.data, req.platformRequestId!);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'files',
      version: 'v1',
      data: result.data,
      executionSource: result.executionSource,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// E. Ads & Monetization Services Platform Endpoints
// ============================================================

// GET /ads/config & GET /ads/config/:appId
// Consumed by mobile SDK / client apps using app credentials
platformRouter.get(
  ['/ads/config', '/ads/config/:appId'],
  requirePlatformService('ads'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const callerAppId = req.platformApp?.id;
    const requestedAppId = req.params['appId'];

    // Strict App Isolation: Prevent one app from accessing another app's configuration
    if (requestedAppId && requestedAppId !== callerAppId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId: callerAppId,
        service: 'ads',
        error: {
          code: 'APP_ISOLATION_VIOLATION',
          message: `Application '${callerAppId}' is not authorized to access ad configuration for '${requestedAppId}'.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const effective = await resolveEffectiveAdConfig(callerAppId!);
      res.status(200).json({
        success: true,
        requestId: req.platformRequestId,
        appId: callerAppId,
        service: 'ads',
        version: 'v1',
        data: effective,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        requestId: req.platformRequestId,
        appId: callerAppId,
        service: 'ads',
        error: {
          code: 'EFFECTIVE_CONFIG_ERROR',
          message: err.message || 'Failed to resolve effective ad configuration',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /ads/custom/track
// Impression and click tracking for WebAppyPie Custom Ads
platformRouter.post(
  '/ads/custom/track',
  requirePlatformService('ads'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const parsed = PlatformAdTrackRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ads',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Ad Tracking payload',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Ensure tracker payload matches authenticated app
    if (parsed.data.appId !== req.platformApp?.id) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId: req.platformApp?.id,
        service: 'ads',
        error: {
          code: 'APP_ISOLATION_VIOLATION',
          message: 'Payload appId must match caller authentication.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const trackResult = await trackCustomAdEvent(parsed.data);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId: req.platformApp?.id,
      service: 'ads',
      version: 'v1',
      data: trackResult,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /ads/analytics/events & POST /analytics/events
// Ingests ad telemetry events in batch or single from mobile apps / SDKs
platformRouter.post(
  ['/ads/analytics/events', '/analytics/events'],
  requirePlatformService('ads'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    let eventsToProcess: any[] = [];

    if (Array.isArray(req.body?.events)) {
      const parsedBatch = BatchAdTelemetryEventSchema.safeParse(req.body);
      if (!parsedBatch.success) {
        res.status(400).json({
          success: false,
          requestId: req.platformRequestId,
          appId,
          service: 'ads',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid batch events payload',
            details: parsedBatch.error.format(),
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      eventsToProcess = parsedBatch.data.events;
    } else {
      const parsedSingle = AdTelemetryEventInputSchema.safeParse(req.body);
      if (!parsedSingle.success) {
        res.status(400).json({
          success: false,
          requestId: req.platformRequestId,
          appId,
          service: 'ads',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid single event payload',
            details: parsedSingle.error.format(),
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      eventsToProcess = [parsedSingle.data];
    }

    const result = await AnalyticsEventService.recordEvents(appId, eventsToProcess);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'ads',
      version: 'v1',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// E2. Promotions (wap_promo_sdk)
// ============================================================
// The SDK calls `<baseUrl>/v1/promotion` and `<baseUrl>/v1/analytics/{impression,click}`;
// apps pass baseUrl `https://<host>/api/platform`. Responses are the SDK's
// top-level payload (no envelope) so CryptoValidator can verify the signature.

function promotionError(res: Response, req: PlatformAuthenticatedRequest, status: number, code: string, message: string): void {
  res.status(status).json({
    success: false,
    requestId: req.platformRequestId,
    appId: req.platformApp?.id,
    service: 'promotion',
    error: { code, message },
    timestamp: new Date().toISOString(),
  });
}

// GET /promotion?appId=&version=&env=&platform=
platformRouter.get(
  '/promotion',
  requirePlatformService('promotion'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const secret = getPromotionSigningSecret();
    if (!secret) {
      promotionError(res, req, 503, 'PROMOTION_SIGNING_UNAVAILABLE', 'Promotion signing is not configured.');
      return;
    }
    const q = (key: string): string | undefined => {
      const value = req.query[key];
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    };

    try {
      const campaign = await matchCampaignForApp({
        appId: req.platformApp!.id,
        version: q('version'),
        env: q('env'),
        platform: q('platform'),
      });
      const { payload, cacheTtlSeconds } = buildPromotionPayload(campaign, secret);
      res.setHeader('Cache-Control', `private, max-age=${cacheTtlSeconds}`);
      res.status(200).json(payload);
    } catch (err: unknown) {
      promotionError(res, req, 500, 'PROMOTION_DELIVERY_ERROR', err instanceof Error ? err.message : 'Failed to resolve promotion');
    }
  },
);

// POST /analytics/impression & /analytics/click  { campaignId, appId, deviceId? }
for (const eventType of ['impression', 'click'] as const) {
  platformRouter.post(
    `/analytics/${eventType}`,
    requirePlatformService('promotion'),
    async (req: PlatformAuthenticatedRequest, res: Response) => {
      const campaignId = typeof req.body?.campaignId === 'string' ? req.body.campaignId.trim() : '';
      if (!campaignId || campaignId.length > 128) {
        promotionError(res, req, 400, 'VALIDATION_ERROR', 'campaignId is required.');
        return;
      }
      const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.slice(0, 128) : undefined;

      try {
        const result = await recordPromotionEvent({
          eventType,
          campaignId,
          appId: req.platformApp!.id,
          deviceId,
        });
        if (!result.recorded) {
          promotionError(res, req, 404, 'CAMPAIGN_NOT_FOUND', `Campaign '${campaignId}' is not delivered to this app.`);
          return;
        }
        res.status(202).json({
          success: true,
          requestId: req.platformRequestId,
          appId: req.platformApp!.id,
          service: 'promotion',
          data: { eventId: result.eventId, eventType },
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        promotionError(res, req, 500, 'PROMOTION_EVENT_ERROR', err instanceof Error ? err.message : 'Failed to record event');
      }
    },
  );
}

// ============================================================
// F. Platform Notifications Endpoints (Step 3)
// ============================================================

// GET /notifications/config
platformRouter.get(
  '/notifications/config',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const deviceId = req.query['deviceId'] ? String(req.query['deviceId']) : undefined;

    const config = await getEffectiveNotificationConfig(appId, deviceId);
    res.json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      version: 'v1',
      data: config,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/devices/register
platformRouter.post(
  '/notifications/devices/register',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const parsed = RegisterNotificationDeviceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid device registration payload', details: parsed.error.format() },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (parsed.data.appId !== appId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'APP_ISOLATION_VIOLATION', message: 'Payload appId must match caller authentication.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await registerDevice(parsed.data);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/devices/unregister
platformRouter.post(
  '/notifications/devices/unregister',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const parsed = UnregisterNotificationDeviceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid device unregistration payload', details: parsed.error.format() },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (parsed.data.appId !== appId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'APP_ISOLATION_VIOLATION', message: 'Payload appId must match caller authentication.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await unregisterDevice(appId, parsed.data.deviceId);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /notifications (In-App Bell List)
platformRouter.get(
  '/notifications',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const deviceId = String(req.query['deviceId'] || '');

    if (!deviceId) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter deviceId is required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const category = req.query['category'] ? String(req.query['category']) : undefined;
    const unreadOnly = req.query['unreadOnly'] === 'true';
    const page = req.query['page'] ? Number(req.query['page']) : 1;
    const limit = req.query['limit'] ? Number(req.query['limit']) : 30;

    const result = await getBellNotifications(appId, deviceId, { category, unreadOnly, page, limit });
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /notifications/unread-count
platformRouter.get(
  '/notifications/unread-count',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const deviceId = String(req.query['deviceId'] || '');

    if (!deviceId) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter deviceId is required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const unreadCount = await getUnreadCount(appId, deviceId);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: { unreadCount },
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/:id/read
platformRouter.post(
  '/notifications/:id/read',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const notificationId = String(req.params['id'] || '');
    const deviceId = String(req.body?.deviceId || '');

    if (!deviceId) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Body field deviceId is required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await markNotificationAsRead(appId, deviceId, notificationId);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/read-all
platformRouter.post(
  '/notifications/read-all',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const deviceId = String(req.body?.deviceId || '');

    if (!deviceId) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Body field deviceId is required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await markAllNotificationsAsRead(appId, deviceId);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/events (Authorized Backend Event Creation)
platformRouter.post(
  '/notifications/events',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const parsed = PlatformNotificationEventRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid application event payload', details: parsed.error.format() },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (parsed.data.appId !== appId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'APP_ISOLATION_VIOLATION', message: 'Payload appId must match caller authentication.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await createApplicationEvent(appId, parsed.data);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// GET /notifications/preferences
platformRouter.get(
  '/notifications/preferences',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const deviceId = String(req.query['deviceId'] || '');

    if (!deviceId) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter deviceId is required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const preferences = await getNotificationPreferences(appId, deviceId);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: preferences,
      timestamp: new Date().toISOString(),
    });
  },
);

// PUT /notifications/preferences
platformRouter.put(
  '/notifications/preferences',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const parsed = UpdateNotificationPreferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid preferences payload', details: parsed.error.format() },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (parsed.data.appId !== appId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'APP_ISOLATION_VIOLATION', message: 'Payload appId must match caller authentication.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updated = await updateNotificationPreferences(parsed.data);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: updated,
      timestamp: new Date().toISOString(),
    });
  },
);

// POST /notifications/track
platformRouter.post(
  '/notifications/track',
  requirePlatformService('notifications'),
  async (req: PlatformAuthenticatedRequest, res: Response) => {
    const appId = req.platformApp!.id;
    const parsed = TrackNotificationEventSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'VALIDATION_ERROR', message: 'Invalid track event payload', details: parsed.error.format() },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (parsed.data.appId !== appId) {
      res.status(403).json({
        success: false,
        requestId: req.platformRequestId,
        appId,
        service: 'notifications',
        error: { code: 'APP_ISOLATION_VIOLATION', message: 'Payload appId must match caller authentication.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await trackNotificationEvent(appId, parsed.data.notificationId, parsed.data.deviceId, parsed.data.event);
    res.status(200).json({
      success: true,
      requestId: req.platformRequestId,
      appId,
      service: 'notifications',
      data: result,
      timestamp: new Date().toISOString(),
    });
  },
);

// ============================================================
// F. Platform Kill Switch Management
// ============================================================

// GET /kill-switch
platformRouter.get('/kill-switch', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: getKillSwitchState(),
    timestamp: new Date().toISOString(),
  });
});

// POST /kill-switch (Admin Authorization Required)
platformRouter.post(
  '/kill-switch',
  authenticate,
  requireRole('admin'),
  (req: Request, res: Response) => {
  const { global, service, appId, disabled } = req.body as {
    global?: boolean;
    service?: string;
    appId?: string;
    disabled: boolean;
  };

  if (global !== undefined) {
    setGlobalKillSwitch(!!disabled);
  }

  if (service) {
    setServiceKillSwitch(service as any, !!disabled);
  }

  if (appId) {
    setAppKillSwitch(appId, !!disabled);
  }

  res.json({
    success: true,
    data: getKillSwitchState(),
    message: 'Kill switch state updated successfully',
    timestamp: new Date().toISOString(),
  });
});
