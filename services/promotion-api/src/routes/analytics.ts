import { Router } from 'express';
import type { Response } from 'express';
import type { AppAuthenticatedRequest } from '../types/auth.js';
import { PromotionEventSchema } from '@wapcentral/validation';
import { authenticateAppKey } from '../middleware/auth.js';
import { promotionRateLimiter } from '../middleware/rateLimiter.js';
import { recordPromotionEvent, getPromotionEvents } from '../services/analyticsService.js';

export const analyticsRouter: Router = Router();

/**
 * POST /v1/analytics/impression
 * Records an impression event from mobile apps.
 */
analyticsRouter.post(
  '/impression',
  authenticateAppKey,
  promotionRateLimiter,
  (req: AppAuthenticatedRequest, res: Response) => {
    const { campaignId, deviceId, metadata } = req.body || {};
    const appId = req.appCaller?.appId || req.body?.appId;

    if (!campaignId || !appId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT', message: 'campaignId and appId are required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const event = recordPromotionEvent({
      eventType: 'impression',
      campaignId: String(campaignId),
      appId: String(appId),
      deviceId: deviceId ? String(deviceId) : undefined,
      metadata:
        typeof metadata === 'object' && metadata !== null
          ? (metadata as Record<string, unknown>)
          : undefined,
    });

    res.status(202).json({
      success: true,
      data: { eventId: event.id, eventType: 'impression' },
      timestamp: event.timestamp,
    });
  },
);

/**
 * POST /v1/analytics/click
 * Records a click event from mobile apps.
 */
analyticsRouter.post(
  '/click',
  authenticateAppKey,
  promotionRateLimiter,
  (req: AppAuthenticatedRequest, res: Response) => {
    const { campaignId, deviceId, metadata } = req.body || {};
    const appId = req.appCaller?.appId || req.body?.appId;

    if (!campaignId || !appId) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT', message: 'campaignId and appId are required.' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const event = recordPromotionEvent({
      eventType: 'click',
      campaignId: String(campaignId),
      appId: String(appId),
      deviceId: deviceId ? String(deviceId) : undefined,
      metadata:
        typeof metadata === 'object' && metadata !== null
          ? (metadata as Record<string, unknown>)
          : undefined,
    });

    res.status(202).json({
      success: true,
      data: { eventId: event.id, eventType: 'click' },
      timestamp: event.timestamp,
    });
  },
);

/**
 * POST /v1/promotion/events
 * General event ingestion endpoint accepting full PromotionEvent input.
 */
analyticsRouter.post(
  '/events',
  authenticateAppKey,
  promotionRateLimiter,
  (req: AppAuthenticatedRequest, res: Response) => {
    const parsed = PromotionEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid promotion event payload.',
          details: parsed.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const validated = parsed.data;
    const event = recordPromotionEvent({
      eventType: validated.eventType,
      campaignId: validated.campaignId,
      appId: validated.appId,
      deviceId: validated.deviceId,
      timestamp: validated.timestamp,
      metadata: validated.metadata as Record<string, unknown> | undefined,
    });

    res.status(202).json({
      success: true,
      data: { eventId: event.id, eventType: event.eventType },
      timestamp: event.timestamp,
    });
  },
);

/**
 * GET /v1/analytics/events
 * Telemetry query endpoint for inspection and testing.
 */
analyticsRouter.get('/events', (req: AppAuthenticatedRequest, res: Response) => {
  const campaignId =
    typeof req.query['campaignId'] === 'string' ? req.query['campaignId'] : undefined;
  const appId = typeof req.query['appId'] === 'string' ? req.query['appId'] : undefined;

  const events = getPromotionEvents({ campaignId, appId });
  res.json({
    success: true,
    data: events,
    total: events.length,
    timestamp: new Date().toISOString(),
  });
});
