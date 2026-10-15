import crypto from 'node:crypto';
import { COLLECTIONS } from '@wapcentral/config';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { registerMemoryApp, resetPlatformQuotaForTest } from '../platform/middleware/platformAuth.js';
import { resetKillSwitchesForTest } from '../platform/services/killSwitchService.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import {
  resetPromotionCacheForTest,
  signPromotionPayload,
  toStoredCampaign,
  isCampaignEligible,
} from '../services/promotionDeliveryService.js';

const SECRET = 'test_promotion_signing_secret';
const APP_ID = 'app_promo_test';
const APP_KEY = 'wap_key_promo_test';
const OTHER_APP_ID = 'app_other_test';

/** Independent port of wap_promo_sdk CryptoValidator (Dart) for verification. */
function dartToString(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(dartToString).join(', ')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${dartToString(x)}`).join(', ')}}`;
  }
  return String(v);
}
function sdkVerifies(json: Record<string, unknown>, secret: string): boolean {
  const keys = Object.keys(json).filter((k) => k !== 'signature' && json[k] !== null).sort();
  const canonical = keys.map((k) => `${k}:${dartToString(json[k])}`).join('|');
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  return expected === json['signature'];
}

const baseCampaign = {
  name: 'Pie Calc Pro Promo',
  promotedAppId: 'app_02',
  targetAppIds: [APP_ID],
  title: 'Unlock Scientific Functions',
  description: 'Upgrade to Pie Calc Pro for advanced equations',
  ctaText: 'Get 50% Off',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.calc',
  imageUrl: 'https://example.com/creative.png',
  sponsorLabel: 'Sponsored',
  layoutVariant: 'sponsored',
  priority: 90,
  enabled: true,
  status: 'published',
  frequencyCap: { maxImpressions: 3, periodHours: 24 },
};

async function seedCampaign(id: string, data: Record<string, unknown>): Promise<void> {
  await getFirestoreDb().collection(COLLECTIONS.CAMPAIGNS).doc(id).set(data);
}

describe('Promotions delivery (/api/platform/v1/promotion)', () => {
  const app = createApp();
  const previousSecret = process.env['PROMOTION_SIGNING_SECRET'];

  const getPromotion = (query: Record<string, string> = {}) =>
    request(app)
      .get('/api/platform/v1/promotion')
      .query({ appId: APP_ID, version: '1.0.0', env: 'production', platform: 'android', ...query })
      .set('X-App-Key', APP_KEY);

  beforeEach(() => {
    process.env['PROMOTION_SIGNING_SECRET'] = SECRET;
    clearInMemoryFirestoreForTest();
    resetPromotionCacheForTest();
    resetKillSwitchesForTest();
    resetPlatformQuotaForTest();
    for (const [id, services] of [
      [APP_ID, ['promotion', 'ads']],
      [OTHER_APP_ID, ['ads']],
    ] as const) {
      registerMemoryApp({
        id,
        name: id,
        packageId: `com.example.${id}`,
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        status: 'active',
        appKey: id === APP_ID ? APP_KEY : 'wap_key_other',
        allowedServices: [...services],
        enabledModules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env['PROMOTION_SIGNING_SECRET'];
    else process.env['PROMOTION_SIGNING_SECRET'] = previousSecret;
  });

  it('serves the published campaign targeted at the app, signed in the SDK canonical form', async () => {
    await seedCampaign('camp_01', baseCampaign);

    const res = await getPromotion();

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=21600');
    expect(res.body).toMatchObject({
      schemaVersion: 1,
      enabled: true,
      campaignId: 'camp_01',
      title: 'Unlock Scientific Functions',
      description: 'Upgrade to Pie Calc Pro for advanced equations',
      ctaText: 'Get 50% Off',
      storeUrl: baseCampaign.storeUrl,
      imageUrl: baseCampaign.imageUrl,
      sponsorLabel: 'Sponsored',
      layoutVariant: 'sponsored',
      cacheTtlSeconds: 21600,
      frequencyCap: { maxImpressions: 3, periodHours: 24 },
    });
    expect(sdkVerifies(res.body, SECRET)).toBe(true);
    expect(sdkVerifies(res.body, 'wrong-secret')).toBe(false);
    // Dashboard-internal fields never leave the server.
    expect(res.body).not.toHaveProperty('targetAppIds');
    expect(res.body).not.toHaveProperty('priority');
    expect(res.body).not.toHaveProperty('analytics');
  });

  it('signs nested objects the way Dart prints a Map', () => {
    const payload = { a: 1, cap: { maxImpressions: 3, periodHours: 24 }, n: null };
    const canonical = 'a:1|cap:{maxImpressions: 3, periodHours: 24}';
    expect(signPromotionPayload(payload, SECRET)).toBe(
      crypto.createHmac('sha256', SECRET).update(canonical).digest('hex'),
    );
  });

  it('picks the highest-priority eligible campaign', async () => {
    await seedCampaign('camp_low', { ...baseCampaign, title: 'Low', priority: 10 });
    await seedCampaign('camp_high', { ...baseCampaign, title: 'High', priority: 95 });

    const res = await getPromotion();
    expect(res.body.campaignId).toBe('camp_high');
  });

  it.each([
    ['draft (no status written yet)', { status: undefined }],
    ['paused', { status: 'paused', enabled: false }],
    ['disabled', { enabled: false }],
    ['targeted at another app', { targetAppIds: [OTHER_APP_ID] }],
    ['not started', { scheduleStart: new Date(Date.now() + 3_600_000).toISOString() }],
    ['ended', { scheduleEnd: new Date(Date.now() - 3_600_000).toISOString() }],
    ['wrong platform', { targetingRules: { platforms: ['ios'] } }],
    ['app version too old', { targetingRules: { minAppVersion: '2.0.0' } }],
  ])('returns a signed empty payload when the campaign is %s', async (_name, override) => {
    const data: Record<string, unknown> = { ...baseCampaign, ...override };
    if ('status' in override && override.status === undefined) delete data['status'];
    await seedCampaign('camp_x', data);

    const res = await getPromotion();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ schemaVersion: 1, enabled: false, cacheTtlSeconds: 3600 });
    expect(res.body).not.toHaveProperty('campaignId');
    expect(sdkVerifies(res.body, SECRET)).toBe(true);
  });

  it('treats a missing enabled flag as enabled (dashboard default)', () => {
    const { enabled: _omit, ...rest } = baseCampaign;
    const camp = toStoredCampaign('c', rest);
    expect(isCampaignEligible(camp, { appId: APP_ID })).toBe(true);
  });

  it('requires the app key and the promotion service', async () => {
    const noKey = await request(app).get('/api/platform/v1/promotion').query({ appId: APP_ID });
    expect(noKey.status).toBe(403);

    const notAuthorized = await request(app)
      .get('/api/platform/v1/promotion')
      .query({ appId: OTHER_APP_ID })
      .set('X-App-Key', 'wap_key_other');
    expect(notAuthorized.status).toBe(403);
    expect(notAuthorized.body.error.code).toBe('SERVICE_NOT_AUTHORIZED');
  });

  it('refuses to serve unsigned payloads when the signing secret is missing', async () => {
    delete process.env['PROMOTION_SIGNING_SECRET'];
    await seedCampaign('camp_01', baseCampaign);

    const res = await getPromotion();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROMOTION_SIGNING_UNAVAILABLE');
  });

  describe('tracking', () => {
    const track = (type: 'impression' | 'click', body: Record<string, unknown>) =>
      request(app).post(`/api/platform/v1/analytics/${type}`).set('X-App-Key', APP_KEY).send(body);

    it('records impressions and clicks in promotionEvents', async () => {
      await seedCampaign('camp_01', baseCampaign);

      const imp = await track('impression', { campaignId: 'camp_01', appId: APP_ID });
      const click = await track('click', { campaignId: 'camp_01', appId: APP_ID });

      expect(imp.status).toBe(202);
      expect(click.status).toBe(202);
      const events = (await getFirestoreDb().collection(COLLECTIONS.PROMOTION_EVENTS).get()).docs.map((d) =>
        d.data(),
      );
      expect(events.map((e) => e?.['eventType']).sort()).toEqual(['click', 'impression']);
      expect(events.every((e) => e?.['campaignId'] === 'camp_01' && e?.['appId'] === APP_ID)).toBe(true);
    });

    it('rejects events for campaigns not delivered to the app', async () => {
      await seedCampaign('camp_other', { ...baseCampaign, targetAppIds: [OTHER_APP_ID] });

      const res = await track('impression', { campaignId: 'camp_other', appId: APP_ID });
      expect(res.status).toBe(404);
      const events = await getFirestoreDb().collection(COLLECTIONS.PROMOTION_EVENTS).get();
      expect(events.size).toBe(0);
    });

    it('validates the campaign id', async () => {
      const res = await track('click', { appId: APP_ID });
      expect(res.status).toBe(400);
    });
  });
});
