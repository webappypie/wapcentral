import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { clearAuditLogsForTest } from '../services/auditService.js';
import { COLLECTIONS } from '@wapcentral/config';
import {
  resetAdsServiceForTest,
  getAdKillSwitches,
  updateAdKillSwitches,
  resolveEffectiveAdConfig,
} from '../services/adConfigService.js';
import { registerMemoryApp, resetPlatformQuotaForTest } from '../platform/middleware/platformAuth.js';

describe('Ads & Monetization Control Center (admin-api & platform)', () => {
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const UNAUTHORIZED_AUTH = 'Bearer test-unauthorized-role-token';

  beforeEach(() => {
    clearInMemoryFirestoreForTest();
    clearAuditLogsForTest();
    resetAdsServiceForTest();
    resetPlatformQuotaForTest();

    // Register test apps for platform gateway
    registerMemoryApp({
      id: 'filezen',
      name: 'FileZen — AI File & Document Manager',
      packageId: 'com.webappypie.filezen',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_filezen_prod',
      allowedServices: ['ads', 'ai', 'ocr', 'files'],
      enabledModules: ['ads', 'ai', 'ocr', 'file_intelligence'],
      serviceQuotas: {
        ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    registerMemoryApp({
      id: 'optilens',
      name: 'OptiLens AI — Smart Camera',
      packageId: 'com.webappypie.optilens',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_optilens_prod',
      allowedServices: ['ads', 'image'],
      enabledModules: ['ads', 'image_intelligence'],
      serviceQuotas: {
        ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // ============================================================
  // 1. Authentication & Authorization
  // ============================================================
  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated calls to /v1/ads/overview with 401', async () => {
      const res = await request(app).get('/v1/ads/overview');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-super_admin/viewer with 403', async () => {
      const res = await request(app)
        .get('/v1/ads/overview')
        .set('Authorization', UNAUTHORIZED_AUTH);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow Super Admin to access /v1/ads/overview with strictly zero fabricated revenue', async () => {
      const res = await request(app)
        .get('/v1/ads/overview')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalApps).toBeGreaterThanOrEqual(2);
      expect(res.body.data.activeAdNetworks).toBeGreaterThanOrEqual(1);
      // Zero-fabrication enforcement
      expect(res.body.data.estimatedRevenueDailyUsd).toBe(0.0);
      expect(res.body.data.revenueStatus).toBe('Not connected');
      expect(res.body.data.isRevenueConnected).toBe(false);
      expect(res.body.data.estimatedRevenueDailyUsd).not.toBe(78.3);
      expect(res.body.data.estimatedImpressionsDaily).not.toBe(34980);
      // Network breakdown checks
      expect(res.body.data.networkBreakdown.admob.revenueUsd).toBe(0.0);
      expect(res.body.data.networkBreakdown.meta.revenueUsd).toBe(0.0);
      expect(res.body.data.networkBreakdown.applovin.revenueUsd).toBe(0.0);
      expect(res.body.data.networkBreakdown.admob.revenueStatus).toContain('Not connected');
    });
  });

  // ============================================================
  // 2. Ad Networks CRUD & Secret Safety
  // ============================================================
  describe('Ad Networks CRUD', () => {
    it('should list all default supported networks (AdMob, Meta, AppLovin, Custom Ads)', async () => {
      const res = await request(app)
        .get('/v1/ads/networks')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      const networkIds = res.body.data.map((n: any) => n.id);
      expect(networkIds).toContain('admob');
      expect(networkIds).toContain('meta');
      expect(networkIds).toContain('applovin');
      expect(networkIds).toContain('custom_ads');
    });

    it('should create a new extensible ad network without exposing raw secrets', async () => {
      const newNetwork = {
        id: 'unity_ads',
        name: 'Unity Ads Engine',
        enabled: true,
        environmentMode: 'production',
        secretReferenceName: 'UNITY_ADS_API_KEY',
        configured: true,
        supportedFormats: ['interstitial', 'rewarded'],
        priority: 5,
        allowedAppIds: ['*'],
      };

      const res = await request(app)
        .post('/v1/ads/networks')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send(newNetwork);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('unity_ads');
      expect(res.body.data.secretReferenceName).toBe('UNITY_ADS_API_KEY');
      expect(res.body.data.apiKey).toBeUndefined(); // Raw secret NEVER stored or returned
    });

    it('should update network priority and enabled state', async () => {
      const res = await request(app)
        .put('/v1/ads/networks/meta')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ priority: 1, notes: 'Promoted to primary bidder' });

      expect(res.status).toBe(200);
      expect(res.body.data.priority).toBe(1);
      expect(res.body.data.notes).toBe('Promoted to primary bidder');
    });
  });

  // ============================================================
  // 3. App-wise Ad Configuration
  // ============================================================
  describe('App-wise Ad Configuration', () => {
    it('should get configuration for FileZen with all 6 formats', async () => {
      const res = await request(app)
        .get('/v1/ads/apps/filezen')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.data.appId).toBe('filezen');
      expect(res.body.data.masterEnabled).toBe(true);
      expect(res.body.data.formats.banner).toBeDefined();
      expect(res.body.data.formats.native).toBeDefined();
      expect(res.body.data.formats.interstitial).toBeDefined();
      expect(res.body.data.formats.rewarded).toBeDefined();
      expect(res.body.data.formats.app_open).toBeDefined();
      expect(res.body.data.formats.rewarded_interstitial).toBeDefined();
    });

    it('should update app format master toggles', async () => {
      const res = await request(app)
        .put('/v1/ads/apps/filezen')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          masterEnabled: true,
          formats: {
            banner: { enabled: true, refreshIntervalSeconds: 60 },
            native: { enabled: false },
            interstitial: { enabled: true, cooldownSeconds: 30 },
            rewarded: { enabled: true },
            app_open: { enabled: false },
            rewarded_interstitial: { enabled: false },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.formats.native.enabled).toBe(false);
      expect(res.body.data.formats.app_open.enabled).toBe(false);
    });
  });

  // ============================================================
  // 4. Ad Units & Placements
  // ============================================================
  describe('Ad Units & Placements CRUD', () => {
    it('should create and retrieve ad unit for an app', async () => {
      const newUnit = {
        id: 'filezen_applovin_interstitial',
        appId: 'filezen',
        networkId: 'applovin',
        format: 'interstitial',
        platform: 'android',
        name: 'FileZen AppLovin Max Interstitial',
        adUnitId: 'applovin_unit_xyz123',
        enabled: true,
      };

      const createRes = await request(app)
        .post('/v1/ads/units')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send(newUnit);

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.adUnitId).toBe('applovin_unit_xyz123');

      const getRes = await request(app)
        .get('/v1/ads/units?appId=filezen')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(getRes.status).toBe(200);
      const ids = getRes.body.data.map((u: any) => u.id);
      expect(ids).toContain('filezen_applovin_interstitial');
    });

    it('should create placement and enforce cooldown configuration', async () => {
      const placement = {
        id: 'filezen_reader_interstitial',
        appId: 'filezen',
        placementKey: 'reader_page_turn',
        name: 'Reader Page Turn Interstitial',
        format: 'interstitial',
        enabled: true,
        cooldownSeconds: 90,
        sessionCap: 2,
        dailyCap: 6,
      };

      const res = await request(app)
        .post('/v1/ads/placements')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send(placement);

      expect(res.status).toBe(201);
      expect(res.body.data.cooldownSeconds).toBe(90);
      expect(res.body.data.sessionCap).toBe(2);
    });
  });

  // ============================================================
  // 5. Rotation Policy & Refresh Interval Enforcement
  // ============================================================
  describe('Rotation Policy & Anti-Abuse Refresh Limits', () => {
    it('should reject banner refresh interval under 30 seconds', async () => {
      const invalidPolicy = {
        id: 'filezen_banner',
        appId: 'filezen',
        format: 'banner',
        tiers: [{ networkId: 'admob', priority: 1, enabled: true }],
        fallbackToCustomAds: true,
        bannerRefreshIntervalSeconds: 10, // Violates minimum safe limit of 30s
      };

      const res = await request(app)
        .put('/v1/ads/rotation/filezen')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send(invalidPolicy);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid banner refresh interval >= 30 seconds (default 60s)', async () => {
      const validPolicy = {
        id: 'filezen_banner',
        appId: 'filezen',
        format: 'banner',
        tiers: [
          { networkId: 'admob', priority: 1, enabled: true, timeoutMs: 5000 },
          { networkId: 'meta', priority: 2, enabled: true, timeoutMs: 5000 },
          { networkId: 'custom_ads', priority: 3, enabled: true },
        ],
        fallbackToCustomAds: true,
        bannerRefreshIntervalSeconds: 60,
      };

      const res = await request(app)
        .put('/v1/ads/rotation/filezen')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send(validPolicy);

      expect(res.status).toBe(200);
      expect(res.body.data.bannerRefreshIntervalSeconds).toBe(60);
      expect(res.body.data.tiers.length).toBe(3);
    });
  });

  // ============================================================
  // 6. Content Safety & Category Blocklist
  // ============================================================
  describe('Content Safety Policies', () => {
    it('should read global content safety policy with default blocked categories', async () => {
      const res = await request(app)
        .get('/v1/ads/safety/filezen')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.data.blockedCategories).toContain('violence');
      expect(res.body.data.blockedCategories).toContain('gambling');
      expect(res.body.data.blockedCategories).toContain('adult_sexual');
      expect(res.body.data.blockedCategories).toContain('weapons');
      expect(res.body.data.disclaimer).toBeDefined();
    });

    it('should update app-specific content rating filter to G for child-directed app', async () => {
      const res = await request(app)
        .put('/v1/ads/safety/optilens')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          maxAdRating: 'G',
          childDirectedApp: true,
          blockedCategories: ['violence', 'weapons', 'adult_sexual', 'gambling', 'drugs'],
          blockSensitiveCategories: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.maxAdRating).toBe('G');
      expect(res.body.data.childDirectedApp).toBe(true);
    });
  });

  // ============================================================
  // 7. Kill Switches & Cascade Behavior
  // ============================================================
  describe('Kill Switches & Cascading Shutdown', () => {
    it('should update Kill Switches state', async () => {
      const res = await request(app)
        .post('/v1/ads/kill-switches')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          globalAdsDisabled: false,
          networks: { admob: true }, // Turn OFF AdMob specifically
          formats: { app_open: true }, // Turn OFF App Open specifically
          reason: 'Emergency testing of provider shutdown',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.networks.admob).toBe(true);
      expect(res.body.data.formats.app_open).toBe(true);
    });

    it('should filter out kill-switched network from mediation chain in effective config', async () => {
      // 1. Kill AdMob
      await updateAdKillSwitches(
        { networks: { admob: true } },
        { uid: 'admin-1', email: 'admin@webappypie.com' },
      );

      // 2. Resolve FileZen effective configuration
      const effective = await resolveEffectiveAdConfig('filezen');
      expect(effective.enabled).toBe(true);

      // In banner mediation chain, AdMob MUST be excluded!
      const bannerChain = effective.formats.banner.mediationChain;
      const networkIds = bannerChain.map((c) => c.networkId);
      expect(networkIds).not.toContain('admob');
      // Other networks or custom ads remain available
      expect(networkIds.length).toBeGreaterThanOrEqual(1);
    });

    it('should completely shut down all ad serving if Global Ads Kill Switch is ON', async () => {
      await updateAdKillSwitches(
        { globalAdsDisabled: true, reason: 'Global Emergency Kill' },
        { uid: 'admin-1', email: 'admin@webappypie.com' },
      );

      const effective = await resolveEffectiveAdConfig('filezen');
      expect(effective.enabled).toBe(false);
      // All individual formats must also report enabled: false
      for (const fmt of Object.values(effective.formats)) {
        expect(fmt.enabled).toBe(false);
      }
    });

    it('should shut down app ads if App Kill Switch is ON', async () => {
      await updateAdKillSwitches(
        { globalAdsDisabled: false, apps: { filezen: true } },
        { uid: 'admin-1', email: 'admin@webappypie.com' },
      );

      const filezenConfig = await resolveEffectiveAdConfig('filezen');
      expect(filezenConfig.enabled).toBe(false);

      // OptiLens should still be active
      const optilensConfig = await resolveEffectiveAdConfig('optilens');
      expect(optilensConfig.enabled).toBe(true);
    });
  });

  // ============================================================
  // 8. Platform Client API Gateway (/api/platform/v1/ads/config)
  // ============================================================
  describe('Platform Client API Gateway & App Isolation', () => {
    it('should allow FileZen app to read its own effective config via appKey', async () => {
      const res = await request(app)
        .get('/api/platform/v1/ads/config')
        .set('x-app-id', 'filezen')
        .set('x-app-key', 'wap_key_filezen_prod');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.appId).toBe('filezen');
      expect(res.body.service).toBe('ads');
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.version).toBeDefined();
      expect(res.body.data.formats.banner.mediationChain).toBeDefined();

      // STRICT SECURITY CHECK: No private provider secret keys in response!
      const jsonString = JSON.stringify(res.body);
      expect(jsonString).not.toContain('ADMOB_REPORTING_CREDENTIALS');
      expect(jsonString).not.toContain('META_AAN_CREDENTIALS');
      expect(jsonString).not.toContain('APPLOVIN_API_KEY');
    });

    it('should enforce App Isolation: FileZen cannot request OptiLens ad config (403)', async () => {
      const res = await request(app)
        .get('/api/platform/v1/ads/config/optilens')
        .set('x-app-id', 'filezen')
        .set('x-app-key', 'wap_key_filezen_prod');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APP_ISOLATION_VIOLATION');
    });

    it('should track impression and click for custom ads', async () => {
      const res = await request(app)
        .post('/api/platform/v1/ads/custom/track')
        .set('x-app-id', 'filezen')
        .set('x-app-key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          campaignId: 'camp_cross_optilens',
          type: 'impression',
          format: 'banner',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tracked).toBe(true);
    });
  });

  // ============================================================
  // 8b. AppLovin MAX Sole Mediation & Demand Sources Architecture
  // ============================================================
  describe('AppLovin MAX Sole Mediation & Demand Sources Architecture', () => {
    it('resolves automatic mediation with AppLovin MAX and enabled demand sources in testing mode', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.APPS).doc('filezen').set({
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        simpleAdsConfig: {
          adsEnabled: true,
          environment: 'testing',
          strategy: 'automatic',
          enabledFormats: {
            banner: true,
            native: true,
            interstitial: true,
            rewarded: true,
            appOpen: true,
            rewardedInterstitial: true,
          },
          networks: {
            applovin: true,
            admob: true,
            meta: true,
            inmobi: true,
            unity: true,
            wapCustomAds: true,
          },
        },
      });

      const effective = await resolveEffectiveAdConfig('filezen');
      expect(effective.enabled).toBe(true);
      expect(effective.testMode).toBe(true);

      // Verify banner mediation chain includes demand tiers with official test units
      const bannerChain = effective.formats.banner.mediationChain;
      const netIds = bannerChain.map((c) => c.networkId);
      expect(netIds).toContain('applovin');
      expect(netIds).toContain('admob');
      expect(netIds).toContain('meta');
      expect(netIds).toContain('inmobi');
      expect(netIds).toContain('unity');
      expect(netIds).toContain('custom_ads');

      // Verify official test unit IDs
      const admobTier = bannerChain.find((c) => c.networkId === 'admob');
      expect(admobTier?.adUnitId).toBe('ca-app-pub-3940256099942544/6300978111');

      const applovinTier = bannerChain.find((c) => c.networkId === 'applovin');
      expect(applovinTier?.adUnitId).toBe('applovin_max_test_banner');

      const metaTier = bannerChain.find((c) => c.networkId === 'meta');
      expect(metaTier?.adUnitId).toBe('IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID');

      const inmobiTier = bannerChain.find((c) => c.networkId === 'inmobi');
      expect(inmobiTier?.adUnitId).toBe('inmobi_test_banner_1478192');

      const unityTier = bannerChain.find((c) => c.networkId === 'unity');
      expect(unityTier?.adUnitId).toBe('Banner_Android');
    });

    it('resolves single demand source strategy through AppLovin MAX', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.APPS).doc('filezen').set({
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        simpleAdsConfig: {
          adsEnabled: true,
          environment: 'testing',
          strategy: 'single_source',
          singleSourceNetwork: 'admob', // Single source: AdMob via MAX
          enabledFormats: {
            banner: true,
            native: true,
            interstitial: true,
            rewarded: true,
            appOpen: true,
            rewardedInterstitial: false,
          },
          networks: {
            applovin: true,
            admob: true,
            meta: true,
            inmobi: true,
            unity: true,
            wapCustomAds: true,
          },
        },
      });

      const effective = await resolveEffectiveAdConfig('filezen');
      const bannerChain = effective.formats.banner.mediationChain;
      const netIds = bannerChain.map((c) => c.networkId);

      // Only admob and custom_ads fallback should be in chain, other sources excluded
      expect(netIds).toContain('admob');
      expect(netIds).not.toContain('applovin');
      expect(netIds).not.toContain('meta');
      expect(netIds).not.toContain('inmobi');
      expect(netIds).not.toContain('unity');
      expect(netIds).toContain('custom_ads');
    });

    it('excludes demand source when its adapter is not bundled in mobile build', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.APPS).doc('filezen').set({
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        simpleAdsConfig: {
          adsEnabled: true,
          environment: 'testing',
          strategy: 'automatic',
          bundledAdapters: {
            applovin: true,
            admob: true,
            meta: false, // Adapter not compiled into mobile APK
            inmobi: false, // Adapter not compiled into mobile APK
            unity: false,
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
          networks: {
            applovin: true,
            admob: true,
            meta: true, // Remotely enabled, but adapter missing!
            inmobi: true, // Remotely enabled, but adapter missing!
            unity: false,
            wapCustomAds: true,
          },
        },
      });

      const effective = await resolveEffectiveAdConfig('filezen');
      const bannerChain = effective.formats.banner.mediationChain;
      const netIds = bannerChain.map((c) => c.networkId);

      // Meta and InMobi must NOT be in the active mediation chain because adapters are not bundled
      expect(netIds).not.toContain('meta');
      expect(netIds).not.toContain('inmobi');
      expect(netIds).toContain('admob');
      expect(netIds).toContain('applovin');
    });

    it('enforces production mode configuration without test IDs or fabricated identifiers', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.APPS).doc('filezen').set({
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        simpleAdsConfig: {
          adsEnabled: true,
          environment: 'production',
          strategy: 'automatic',
          enabledFormats: {
            banner: true,
            native: true,
            interstitial: true,
            rewarded: true,
            appOpen: true,
            rewardedInterstitial: false,
          },
          networks: {
            applovin: true,
            admob: true,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: true,
          },
          networkConfig: {
            enabled: true,
            admob: {
              appId: 'ca-app-pub-1234567890123456~1234567890',
              bannerId: 'ca-app-pub-1234567890123456/1111111111',
              // nativeId is omitted -> missing!
            },
            applovin: {
              sdkKey: 'applovin_prod_sdk_key_abc',
              placementIds: {
                banner: 'applovin_prod_banner_1',
              },
            },
          },
        },
      });

      const effective = await resolveEffectiveAdConfig('filezen');
      expect(effective.enabled).toBe(true);
      expect(effective.testMode).toBe(false);

      // Banner chain should contain production unit IDs
      const bannerChain = effective.formats.banner.mediationChain;
      const admobBanner = bannerChain.find((c) => c.networkId === 'admob');
      expect(admobBanner?.adUnitId).toBe('ca-app-pub-1234567890123456/1111111111');
      expect(admobBanner?.adUnitId).not.toContain('3940256099942544'); // NEVER test ID in production

      // Native chain: admob nativeId is missing, so admob must be omitted from native chain
      const nativeChain = effective.formats.native.mediationChain;
      const admobNative = nativeChain.find((c) => c.networkId === 'admob');
      expect(admobNative).toBeUndefined();
    });

    it('enforces format support constraints for demand sources', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.APPS).doc('filezen').set({
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        simpleAdsConfig: {
          adsEnabled: true,
          environment: 'testing',
          strategy: 'automatic',
          enabledFormats: {
            banner: true,
            native: true,
            interstitial: true,
            rewarded: true,
            appOpen: true,
            rewardedInterstitial: true,
          },
          networks: {
            applovin: true,
            admob: true,
            meta: true,
            inmobi: true,
            unity: true,
            wapCustomAds: true,
          },
        },
      });

      const effective = await resolveEffectiveAdConfig('filezen');

      // Unity Ads does NOT support Native or App Open
      const nativeNetIds = effective.formats.native.mediationChain.map((c) => c.networkId);
      expect(nativeNetIds).not.toContain('unity');

      const appOpenNetIds = effective.formats.app_open.mediationChain.map((c) => c.networkId);
      expect(appOpenNetIds).not.toContain('unity');
      expect(appOpenNetIds).not.toContain('meta'); // Meta does not support App Open
      expect(appOpenNetIds).not.toContain('inmobi'); // InMobi does not support App Open
    });
  });

  // ============================================================
  // 9. Audit Logging
  // ============================================================
  describe('Audit Logging for Ads Module', () => {
    it('should record audit logs when ad configuration changes', async () => {
      await request(app)
        .put('/v1/ads/networks/applovin')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ priority: 2 });

      const logsRes = await request(app)
        .get('/v1/ads/audit-logs')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.total).toBeGreaterThanOrEqual(1);
      const networkLogs = logsRes.body.data.filter(
        (l: any) => l.action === 'ads.network_update' && l.resourceId === 'applovin',
      );
      expect(networkLogs.length).toBeGreaterThanOrEqual(1);
      expect(networkLogs[0].metadata.module).toBe('ads');
    });
  });
});
