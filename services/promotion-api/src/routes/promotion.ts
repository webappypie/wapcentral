import { Router } from 'express';
import type { Response } from 'express';
import type { AppAuthenticatedRequest } from '../types/auth.js';
import type { PromotionPayload, EmptyPromotionPayload } from '@wapcentral/types';
import { PromotionQuerySchema } from '@wapcentral/validation';
import { authenticateAppKey } from '../middleware/auth.js';
import { promotionRateLimiter } from '../middleware/rateLimiter.js';
import { matchCampaign } from '../services/campaignMatcher.js';
import { recordPromotionEvent } from '../services/analyticsService.js';
import { generatePayloadSignature } from '../utils/crypto.js';
import { config } from '../config.js';

export const promotionRouter: Router = Router();

/**
 * GET /v1/promotion?appId=X&version=Y&env=Z&platform=W
 * Delivers HMAC-signed campaign payload with HTTP Cache-Control header.
 */
promotionRouter.get(
  '/',
  authenticateAppKey,
  promotionRateLimiter,
  (req: AppAuthenticatedRequest, res: Response) => {
    // 1. Validate query parameters
    const parsedQuery = PromotionQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid promotion query parameters.',
          details: parsedQuery.error.format(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { appId, version, env, platform } = parsedQuery.data;

    // 2. Evaluate candidate campaigns
    const matched = matchCampaign({ appId, version, env, platform });

    if (matched) {
      const cacheTtlSeconds = Math.min(
        Math.max(config.cache.defaultTtlSeconds, config.cache.minTtlSeconds),
        config.cache.maxTtlSeconds,
      );

      const expiresAt =
        matched.scheduleEnd || new Date(Date.now() + cacheTtlSeconds * 1000).toISOString();

      const basePayload: Omit<PromotionPayload, 'signature'> = {
        schemaVersion: 1,
        enabled: true,
        campaignId: matched.id,
        title: matched.title,
        description: matched.description,
        ...(matched.imageUrl ? { imageUrl: matched.imageUrl } : {}),
        ...(matched.animationUrl ? { animationUrl: matched.animationUrl } : {}),
        ctaText: matched.ctaText,
        storeUrl: matched.storeUrl,
        layoutVariant: matched.layoutVariant,
        expiresAt,
        cacheTtlSeconds,
      };

      const signature = generatePayloadSignature(
        basePayload as Record<string, unknown>,
        config.signingSecret,
      );

      const payload: PromotionPayload = {
        ...basePayload,
        signature,
      };

      res.setHeader('Cache-Control', `public, max-age=${cacheTtlSeconds}`);
      res.json(payload);
      return;
    }

    // 3. Fallback when no active campaign is available
    const emptyBase: Omit<EmptyPromotionPayload, 'signature'> = {
      schemaVersion: 1,
      enabled: false,
      cacheTtlSeconds: config.cache.emptyTtlSeconds,
    };

    const signature = generatePayloadSignature(
      emptyBase as Record<string, unknown>,
      config.signingSecret,
    );

    const emptyPayload: EmptyPromotionPayload = {
      ...emptyBase,
      signature,
    };

    res.setHeader('Cache-Control', `public, max-age=${config.cache.emptyTtlSeconds}`);
    res.json(emptyPayload);
  },
);

/**
 * POST /v1/promotion/events
 * Ingests promotion events (impression, click) directly under the /v1/promotion namespace.
 */
promotionRouter.post(
  '/events',
  authenticateAppKey,
  promotionRateLimiter,
  (req: AppAuthenticatedRequest, res: Response) => {
    const { eventType, campaignId, deviceId, metadata } = req.body || {};
    const appId = req.appCaller?.appId || req.body?.appId;

    if (!campaignId || !appId || !['impression', 'click'].includes(eventType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid eventType (impression | click), campaignId, and appId are required.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const event = recordPromotionEvent({
      eventType,
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
      data: { eventId: event.id, eventType: event.eventType },
      timestamp: event.timestamp,
    });
  },
);
