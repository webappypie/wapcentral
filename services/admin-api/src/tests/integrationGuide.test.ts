import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import PizZip from 'pizzip';
import { app } from '../app.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { clearAuditLogsForTest } from '../services/auditService.js';
import { COLLECTIONS } from '@wapcentral/config';
import type { App } from '@wapcentral/types';
import {
  getIntegrationGuideFilename,
  analyzeAppServices,
} from '../services/integrationGuideService.js';

describe('App-Specific Integration Guide Generator', () => {
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const UNAUTHORIZED_AUTH = 'Bearer test-unauthorized-role-token';

  beforeEach(() => {
    clearInMemoryFirestoreForTest();
    clearAuditLogsForTest();
  });

  describe('Filename Sanitization', () => {
    it('should generate clean, filesystem-safe filenames', () => {
      expect(getIntegrationGuideFilename('FileZen')).toBe(
        'WAPCentral_FileZen_Integration_Guide.docx',
      );
      expect(getIntegrationGuideFilename('OptiLens AI')).toBe(
        'WAPCentral_OptiLens_AI_Integration_Guide.docx',
      );
      expect(
        getIntegrationGuideFilename('FileZen — AI File & Document Manager'),
      ).toBe('WAPCentral_FileZen_Integration_Guide.docx');
      expect(
        getIntegrationGuideFilename('OptiLens AI — Smart Camera & Photo Enhancer'),
      ).toBe('WAPCentral_OptiLens_AI_Integration_Guide.docx');
      expect(
        getIntegrationGuideFilename('Special: App / 2026! * Test'),
      ).toBe('WAPCentral_Special_App_2026_Test_Integration_Guide.docx');
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

    it('allows authorized admin to download', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('supports /api/admin/v1 prefix alias', async () => {
      const res = await request(app)
        .get('/api/admin/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });
  });

  describe('FileZen Document Generation & Verification', () => {
    it('generates a valid docx with FileZen-specific configuration and no leakage', async () => {
      const res = await request(app)
        .get('/v1/apps/filezen/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Integration_Guide.docx"',
      );

      // Verify DOCX contents
      const zip = new PizZip(res.body);
      const xml = zip.file('word/document.xml')?.asText();
      expect(xml).toBeDefined();

      // Application Identity
      expect(xml).toContain('FileZen');
      expect(xml).toContain('filezen');
      expect(xml).toContain('wap_key_filezen_prod');
      expect(xml).toContain('com.webappypie.filezen');

      // Enabled SDKs in Table 3
      expect(xml).toContain('wap_core_sdk');
      expect(xml).toContain('wap_ai_sdk');
      expect(xml).toContain('wap_ocr_sdk');
      expect(xml).toContain('wap_file_sdk');
      expect(xml).toContain('wap_ads_sdk');
      expect(xml).toContain('wap_notifications_sdk');

      // API Catalog Permissions
      expect(xml).toContain('ai — Enabled');
      expect(xml).toContain('ocr — Enabled');
      expect(xml).toContain('files — Enabled');
      expect(xml).toContain('image — Not enabled for this app');

      // Ads Section
      expect(xml).toContain('8. Ads — Controlled by WAPCentral');
      expect(xml).toContain('wap_ads_sdk fetches the effective configuration');
      expect(xml).toContain(
        'Testing configuration is controlled centrally by WAPCentral. The mobile app must not hardcode fake production IDs.',
      );

      // Startup Sequence
      expect(xml).toContain('10. App Startup Sequence');
      expect(xml).toContain('https://wapcentral-prod.web.app/api/platform/v1');
      expect(xml).toContain('preferLocal');

      // Data Isolation: Never leak OptiLens configuration
      expect(xml).not.toContain('com.webappypie.optilens');
      expect(xml).not.toContain('wap_key_optilens_prod');
    });
  });

  describe('OptiLens AI Document Generation & Verification', () => {
    it('generates a valid docx with OptiLens-specific configuration and no leakage', async () => {
      const res = await request(app)
        .get('/v1/apps/optilens/integration-guide')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_OptiLens_AI_Integration_Guide.docx"',
      );

      const zip = new PizZip(res.body);
      const xml = zip.file('word/document.xml')?.asText();
      expect(xml).toBeDefined();

      // Application Identity
      expect(xml).toContain('OptiLens AI');
      expect(xml).toContain('optilens');
      expect(xml).toContain('wap_key_optilens_prod');
      expect(xml).toContain('com.webappypie.optilens');

      // Enabled SDKs in Table 3: OptiLens has Image, AI, Ads, Notifications
      expect(xml).toContain('wap_core_sdk');
      expect(xml).toContain('wap_image_sdk');
      expect(xml).toContain('wap_ai_sdk');
      expect(xml).toContain('wap_ads_sdk');
      expect(xml).toContain('wap_notifications_sdk');

      // API Catalog Permissions
      expect(xml).toContain('image — Enabled');
      expect(xml).toContain('ai — Enabled');
      expect(xml).toContain('ocr — Not enabled for this app');
      expect(xml).toContain('files — Not enabled for this app');

      // Data Isolation: Never leak FileZen configuration
      expect(xml).not.toContain('com.webappypie.filezen');
      expect(xml).not.toContain('wap_key_filezen_prod');
    });
  });

  describe('Custom App with Real Firestore IDs & Missing Value Handling', () => {
    it('correctly handles app_1791324566055 with real Firebase values and missing placeholders', async () => {
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
        .set('Authorization', SUPER_ADMIN_AUTH)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="WAPCentral_FileZen_Production_Integration_Guide.docx"',
      );

      const zip = new PizZip(res.body);
      const xml = zip.file('word/document.xml')?.asText();
      expect(xml).toBeDefined();

      // App identity
      expect(xml).toContain('FileZen Production');
      expect(xml).toContain('app_1791324566055');
      expect(xml).toContain('wap_key_filezen_live_secret123');
      expect(xml).toContain('com.webappypie.filezen.prod');

      // Real configured Firebase values
      expect(xml).toContain('filezen-prod-firebase');
      expect(xml).toContain('1:9876543210:android:abc999');

      // Missing Firebase values should strictly show the approved placeholder
      expect(xml).toContain('Configured in Firebase — not stored in WAPCentral');

      // Missing bundleId should show Not configured
      expect(xml).toContain('Not configured');
    });
  });
});
