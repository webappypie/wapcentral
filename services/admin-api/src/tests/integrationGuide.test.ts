import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { clearAuditLogsForTest } from '../services/auditService.js';
import { COLLECTIONS } from '@wapcentral/config';
import type { App } from '@wapcentral/types';
import {
  getIntegrationGuideFilename,
  analyzeAppServices,
  maskSecretValue,
} from '../services/integrationGuideService.js';

describe('App-Specific Integration Guide Generator', () => {
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const UNAUTHORIZED_AUTH = 'Bearer test-unauthorized-role-token';

  beforeEach(() => {
    clearInMemoryFirestoreForTest();
    clearAuditLogsForTest();
  });

  describe('Filename Sanitization', () => {
    it('should generate clean, filesystem-safe filenames with .md extension', () => {
      expect(getIntegrationGuideFilename('FileZen')).toBe(
        'WAPCentral_FileZen_Integration_Guide.md',
      );
      expect(getIntegrationGuideFilename('OptiLens AI')).toBe(
        'WAPCentral_OptiLens_AI_Integration_Guide.md',
      );
      expect(
        getIntegrationGuideFilename('FileZen — AI File & Document Manager'),
      ).toBe('WAPCentral_FileZen_Integration_Guide.md');
      expect(
        getIntegrationGuideFilename('OptiLens AI — Smart Camera & Photo Enhancer'),
      ).toBe('WAPCentral_OptiLens_AI_Integration_Guide.md');
      expect(
        getIntegrationGuideFilename('Special: App / 2026! * Test'),
      ).toBe('WAPCentral_Special_App_2026_Test_Integration_Guide.md');
    });
  });

  describe('Authoritative Credential Handling', () => {
    it('returns the authoritative unmasked secret value directly', () => {
      expect(maskSecretValue('wap_key_filezen_prod')).toBe('wap_key_filezen_prod');
      expect(maskSecretValue('wap_key_puzzle_secret_998877')).toBe('wap_key_puzzle_secret_998877');
      expect(maskSecretValue('')).toBe('Not configured');
      expect(maskSecretValue('Not configured')).toBe('Not configured');
    });
  });

  describe('Service & SDK Analysis', () => {
    it('correctly maps services and required SDKs for FileZen', () => {
      const filezenApp: App = {
        id: 'filezen',
        name: 'FileZen',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        status: 'active',
        allowedServices: ['ai', 'ocr', 'files', 'ads', 'notifications'],
        enabledModules: ['ai', 'ocr', 'files' as any, 'ads'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = analyzeAppServices(filezenApp);
      expect(result.isAiEnabled).toBe(true);
      expect(result.isOcrEnabled).toBe(true);
      expect(result.isFilesEnabled).toBe(true);
      expect(result.isAdsEnabled).toBe(true);
      expect(result.isNotificationsEnabled).toBe(true);
      expect(result.isImageEnabled).toBe(false);

      expect(result.enabledSdkNames).toContain('wap_core_sdk');
      expect(result.enabledSdkNames).toContain('wap_ai_sdk');
      expect(result.enabledSdkNames).toContain('wap_ocr_sdk');
      expect(result.enabledSdkNames).toContain('wap_file_sdk');
      expect(result.enabledSdkNames).toContain('wap_ads_sdk');
      expect(result.enabledSdkNames).toContain('wap_notifications_sdk');
      expect(result.enabledSdkNames).not.toContain('wap_image_sdk');
    });

    it('correctly maps services and required SDKs for OptiLens', () => {
      const optilensApp: App = {
        id: 'optilens',
        name: 'OptiLens AI',
        packageId: 'com.webappypie.optilens',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        status: 'active',
        allowedServices: ['image', 'ai', 'ads', 'notifications'],
        enabledModules: ['image_intelligence', 'ai', 'ads'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = analyzeAppServices(optilensApp);
      expect(result.isImageEnabled).toBe(true);
      expect(result.isAiEnabled).toBe(true);
      expect(result.isAdsEnabled).toBe(true);
      expect(result.isNotificationsEnabled).toBe(true);
      expect(result.isOcrEnabled).toBe(false);
      expect(result.isFilesEnabled).toBe(false);

      expect(result.enabledSdkNames).toContain('wap_core_sdk');
      expect(result.enabledSdkNames).toContain('wap_image_sdk');
      expect(result.enabledSdkNames).toContain('wap_ai_sdk');
      expect(result.enabledSdkNames).toContain('wap_ads_sdk');
      expect(result.enabledSdkNames).toContain('wap_notifications_sdk');
      expect(result.enabledSdkNames).not.toContain('wap_ocr_sdk');
      expect(result.enabledSdkNames).not.toContain('wap_file_sdk');
    });
  });

  describe('Download Endpoint Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/v1/apps/filezen/integration-guide');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized roles with 403', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', UNAUTHORIZED_AUTH);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for non-existent application', async () => {
      const res = await request(app)
        .get('/v1/apps/non_existent_app_999/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows authorized admin to download Markdown with correct MIME type', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Integration_Guide.md"',
      );
    });

    it('supports /api/admin/v1 prefix alias', async () => {
      const res = await request(app)
        .get('/api/admin/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Integration_Guide.md"',
      );
    });
  });

  describe('FileZen Document Generation & Verification', () => {
    it('generates a valid Markdown guide with FileZen-specific configuration and complete unmasked credentials', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Integration_Guide.md"',
      );

      const md = res.text;
      expect(md).toBeDefined();

      // Heading and Document Metadata
      expect(md).toContain('# WAPCentral Integration Guide — FileZen');
      expect(md).toContain('FileZen');
      expect(md).toContain('filezen');
      expect(md).toContain('com.webappypie.filezen');
      expect(md).toContain('com.webappypie.filezen.ios');

      // Unmasked Credentials: Full key provided for AI development team
      expect(md).toContain('wap_key_filezen_prod');
      expect(md).not.toContain('••••••••');
      expect(md).not.toContain('****');
      expect(md).not.toContain('[REDACTED]');

      // Firebase Configuration
      expect(md).toContain('filezen-510822');
      expect(md).toContain('1:424198485420:android:c10d373ee2d29d76dd3609');
      expect(md).toContain('1:424198485420:ios:c6c5a8a214ff4ecadd3609');
      expect(md).toContain('424198485420');

      // Enabled SDKs in Table
      expect(md).toContain('wap_core_sdk');
      expect(md).toContain('wap_ai_sdk');
      expect(md).toContain('wap_ocr_sdk');
      expect(md).toContain('wap_file_sdk');
      expect(md).toContain('wap_ads_sdk');
      expect(md).toContain('wap_notifications_sdk');
      expect(md).not.toContain('wap_image_sdk');

      // API Catalog Permissions
      expect(md).toContain('ai — Enabled');
      expect(md).toContain('ocr — Enabled');
      expect(md).toContain('files — Enabled');
      expect(md).toContain('image — Not enabled for this app');

      // Ads Section - FileZen has AppLovin MAX, Google AdMob, WebAppyPie Promotions enabled; Meta, InMobi, Unity disabled
      expect(md).toContain('8. Ads — Controlled by WAPCentral');
      expect(md).toContain('AppLovin MAX as the primary advertising mediation platform');
      expect(md).toContain('Google AdMob');
      expect(md).toContain('WebAppyPie Promotions');
      expect(md).toContain('wap_ads_sdk');
      expect(md).toContain('Testing Configuration is Controlled Centrally');
      // Disabled networks MUST be strictly excluded
      expect(md).not.toContain('**Meta Audience Network**');
      expect(md).not.toContain('facebook-adapter');
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('inmobi-adapter');
      expect(md).not.toContain('**Unity Ads**');
      expect(md).not.toContain('unityads-adapter');

      // Remote Service Control Section
      expect(md).toContain('9. Remote App Service Control');
      expect(md).toContain('FileZen is fully operational.');
      expect(md).toContain('/api/platform/v1/apps/filezen/service-status');
      expect(md).toContain('ServiceControlGuard');

      // Notifications Section
      expect(md).toContain('10. Notifications — Controlled by WAPCentral');
      expect(md).toContain('/api/platform/v1/notifications/devices/register');

      // Startup Sequence
      expect(md).toContain('11. App Startup Sequence');
      expect(md).toContain('https://wapcentral.webappypie.com/api/platform/v1');
      expect(md).toContain('preferLocal');

      // Checklists
      expect(md).toContain('12. Project File Checklist');
      expect(md).toContain('13. Security & Compliance Rules');
      expect(md).toContain('15. Release & Verification Checklist');

      // Data Isolation: Never leak OptiLens configuration
      expect(md).not.toContain('com.webappypie.optilens');
      expect(md).not.toContain('OptiLens AI');
    });
  });

  describe('OptiLens AI Document Generation & Verification', () => {
    it('generates a valid Markdown guide with OptiLens-specific configuration and no leakage', async () => {
      const res = await request(app)
        .get('/v1/apps/optilens/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_OptiLens_AI_Integration_Guide.md"',
      );

      const md = res.text;
      expect(md).toBeDefined();

      // Application Identity
      expect(md).toContain('OptiLens AI');
      expect(md).toContain('optilens');
      expect(md).toContain('com.webappypie.optilens');
      expect(md).toContain('com.webappypie.optilens.ios');

      // Unmasked Credentials
      expect(md).toContain('wap_key_optilens_prod');
      expect(md).not.toContain('••••••••');
      expect(md).not.toContain('****');
      expect(md).not.toContain('[REDACTED]');

      // Firebase Configuration
      expect(md).toContain('optilens-ai-prod');
      expect(md).toContain('1:987654321012:android:a1b2c3d4e5f6');
      expect(md).toContain('1:987654321012:ios:f6e5d4c3b2a1');
      expect(md).toContain('987654321012');

      // Enabled SDKs: OptiLens has Image, AI, Ads, Notifications
      expect(md).toContain('wap_core_sdk');
      expect(md).toContain('wap_image_sdk');
      expect(md).toContain('wap_ai_sdk');
      expect(md).toContain('wap_ads_sdk');
      expect(md).toContain('wap_notifications_sdk');
      expect(md).not.toContain('wap_ocr_sdk');
      expect(md).not.toContain('wap_file_sdk');

      // API Catalog Permissions
      expect(md).toContain('image — Enabled');
      expect(md).toContain('ai — Enabled');
      expect(md).toContain('ocr — Not enabled for this app');
      expect(md).toContain('files — Not enabled for this app');

      // Data Isolation: Never leak FileZen configuration
      expect(md).not.toContain('com.webappypie.filezen');
      expect(md).not.toContain('FileZen — AI File & Document Manager');
    });
  });

  describe('Custom App with Real Firestore IDs & Missing Value Handling', () => {
    it('correctly handles custom app with real Firebase values, missing placeholders, and unmasked credentials', async () => {
      const db = getFirestoreDb();
      const customAppId = 'app_1791324566055';
      const customApp: App = {
        id: customAppId,
        name: 'FileZen Production',
        packageId: 'com.webappypie.filezen.prod',
        platform: 'android',
        version: '2.1.0',
        environment: 'production',
        appKey: 'wap_key_filezen_live_secret123',
        firebaseProjectId: 'filezen-prod-firebase',
        firebaseAndroidAppId: '1:9876543210:android:abc999',
        // Note: firebaseIosAppId and fcmSenderId are omitted to test fallback handling
        allowedServices: ['ai', 'ocr', 'files', 'ads'],
        enabledModules: ['ai', 'ocr', 'file_intelligence', 'ads'],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(customAppId).set(customApp);

      const res = await request(app)
        .get(`/v1/apps/${customAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Production_Integration_Guide.md"',
      );

      const md = res.text;
      expect(md).toBeDefined();

      // App identity
      expect(md).toContain('FileZen Production');
      expect(md).toContain('app_1791324566055');
      expect(md).toContain('com.webappypie.filezen.prod');

      // Key must be unmasked, directly usable by the AI dev team
      expect(md).toContain('wap_key_filezen_live_secret123');
      expect(md).not.toContain('••••••••');
      expect(md).not.toContain('****');
      expect(md).not.toContain('[REDACTED]');

      // Real configured Firebase values
      expect(md).toContain('filezen-prod-firebase');
      expect(md).toContain('1:9876543210:android:abc999');

      // Missing values should strictly show Not configured
      expect(md).toContain('Not configured');
      expect(md).not.toContain('Configured in Firebase — not stored in WAPCentral');
    });
  });

  describe('Multi-Provider Advertising System Verification', () => {
    it('generates direct AdMob guide when ONLY AdMob is enabled, omitting AppLovin MAX and other networks', async () => {
      const db = getFirestoreDb();
      const admobOnlyAppId = 'app_admob_only_test';
      const admobOnlyApp: App = {
        id: admobOnlyAppId,
        name: 'AdMob Solo App',
        packageId: 'com.webappypie.admobsample',
        platform: 'android',
        version: '1.0.0',
        environment: 'development',
        appKey: 'wap_key_admob_solo_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'single_source',
          singleSourceNetwork: 'admob',
          environment: 'testing',
          networks: {
            applovin: false,
            admob: true,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: true,
            native: true,
            appOpen: true,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(admobOnlyAppId).set(admobOnlyApp);

      const res = await request(app)
        .get(`/v1/apps/${admobOnlyAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      // 1. Direct GMA Integration & Narrative
      expect(md).toContain('Google AdMob as the sole advertising provider');
      expect(md).toContain('Direct GMA Integration');
      expect(md).toContain('Zero Mediation Overhead');
      expect(md).toContain('No AppLovin Credentials Required');
      expect(md).toContain('google_mobile_ads: ^5.2.0');
      expect(md).toContain('com.google.android.gms:play-services-ads:23.6.0');

      // 2. Official Google GMA Test App ID and Ad Units
      expect(md).toContain('ca-app-pub-3940256099942544~3347511713');
      expect(md).toContain('ca-app-pub-3940256099942544/6300978111');
      expect(md).toContain('ca-app-pub-3940256099942544/1033173712');
      expect(md).toContain('ca-app-pub-3940256099942544/5224354917');
      expect(md).toContain('ca-app-pub-3940256099942544/2247696110');
      expect(md).toContain('ca-app-pub-3940256099942544/9257395921');

      // 3. Strict filtering: Disabled providers MUST NOT appear in configuration tables or dependencies
      expect(md).not.toContain('AppLovin MAX as the primary advertising mediation platform');
      expect(md).not.toContain('**AppLovin MAX**');
      expect(md).not.toContain('AppLovinSdkKey');
      expect(md).not.toContain('applovin_max:');
      expect(md).not.toContain('**Meta Audience Network**');
      expect(md).not.toContain('facebook-adapter');
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('inmobi-adapter');
      expect(md).not.toContain('InMobi Account ID');
      expect(md).not.toContain('**Unity Ads**');
      expect(md).not.toContain('unityads-adapter');
      expect(md).not.toContain('**WebAppyPie Promotions**');
      expect(md).not.toContain('wap_promo_sdk');
    });

    it('generates mediation guide with AdMob and AppLovin MAX when both are enabled', async () => {
      const db = getFirestoreDb();
      const dualAppId = 'app_admob_applovin_test';
      const dualApp: App = {
        id: dualAppId,
        name: 'Dual Provider App',
        packageId: 'com.webappypie.dualads',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_dual_ads_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'automatic',
          environment: 'production',
          networks: {
            applovin: true,
            admob: true,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: true,
            native: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(dualAppId).set(dualApp);

      const res = await request(app)
        .get(`/v1/apps/${dualAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      // Both AppLovin and AdMob must be present
      expect(md).toContain('AppLovin MAX as the primary advertising mediation platform');
      expect(md).toContain('applovin_max: ^4.0.1');
      expect(md).toContain('AppLovinSdkKey');
      expect(md).toContain('Google AdMob');
      expect(md).toContain('com.applovin.mediation:google-adapter:23.6.0.0');

      // Others must be strictly absent
      expect(md).not.toContain('**Meta Audience Network**');
      expect(md).not.toContain('facebook-adapter');
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('inmobi-adapter');
      expect(md).not.toContain('InMobi Account ID');
      expect(md).not.toContain('**Unity Ads**');
      expect(md).not.toContain('unityads-adapter');
      expect(md).not.toContain('**WebAppyPie Promotions**');
      expect(md).not.toContain('wap_promo_sdk');
    });

    it('generates standalone AppLovin MAX guide when ONLY AppLovin MAX is enabled (no external adapters)', async () => {
      const db = getFirestoreDb();
      const applovinOnlyAppId = 'app_applovin_only_test';
      const applovinOnlyApp: App = {
        id: applovinOnlyAppId,
        name: 'AppLovin Solo App',
        packageId: 'com.webappypie.applovinsolo',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_applovin_solo_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'single_source',
          singleSourceNetwork: 'applovin',
          environment: 'production',
          networks: {
            applovin: true,
            admob: false,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
          networkConfig: {
            enabled: true,
            applovin: {
              sdkKey: 'applovin_sdk_key_solo_123',
              placementIds: {
                banner: 'solo_max_banner_1',
                interstitial: 'solo_max_inter_1',
              },
            },
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: false,
            native: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(applovinOnlyAppId).set(applovinOnlyApp);

      const res = await request(app)
        .get(`/v1/apps/${applovinOnlyAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      // Standalone mediation narrative
      expect(md).toContain('AppLovin MAX as the sole advertising mediation platform');
      expect(md).toContain('Standalone Mediation Platform (AppLovin MAX Direct Demand)');
      expect(md).toContain('applovin_max: ^4.0.1');
      expect(md).toContain('com.applovin:applovin-sdk:13.1.0');
      expect(md).toContain('applovin_sdk_key_solo_123');
      expect(md).toContain('solo_max_banner_1');

      // Zero external demand adapters or providers
      expect(md).not.toContain('google-adapter');
      expect(md).not.toContain('google_mobile_ads');
      expect(md).not.toContain('com.google.android.gms:play-services-ads');
      expect(md).not.toContain('com.google.android.gms.ads.APPLICATION_ID');
      expect(md).not.toContain('ca-app-pub-');
      expect(md).not.toContain('**Meta Audience Network**');
      expect(md).not.toContain('facebook-adapter');
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('inmobi-adapter');
      expect(md).not.toContain('**Unity Ads**');
      expect(md).not.toContain('unityads-adapter');
      expect(md).not.toContain('**WebAppyPie Promotions**');
      expect(md).not.toContain('wap_promo_sdk');
    });

    it('accurately documents Promotions when enabled vs when disabled', async () => {
      const db = getFirestoreDb();

      // App 1: Promotions ENABLED (with AdMob)
      const promoEnabledAppId = 'app_promo_enabled_test';
      const promoEnabledApp: App = {
        id: promoEnabledAppId,
        name: 'Promo Enabled App',
        packageId: 'com.webappypie.promoapp',
        platform: 'android',
        version: '1.0.0',
        environment: 'development',
        appKey: 'wap_key_promo_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'automatic',
          environment: 'testing',
          networks: {
            applovin: false,
            admob: true,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: true,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: false,
            native: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(COLLECTIONS.APPS).doc(promoEnabledAppId).set(promoEnabledApp);

      const resEnabled = await request(app)
        .get(`/v1/apps/${promoEnabledAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(resEnabled.status).toBe(200);
      const mdEnabled = resEnabled.text;

      // Promotions must be enabled
      expect(mdEnabled).toContain('`wap_promo_sdk`');
      expect(mdEnabled).toContain('wap_promo_sdk: ^1.0.0');
      expect(mdEnabled).toContain('promotion — Enabled');
      expect(mdEnabled).toContain('/api/platform/v1/promotion');
      expect(mdEnabled).toContain('/api/platform/v1/analytics/impression');
      expect(mdEnabled).toContain('WebAppyPie Promotions');
      expect(mdEnabled).toContain('custom_inhouse');
      expect(mdEnabled).toContain('Custom Ads House Fallback');

      // App 2: Promotions DISABLED (with AdMob only)
      const promoDisabledAppId = 'app_promo_disabled_test';
      const promoDisabledApp: App = {
        id: promoDisabledAppId,
        name: 'Promo Disabled App',
        packageId: 'com.webappypie.nopromoapp',
        platform: 'android',
        version: '1.0.0',
        environment: 'development',
        appKey: 'wap_key_nopromo_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'single_source',
          singleSourceNetwork: 'admob',
          environment: 'testing',
          networks: {
            applovin: false,
            admob: true,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: false,
            native: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.collection(COLLECTIONS.APPS).doc(promoDisabledAppId).set(promoDisabledApp);

      const resDisabled = await request(app)
        .get(`/v1/apps/${promoDisabledAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(resDisabled.status).toBe(200);
      const mdDisabled = resDisabled.text;

      // Promotions must be completely excluded
      expect(mdDisabled).not.toContain('`wap_promo_sdk`');
      expect(mdDisabled).not.toContain('wap_promo_sdk: ^1.0.0');
      expect(mdDisabled).toContain('promotion — Not enabled for this app');
      expect(mdDisabled).not.toContain('WebAppyPie Promotions');
      expect(mdDisabled).not.toContain('custom_inhouse');
      expect(mdDisabled).not.toContain('Custom Ads House Fallback');
    });

    it('generates multi-provider setup with MAX, AdMob, Meta, and Unity, separating test and production credentials', async () => {
      const db = getFirestoreDb();
      const multiAppId = 'app_multi_provider_test';
      const multiApp: App = {
        id: multiAppId,
        name: 'Multi Provider App',
        packageId: 'com.webappypie.multiads',
        platform: 'android',
        version: '1.0.0',
        environment: 'development',
        appKey: 'wap_key_multi_ads_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'automatic',
          environment: 'testing',
          networks: {
            applovin: true,
            admob: true,
            meta: true,
            inmobi: false,
            unity: true,
            wapCustomAds: false,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: true,
            native: true,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(multiAppId).set(multiApp);

      const res = await request(app)
        .get(`/v1/apps/${multiAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      // Verify the 4 enabled providers are included
      expect(md).toContain('AppLovin MAX');
      expect(md).toContain('Google AdMob');
      expect(md).toContain('Meta Audience Network');
      expect(md).toContain('Unity Ads');
      expect(md).toContain('com.applovin.mediation:google-adapter:23.6.0.0');
      expect(md).toContain('com.applovin.mediation:facebook-adapter:6.18.0.0');
      expect(md).toContain('com.applovin.mediation:unityads-adapter:4.12.5.0');

      // Test credentials catalog
      expect(md).toContain('Testing Mode is ACTIVE');
      expect(md).toContain('Official Testing Configuration Catalog');
      expect(md).toContain('ca-app-pub-3940256099942544~3347511713');
      expect(md).toContain('IMG_16_9_APP_INSTALL#');
      expect(md).toContain('Unity Dashboard Test Mode');

      // Omitted networks
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('inmobi-adapter');
      expect(md).not.toContain('InMobi Account ID');
      expect(md).not.toContain('**WebAppyPie Promotions**');
      expect(md).not.toContain('wap_promo_sdk');
    });

    it('dynamically removes a previously enabled provider when disabled in configuration', async () => {
      const db = getFirestoreDb();
      const toggleAppId = 'app_toggle_provider_test';
      const initialApp: App = {
        id: toggleAppId,
        name: 'Toggle Provider App',
        packageId: 'com.webappypie.toggleads',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_toggle_test',
        allowedServices: ['ads'],
        enabledModules: ['ads'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: true,
          strategy: 'automatic',
          environment: 'production',
          networks: {
            applovin: true,
            admob: true,
            meta: true,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
          enabledFormats: {
            banner: true,
            interstitial: true,
            rewarded: true,
            native: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Initial state with Meta enabled
      await db.collection(COLLECTIONS.APPS).doc(toggleAppId).set(initialApp);

      const res1 = await request(app)
        .get(`/v1/apps/${toggleAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res1.status).toBe(200);
      expect(res1.text).toContain('Meta Audience Network');
      expect(res1.text).toContain('facebook-adapter');

      // 2. Disable Meta
      const updatedApp: App = {
        ...initialApp,
        simpleAdsConfig: {
          ...initialApp.simpleAdsConfig!,
          networks: {
            ...initialApp.simpleAdsConfig!.networks,
            meta: false,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      await db.collection(COLLECTIONS.APPS).doc(toggleAppId).set(updatedApp);

      const res2 = await request(app)
        .get(`/v1/apps/${toggleAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res2.status).toBe(200);
      // Meta must now be completely removed from the regenerated guide
      expect(res2.text).not.toContain('Meta Audience Network');
      expect(res2.text).not.toContain('facebook-adapter');
      expect(res2.text).toContain('AppLovin MAX');
      expect(res2.text).toContain('Google AdMob');
    });

    it('generates clean disabled section when ads or all providers are disabled', async () => {
      const db = getFirestoreDb();
      const noAdsAppId = 'app_no_ads_test';
      const noAdsApp: App = {
        id: noAdsAppId,
        name: 'No Ads App',
        packageId: 'com.webappypie.noads',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_no_ads_test',
        allowedServices: ['ai'],
        enabledModules: ['ai'],
        status: 'active',
        simpleAdsConfig: {
          adsEnabled: false,
          strategy: 'automatic',
          environment: 'production',
          enabledFormats: {
            banner: false,
            native: false,
            interstitial: false,
            rewarded: false,
            appOpen: false,
            rewardedInterstitial: false,
          },
          networks: {
            applovin: false,
            admob: false,
            meta: false,
            inmobi: false,
            unity: false,
            wapCustomAds: false,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(noAdsAppId).set(noAdsApp);

      const res = await request(app)
        .get(`/v1/apps/${noAdsAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      expect(md).toContain('> **Ads: Disabled for this application.**');
      expect(md).toContain('- No advertising providers are currently enabled for this application.');
      expect(md).toContain('- Do not install `wap_ads_sdk` or initialize third-party advertising SDKs in this app.');
      expect(md).not.toContain('| Provider / Demand Source | Role & Architecture |');
      expect(md).not.toContain('**AppLovin MAX**');
      expect(md).not.toContain('**Google AdMob**');
      expect(md).not.toContain('**Meta Audience Network**');
      expect(md).not.toContain('**InMobi**');
      expect(md).not.toContain('**Unity Ads**');
      expect(md).not.toContain('**WebAppyPie Promotions**');
      expect(md).not.toContain('ca-app-pub-');
    });
  });

  describe('Remote App Service Control Endpoints & Lifecycle Verification', () => {
    it('saves and publishes Remote Service Control configuration via admin PUT endpoint', async () => {
      const putRes = await request(app)
        .put('/v1/apps/filezen/service-control')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          enabled: false,
          title: 'Scheduled System Maintenance',
          message: 'FileZen backend is currently updating. Please check back shortly.',
          buttonText: 'System Status Page',
          destinationUrl: 'https://status.webappypie.com/filezen',
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.enabled).toBe(false);
      expect(putRes.body.data.title).toBe('Scheduled System Maintenance');
      expect(putRes.body.data.message).toBe('FileZen backend is currently updating. Please check back shortly.');
      expect(putRes.body.data.buttonText).toBe('System Status Page');
      expect(putRes.body.data.destinationUrl).toBe('https://status.webappypie.com/filezen');

      // Verify public platform service-status endpoint reflects disabled state and custom strings
      const statusRes = await request(app)
        .get('/api/platform/v1/apps/filezen/service-status');

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.appId).toBe('filezen');
      expect(statusRes.body.data.enabled).toBe(false);
      expect(statusRes.body.data.title).toBe('Scheduled System Maintenance');
      expect(statusRes.body.data.message).toBe('FileZen backend is currently updating. Please check back shortly.');
      expect(statusRes.body.data.buttonText).toBe('System Status Page');
      expect(statusRes.body.data.destinationUrl).toBe('https://status.webappypie.com/filezen');

      // Verify downloadable integration guide reflects the disabled status and blocking configuration
      const guideRes = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(guideRes.status).toBe(200);
      const md = guideRes.text;
      expect(md).toContain('Disabled (Blocking Dialog Active)');
      expect(md).toContain('Scheduled System Maintenance');
      expect(md).toContain('FileZen backend is currently updating. Please check back shortly.');
      expect(md).toContain('System Status Page');
      expect(md).toContain('https://status.webappypie.com/filezen');
      expect(md).toContain('ServiceControlGuard.checkServiceStatus()');
      expect(md).toContain('ServiceControlGuard.showBlockingDialog(');
    });

    it('restores service to active when administrator re-enables service control', async () => {
      const putRes = await request(app)
        .put('/v1/apps/filezen/service-control')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          enabled: true,
          title: 'Service Operational',
          message: 'FileZen is fully operational.',
          buttonText: 'OK',
          destinationUrl: 'https://webappypie.com',
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.enabled).toBe(true);

      const statusRes = await request(app)
        .get('/api/platform/v1/apps/filezen/service-status');

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.enabled).toBe(true);

      const guideRes = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(guideRes.status).toBe(200);
      expect(guideRes.text).toContain('Active (Online)');
    });

    it('ensures zero private signing secrets or admin credentials leak into downloadable documentation', async () => {
      const guideRes = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(guideRes.status).toBe(200);
      const md = guideRes.text;

      // Absolute leak check for sensitive backend secrets
      expect(md).not.toContain('signingSecret');
      expect(md).not.toContain('private_key');
      expect(md).not.toContain('privateKey');
      expect(md).not.toContain('client_secret');
      expect(md).not.toContain('service_account');
      expect(md).not.toContain('DATABASE_URL');
      expect(md).not.toContain('GCP_SERVICE_ACCOUNT');
    });
  });

  describe('Weather Service Selective Documentation Inclusion', () => {
    it('strictly excludes Weather Service section and SDK from apps where Weather is disabled', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      // Weather is not enabled for FileZen
      expect(md).not.toContain('wap_weather_sdk');
      expect(md).not.toContain('Weather Service Integration');
      expect(md).not.toContain('WapWeather');
      expect(md).toContain('weather — Not enabled for this app');
    });

    it('includes complete Weather Service section, SDK, endpoints, and attribution when enabled', async () => {
      const db = getFirestoreDb();
      const weatherAppId = 'weather_pilot_app';
      const weatherApp: App = {
        id: weatherAppId,
        name: 'Weather Pilot',
        packageId: 'com.webappypie.weatherpilot',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        status: 'active',
        appKey: 'wap_key_weather_pilot_prod',
        allowedServices: ['weather'],
        enabledModules: ['weather' as any],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection(COLLECTIONS.APPS).doc(weatherAppId).set(weatherApp);

      const res = await request(app)
        .get(`/v1/apps/${weatherAppId}/integration-guide`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      const md = res.text;

      expect(md).toContain('wap_weather_sdk');
      expect(md).toContain('Weather Service Integration (`wap_weather_sdk`)');
      expect(md).toContain('WapWeather');
      expect(md).toContain('/api/platform/v1/weather/current');
      expect(md).toContain('/api/platform/v1/weather/forecast');
      expect(md).toContain('/api/platform/v1/weather/search');
      expect(md).toContain('Powered by WeatherAPI.com');
      expect(md).toContain('weather — Enabled');
    });
  });
});
