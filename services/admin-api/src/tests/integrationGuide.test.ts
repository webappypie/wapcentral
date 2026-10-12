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

      // Ads Section
      expect(md).toContain('8. Ads — Controlled by WAPCentral');
      expect(md).toContain('AppLovin MAX as the sole advertising mediation platform');
      expect(md).toContain('wap_ads_sdk');
      expect(md).toContain('Testing Configuration is Controlled Centrally');

      // Notifications Section
      expect(md).toContain('9. Notifications — Controlled by WAPCentral');
      expect(md).toContain('/api/platform/v1/notifications/devices/register');

      // Startup Sequence
      expect(md).toContain('10. App Startup Sequence');
      expect(md).toContain('https://wapcentral-prod.web.app/api/platform/v1');
      expect(md).toContain('preferLocal');

      // Checklists
      expect(md).toContain('11. Project File Checklist');
      expect(md).toContain('12. Security & Compliance Rules');
      expect(md).toContain('14. Release & Verification Checklist');

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
});
