import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { config } from '../config.js';
import { resetRateLimits } from '../middleware/rateLimiter.js';
import { resetRegisteredApps } from '../middleware/auth.js';
import { resetCampaigns, setCampaigns } from '../services/campaignMatcher.js';
import { clearPromotionEvents } from '../services/analyticsService.js';
import { verifyPayloadSignature } from '../utils/crypto.js';
import { compareSemver, isVersionInRange } from '../utils/semver.js';
import type { Campaign } from '@wapcentral/types';

describe('Promotion API Service (Phase 7)', () => {
  const app = createApp();

  beforeEach(() => {
    resetRateLimits();
    resetRegisteredApps();
    resetCampaigns();
    clearPromotionEvents();
  });

  describe('1. Health Checks', () => {
    it('should return 200 OK from GET /health', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('promotion-api');
    });

    it('should return 200 OK from GET /v1/health', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('0.1.0');
    });
  });

  describe('2. App-Key Authentication', () => {
    it('should reject request without app-key with 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .query({ appId: 'app_01', version: '1.0.0' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid app-key with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'invalid-key-xyz')
        .query({ appId: 'app_01', version: '1.0.0' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_APP_KEY');
    });

    it('should reject app-key when appId in query belongs to a different app', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev') // belongs to app_01
        .query({ appId: 'app_02', version: '1.0.0' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('APP_ID_MISMATCH');
    });

    it('should accept valid app-key passed via query parameter', async () => {
      const res = await request(app).get('/v1/promotion').query({
        appId: 'app_01',
        appKey: 'wap_app_key_notes_dev',
        version: '1.0.0',
      });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });
  });

  describe('3. Campaign Matching, Delivery & Cache-Control', () => {
    it('should deliver highest-priority campaign targeting the calling app', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '2.1.0',
          platform: 'android',
          env: 'production',
        });

      expect(res.status).toBe(200);
      expect(res.body.schemaVersion).toBe(1);
      expect(res.body.enabled).toBe(true);
      expect(res.body.campaignId).toBe('camp_notes_to_calc');
      expect(res.body.title).toBe('Unlock Advanced Math & Calculus');
      expect(res.body.storeUrl).toContain('com.webappypie.calc');
      expect(res.body.layoutVariant).toBe('banner');
      expect(res.body.cacheTtlSeconds).toBe(21600);
      expect(res.body.signature).toBeDefined();

      // Check Cache-Control header
      expect(res.headers['cache-control']).toBe('public, max-age=21600');
    });

    it('should reject invalid query parameters with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: 'invalid_semver', // must be semver
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_QUERY');
    });

    it('should deliver signed EmptyPromotionPayload when no campaigns match', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_habits_dev')
        .query({
          appId: 'app_03',
          version: '1.0.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.schemaVersion).toBe(1);
      expect(res.body.enabled).toBe(false);
      expect(res.body.campaignId).toBeUndefined();
      expect(res.body.cacheTtlSeconds).toBe(3600);
      expect(res.body.signature).toBeDefined();
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
    });
  });

  describe('4. Targeting Rules & Semver Evaluation', () => {
    it('should filter out campaign if app version is below minAppVersion', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '0.8.0', // minAppVersion is 1.0.0
          platform: 'android',
        });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it('should filter out campaign if platform is not in targeting rules', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '1.5.0',
          platform: 'web', // targeting is android & ios
        });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it('should honor custom campaigns with schedule windows', async () => {
      const futureCampaign: Campaign = {
        id: 'camp_future',
        name: 'Future Launch Promo',
        promotedAppId: 'app_03',
        targetAppIds: ['app_01'],
        title: 'Coming Soon',
        description: 'New Habits App',
        ctaText: 'Pre-register',
        storeUrl: 'https://webappypie.com/habits',
        layoutVariant: 'banner',
        priority: 99,
        enabled: true,
        status: 'published',
        scheduleStart: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // Starts tomorrow
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCampaigns([futureCampaign]);

      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '1.0.0',
        });

      // Since future campaign has not started yet, should return empty payload
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });
  });

  describe('5. HMAC-SHA256 Payload Signing & Verification', () => {
    it('should produce a valid HMAC signature verifiable by the client SDK', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '1.2.0',
          platform: 'android',
        });

      expect(res.status).toBe(200);
      const isValid = verifyPayloadSignature(res.body, config.signingSecret);
      expect(isValid).toBe(true);
    });

    it('should fail HMAC verification if payload content has been tampered with', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '1.2.0',
        });

      expect(res.status).toBe(200);

      // Tamper with title
      const tampered = { ...res.body, title: 'Hacked Title' };
      const isValid = verifyPayloadSignature(tampered, config.signingSecret);
      expect(isValid).toBe(false);
    });

    it('should fail HMAC verification with an incorrect secret key', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({
          appId: 'app_01',
          version: '1.2.0',
        });

      expect(res.status).toBe(200);
      const isValid = verifyPayloadSignature(res.body, 'wrong_secret_key_12345');
      expect(isValid).toBe(false);
    });
  });

  describe('6. Rate Limiting & Abuse Protection', () => {
    it('should include standard rate limit headers on successful requests', async () => {
      const res = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .query({ appId: 'app_01', version: '1.0.0' });

      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBe('60');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should enforce rate limit of 60 req/min with 429 and Retry-After header', async () => {
      // Simulate exhausting rate limit for test app
      const testKey = 'test-app-key-123';
      for (let i = 0; i < 60; i++) {
        const r = await request(app)
          .get('/v1/promotion')
          .set('X-App-Key', testKey)
          .query({ appId: 'test-app', version: '1.0.0' });
        expect(r.status).toBe(200);
      }

      // 61st request should be rejected
      const overflow = await request(app)
        .get('/v1/promotion')
        .set('X-App-Key', testKey)
        .query({ appId: 'test-app', version: '1.0.0' });

      expect(overflow.status).toBe(429);
      expect(overflow.headers['retry-after']).toBeDefined();
      expect(overflow.headers['x-ratelimit-remaining']).toBe('0');
      expect(overflow.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('7. Analytics Telemetry & CTR Tracking', () => {
    it('should ingest impression event and increment campaign counters', async () => {
      const res = await request(app)
        .post('/v1/analytics/impression')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .send({
          campaignId: 'camp_notes_to_calc',
          deviceId: 'device-abc-123',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eventId).toBeDefined();
      expect(res.body.data.eventType).toBe('impression');
    });

    it('should ingest click event and calculate updated CTR', async () => {
      const res = await request(app)
        .post('/v1/analytics/click')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .send({
          campaignId: 'camp_notes_to_calc',
          deviceId: 'device-abc-123',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eventType).toBe('click');
    });

    it('should ingest generic promotion event via /v1/promotion/events', async () => {
      const res = await request(app)
        .post('/v1/promotion/events')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .send({
          eventType: 'impression',
          campaignId: 'camp_notes_to_calc',
          appId: 'app_01',
          deviceId: 'device-xyz-999',
          metadata: { screen: 'home_screen_banner' },
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('should list recorded events via GET /v1/analytics/events', async () => {
      await request(app)
        .post('/v1/analytics/impression')
        .set('X-App-Key', 'wap_app_key_notes_dev')
        .send({ campaignId: 'camp_notes_to_calc', deviceId: 'dev-1' });

      const res = await request(app).get('/v1/analytics/events');
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].campaignId).toBe('camp_notes_to_calc');
    });
  });

  describe('8. Semver Utility Tests', () => {
    it('should correctly compare semver strings', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('1.2.0', '1.1.9')).toBe(1);
      expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
      expect(compareSemver('v2.1.3', '2.1.0')).toBe(1);
    });

    it('should correctly check version in range', () => {
      expect(isVersionInRange('1.5.0', '1.0.0', '2.0.0')).toBe(true);
      expect(isVersionInRange('0.9.0', '1.0.0')).toBe(false);
      expect(isVersionInRange('2.5.0', undefined, '2.0.0')).toBe(false);
    });
  });
});
