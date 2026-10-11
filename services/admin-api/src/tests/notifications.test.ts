import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { clearAuditLogsForTest } from '../services/auditService.js';
import { COLLECTIONS } from '@wapcentral/config';
import {
  registerMemoryApp,
  resetPlatformQuotaForTest,
} from '../platform/middleware/platformAuth.js';
import {
  updateNotificationSettings,
  registerDevice,
  createNotification,
} from '../services/notificationService.js';

describe('Central Notification System (Step 3: admin-api & platform)', () => {
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const EDITOR_AUTH = 'Bearer test-editor-token';
  const VIEWER_AUTH = 'Bearer test-viewer-token';

  beforeEach(() => {
    clearInMemoryFirestoreForTest();
    clearAuditLogsForTest();
    resetPlatformQuotaForTest();

    // Register apps in test memory
    registerMemoryApp({
      id: 'filezen',
      name: 'FileZen — AI File & Document Manager',
      packageId: 'com.webappypie.filezen',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_filezen_prod',
      allowedServices: ['ads', 'notifications', 'ai', 'ocr', 'files'],
      enabledModules: ['ads', 'notifications', 'ai', 'ocr', 'file_intelligence'],
      serviceQuotas: {
        notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
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
      allowedServices: ['ads', 'notifications', 'image'],
      enabledModules: ['ads', 'notifications', 'image_intelligence'],
      serviceQuotas: {
        notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe('1. Platform APIs — Device Registration & Lifecycle', () => {
    it('should register a device and FCM token with app association', async () => {
      const res = await request(app)
        .post('/api/platform/v1/notifications/devices/register')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          deviceId: 'device_001',
          fcmToken: 'fcm_token_sample_abc123456789',
          platform: 'android',
          appVersion: '1.0.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceId).toBe('device_001');
    });

    it('should enforce app isolation: reject registration if payload appId does not match caller', async () => {
      const res = await request(app)
        .post('/api/platform/v1/notifications/devices/register')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'optilens', // Spoofing different app
          deviceId: 'device_001',
          fcmToken: 'fcm_token_sample_abc123',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APP_ISOLATION_VIOLATION');
    });

    it('should unregister a device on logout', async () => {
      // First register
      await request(app)
        .post('/api/platform/v1/notifications/devices/register')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          deviceId: 'device_002',
          fcmToken: 'fcm_token_sample_xyz',
        });

      // Unregister
      const res = await request(app)
        .post('/api/platform/v1/notifications/devices/unregister')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          deviceId: 'device_002',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Platform APIs — Effective Config & User Preferences', () => {
    it('should return effective notification configuration', async () => {
      const res = await request(app)
        .get('/api/platform/v1/notifications/config?deviceId=dev_test')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appId).toBe('filezen');
      expect(res.body.data.notificationsEnabled).toBe(true);
      expect(res.body.data.activeCategories.length).toBeGreaterThan(0);
    });

    it('should get and update user notification preferences', async () => {
      // Update preferences
      const putRes = await request(app)
        .put('/api/platform/v1/notifications/preferences')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          deviceId: 'dev_user_01',
          notificationsEnabled: true,
          promotionalEnabled: false, // Opt out of promos
          categories: {
            PROMOTION: false,
            FEATURE: true,
          },
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.promotionalEnabled).toBe(false);
      // Mandatory categories must stay true
      expect(putRes.body.data.categories.SYSTEM).toBe(true);

      // Fetch preferences
      const getRes = await request(app)
        .get('/api/platform/v1/notifications/preferences?deviceId=dev_user_01')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.promotionalEnabled).toBe(false);
    });
  });

  describe('3. Admin APIs — Create, List, and Send Notifications', () => {
    it('should create a notification via admin API', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'System Maintenance Notice',
          message: 'WAPCentral scheduled maintenance tonight at 02:00 UTC.',
          category: 'MAINTENANCE',
          type: 'maintenance',
          priority: 'high',
          targetType: 'all_apps',
          targetAppIds: ['filezen', 'optilens'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toMatch(/^notif_/);
      expect(res.body.data.status).toBe('draft');
    });

    it('should send notification and dispatch to registered devices', async () => {
      // 1. Register a test device
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_push_target_1',
        fcmToken: 'fcm_token_device_target_12345678',
        platform: 'android',
      });

      // 2. Create notification
      const createRes = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Welcome to FileZen 2.0',
          message: 'Explore our new AI duplicate cleaner.',
          category: 'FEATURE',
          type: 'announcement',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          deepLink: 'filezen://features/cleaner',
        });

      const notificationId = createRes.body.data.id;

      // 3. Send notification
      const sendRes = await request(app)
        .post(`/api/admin/v1/notifications/${notificationId}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.data.status).toBe('sent');
      expect(sendRes.body.dispatchResult.successCount).toBe(1);
    });

    it('should filter out promotional notification when user opted out', async () => {
      // 1. Register device with promo opt-out
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_no_promo_user',
        fcmToken: 'fcm_token_no_promo_user_99999999',
        platform: 'android',
      });

      await request(app)
        .put('/api/platform/v1/notifications/preferences')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          deviceId: 'dev_no_promo_user',
          notificationsEnabled: true,
          promotionalEnabled: false,
          categories: { PROMOTION: false },
        });

      // 2. Send promotional notification
      const createRes = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: '50% Off Cloud Storage',
          message: 'Upgrade now to get double storage.',
          category: 'PROMOTION',
          type: 'promotion',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          schedule: 'now',
        });

      expect(createRes.status).toBe(201);
      // Delivery should not have targeted the opted-out user
      expect(createRes.body.dispatchResult.successCount).toBe(0);
    });
  });

  describe('4. In-App Bell Notification System', () => {
    it('should fetch in-app notifications for bell icon, track unread count, and mark as read', async () => {
      // Register device
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_bell_user',
        fcmToken: 'fcm_token_bell_user_11111111',
        platform: 'android',
      });

      // Send 2 notifications to filezen
      const n1 = await createNotification(
        {
          title: 'File Backup Completed',
          message: '124 files backed up safely.',
          category: 'SYSTEM',
          type: 'system',
          priority: 'normal',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          schedule: 'now',
        },
        { id: 'admin', role: 'admin' },
      );

      const n2 = await createNotification(
        {
          title: 'Storage Warning',
          message: 'Your storage is 90% full.',
          category: 'IMPORTANT',
          type: 'important',
          priority: 'high',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          schedule: 'now',
        },
        { id: 'admin', role: 'admin' },
      );

      // Send both notifications to registered device
      await request(app)
        .post(`/api/admin/v1/notifications/${n1.id}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      await request(app)
        .post(`/api/admin/v1/notifications/${n2.id}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      // Check unread count
      const countRes = await request(app)
        .get('/api/platform/v1/notifications/unread-count?deviceId=dev_bell_user')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(countRes.status).toBe(200);
      expect(countRes.body.data.unreadCount).toBe(2);

      // List notifications
      const listRes = await request(app)
        .get('/api/platform/v1/notifications?deviceId=dev_bell_user')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBe(2);

      // Mark one as read
      const readRes = await request(app)
        .post(`/api/platform/v1/notifications/${n1.id}/read`)
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ deviceId: 'dev_bell_user' });

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.readAt).toBeDefined();

      // Check updated unread count
      const updatedCountRes = await request(app)
        .get('/api/platform/v1/notifications/unread-count?deviceId=dev_bell_user')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(updatedCountRes.body.data.unreadCount).toBe(1);

      // Mark all as read
      const markAllRes = await request(app)
        .post('/api/platform/v1/notifications/read-all')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ deviceId: 'dev_bell_user' });

      expect(markAllRes.status).toBe(200);

      // Check unread count is now 0
      const finalCount = await request(app)
        .get('/api/platform/v1/notifications/unread-count?deviceId=dev_bell_user')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(finalCount.body.data.unreadCount).toBe(0);
    });

    it('should track notification opened event', async () => {
      const n = await createNotification(
        {
          title: 'Special Event',
          message: 'Tap to see event details.',
          category: 'FEATURE',
          type: 'announcement',
          priority: 'normal',
          targetType: 'all_apps',
          targetAppIds: ['filezen'],
          schedule: 'now',
        },
        { id: 'admin', role: 'admin' },
      );

      const trackRes = await request(app)
        .post('/api/platform/v1/notifications/track')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          notificationId: n.id,
          deviceId: 'dev_bell_user',
          event: 'opened',
        });

      expect(trackRes.status).toBe(200);
      expect(trackRes.body.success).toBe(true);
    });
  });

  describe('5. Emergency Kill Switches & Hierarchical Enforcement', () => {
    it('Global Kill Switch immediately suppresses notification sending', async () => {
      // Activate global kill switch
      await updateNotificationSettings(
        { globalNotificationsOff: true },
        { id: 'superadmin', role: 'super_admin' },
      );

      const n = await createNotification(
        {
          title: 'Important Alert',
          message: 'Testing kill switch',
          category: 'IMPORTANT',
          type: 'important',
          priority: 'high',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
        },
        { id: 'admin', role: 'admin' },
      );

      const res = await request(app)
        .post(`/api/admin/v1/notifications/${n.id}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(500);
      expect(res.body.error.message).toContain('GLOBAL_NOTIFICATIONS_OFF');
    });

    it('App Kill Switch suppresses notifications for that app only', async () => {
      await updateNotificationSettings(
        {
          globalNotificationsOff: false,
          appKillSwitches: { filezen: true },
        },
        { id: 'superadmin', role: 'super_admin' },
      );

      const n = await createNotification(
        {
          title: 'FileZen Alert',
          message: 'Test app kill switch',
          category: 'IMPORTANT',
          type: 'important',
          priority: 'high',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
        },
        { id: 'admin', role: 'admin' },
      );

      const res = await request(app)
        .post(`/api/admin/v1/notifications/${n.id}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(500);
      expect(res.body.error.message).toContain('APP_KILL_SWITCH_ACTIVE');
    });
  });

  describe('6. Application Events API (Authorized Backend Events)', () => {
    it('should create and dispatch transactional notification from authorized backend event', async () => {
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_cleanup_client',
        fcmToken: 'fcm_token_dev_cleanup_client',
        platform: 'android',
      });

      const res = await request(app)
        .post('/api/platform/v1/notifications/events')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          title: 'Cleanup Complete',
          message: '1.2 GB of temporary storage freed up.',
          category: 'SYSTEM',
          priority: 'high',
          deepLink: 'filezen://cleanup/summary',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notificationId).toMatch(/^notif_/);
    });
  });

  describe('7. Admin Overview & Analytics', () => {
    it('should return aggregated overview metrics for admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/v1/notifications/overview')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeDevicesCount).toBeDefined();
      expect(res.body.data.categoryDistribution).toBeDefined();
    });
  });

  describe('8. Zero-Undefined Firestore Document Validation & Send Scenarios', () => {
    function findUndefinedPaths(obj: any, path = ''): string[] {
      const paths: string[] = [];
      if (obj === null || obj === undefined) {
        if (obj === undefined) paths.push(path || 'ROOT');
        return paths;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          const curPath = path ? `${path}.${key}` : key;
          if (val === undefined) {
            paths.push(curPath);
          } else if (typeof val === 'object' && val !== null) {
            paths.push(...findUndefinedPaths(val, curPath));
          }
        }
      }
      return paths;
    }

    it('1. Test Send Now: immediately dispatches notification and contains zero undefined fields in Firestore', async () => {
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_send_now_01',
        fcmToken: 'fcm_token_send_now_12345678',
        platform: 'android',
      });

      const res = await request(app)
        .post('/api/admin/v1/notifications?send=true')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Immediate Alert',
          message: 'This notification is sent right now.',
          category: 'SYSTEM',
          type: 'system',
          priority: 'high',
          targetType: 'all_apps',
          schedule: 'now',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(true);
      expect(res.body.data.status).toBe('sent');

      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;
      expect(rawDoc).toBeDefined();

      // Verify zero undefined fields
      const undefinedPaths = findUndefinedPaths(rawDoc);
      expect(undefinedPaths).toEqual([]);

      // Verify required fields and omission of optional unprovided fields
      expect(rawDoc['targetDeviceTokens']).toBeUndefined();
      expect('targetDeviceTokens' in rawDoc).toBe(false);
      expect('imageUrl' in rawDoc).toBe(false);
      expect('deepLink' in rawDoc).toBe(false);
      expect('scheduledAt' in rawDoc).toBe(false);
      expect(rawDoc['status']).toBe('sent');
      expect(rawDoc['sentAt']).toBeDefined();
    });

    it('2. Test app-specific notification: targets specified app and contains zero undefined fields', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'App Specific Update',
          message: 'Update only for FileZen.',
          category: 'UPDATE',
          type: 'update',
          priority: 'normal',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          targetAppId: 'filezen',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.targetType).toBe('specific_app');
      expect(res.body.data.targetAppIds).toEqual(['filezen']);

      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;
      expect(rawDoc).toBeDefined();

      const undefinedPaths = findUndefinedPaths(rawDoc);
      expect(undefinedPaths).toEqual([]);

      expect(rawDoc['targetAppId']).toBe('filezen');
      expect('targetDeviceTokens' in rawDoc).toBe(false);
    });

    it('3. Test notification with image: correctly writes valid imageUrl and zero undefined fields', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Feature with Banner',
          message: 'Check out the new feature image.',
          category: 'FEATURE',
          targetType: 'all_apps',
          imageUrl: 'https://images.webappypie.com/banners/promo.png',
        });

      expect(res.status).toBe(201);
      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect(rawDoc['imageUrl']).toBe('https://images.webappypie.com/banners/promo.png');
    });

    it('4. Test notification without image: omits imageUrl completely from Firestore document', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'No Image Notification',
          message: 'This text-only notification has no imageUrl.',
          category: 'IMPORTANT',
          targetType: 'all_apps',
          imageUrl: '',
        });

      expect(res.status).toBe(201);
      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect('imageUrl' in rawDoc).toBe(false);
      expect(rawDoc['imageUrl']).toBeUndefined();
    });

    it('5. Test notification with deep link: correctly writes valid deepLink and zero undefined fields', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Storage Full',
          message: 'Tap to open cleaner tool.',
          category: 'IMPORTANT',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          deepLink: 'filezen://cleaner/duplicate_files',
        });

      expect(res.status).toBe(201);
      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect(rawDoc['deepLink']).toBe('filezen://cleaner/duplicate_files');
    });

    it('6. Test notification without deep link: omits deepLink completely from Firestore document', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Plain Notice',
          message: 'No deep link provided here.',
          category: 'MAINTENANCE',
          targetType: 'all_apps',
        });

      expect(res.status).toBe(201);
      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect('deepLink' in rawDoc).toBe(false);
      expect(rawDoc['deepLink']).toBeUndefined();
    });

    it('7. Verify Firestore document contains no undefined fields across full audit of optional properties', async () => {
      // Test payload providing partial optional fields (metadata, templateId, scheduledAt)
      const res = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Scheduled Promo Campaign',
          message: 'Campaign with metadata and scheduled time.',
          category: 'PROMOTION',
          type: 'promotion',
          priority: 'normal',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          targetAppId: 'filezen',
          templateId: 'tmpl_season_sale',
          metadata: { campaignCode: 'SUMMER_2026', source: 'dashboard' },
          schedule: '2026-12-01T09:00:00.000Z',
        });

      expect(res.status).toBe(201);
      const notifId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect(rawDoc['templateId']).toBe('tmpl_season_sale');
      expect(rawDoc['metadata']).toEqual({ campaignCode: 'SUMMER_2026', source: 'dashboard' });
      expect(rawDoc['scheduledAt']).toBe('2026-12-01T09:00:00.000Z');
      expect(rawDoc['status']).toBe('scheduled');
      expect('imageUrl' in rawDoc).toBe(false);
      expect('deepLink' in rawDoc).toBe(false);
      expect('targetDeviceTokens' in rawDoc).toBe(false);

      // Verify updateNotification also never leaves undefined
      const updateRes = await request(app)
        .put(`/api/admin/v1/notifications/${notifId}`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          message: 'Updated message without any undefined fields.',
          deepLink: '',
        });

      expect(updateRes.status).toBe(200);
      const updatedRawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATIONS).doc(notifId).get()).data()!;
      expect(findUndefinedPaths(updatedRawDoc)).toEqual([]);
      expect('deepLink' in updatedRawDoc).toBe(false);
    });

    it('8. Verify notification history: lists all notifications in correct descending order', async () => {
      // Create test notifications to populate history
      await createNotification(
        {
          title: 'First History Notification',
          message: 'First notification body',
          category: 'SYSTEM',
          targetType: 'all_apps',
          priority: 'normal',
        },
        { id: 'admin', role: 'admin' },
      );

      await new Promise((resolve) => setTimeout(resolve, 20));

      await createNotification(
        {
          title: 'Second History Notification',
          message: 'Second notification body',
          category: 'PROMOTION',
          targetType: 'all_apps',
          priority: 'high',
        },
        { id: 'admin', role: 'admin' },
      );

      const listRes = await request(app)
        .get('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.items)).toBe(true);
      expect(listRes.body.items.length).toBeGreaterThanOrEqual(2);

      // Verify descending order by createdAt
      for (let i = 0; i < listRes.body.items.length - 1; i++) {
        const t1 = new Date(listRes.body.items[i].createdAt).getTime();
        const t2 = new Date(listRes.body.items[i + 1].createdAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('9. Verify app isolation: notifications targeted to filezen are never delivered to optilens', async () => {
      // Register device for filezen
      await registerDevice({
        appId: 'filezen',
        deviceId: 'dev_iso_filezen',
        fcmToken: 'token_iso_filezen_123',
        platform: 'android',
      });

      // Register device for optilens
      await registerDevice({
        appId: 'optilens',
        deviceId: 'dev_iso_optilens',
        fcmToken: 'token_iso_optilens_456',
        platform: 'android',
      });

      // Send notification targeting FileZen only
      const createRes = await request(app)
        .post('/api/admin/v1/notifications')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'FileZen Exclusive',
          message: 'Only for FileZen users.',
          category: 'SYSTEM',
          targetType: 'specific_app',
          targetAppIds: ['filezen'],
          schedule: 'now',
        });

      expect(createRes.status).toBe(201);
      const notifId = createRes.body.data.id;

      await request(app)
        .post(`/api/admin/v1/notifications/${notifId}/send`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      // Check FileZen bell notifications -> must contain exclusive notification
      const filezenBell = await request(app)
        .get('/api/platform/v1/notifications?deviceId=dev_iso_filezen')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(filezenBell.status).toBe(200);
      expect(filezenBell.body.data.items.some((i: any) => i.id === notifId)).toBe(true);

      // Check OptiLens bell notifications -> must NOT contain exclusive notification
      const optilensBell = await request(app)
        .get('/api/platform/v1/notifications?deviceId=dev_iso_optilens')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod');

      expect(optilensBell.status).toBe(200);
      expect(optilensBell.body.data.items.some((i: any) => i.id === notifId)).toBe(false);
    });

    it('10. Verify template creation with/without optional fields contains zero undefined fields', async () => {
      const res = await request(app)
        .post('/api/admin/v1/notifications/templates')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          name: 'Welcome Template',
          title: 'Welcome to {{appName}}',
          body: 'Hello {{userName}}, welcome aboard!',
          category: 'SYSTEM',
          variables: ['appName', 'userName'],
        });

      expect(res.status).toBe(201);
      const tmplId = res.body.data.id;
      const rawDoc = (await getFirestoreDb().collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(tmplId).get()).data()!;

      expect(findUndefinedPaths(rawDoc)).toEqual([]);
      expect('imageUrl' in rawDoc).toBe(false);
      expect('deepLink' in rawDoc).toBe(false);
      expect('sound' in rawDoc).toBe(false);
      expect('badge' in rawDoc).toBe(false);
      expect('dataPayload' in rawDoc).toBe(false);
    });
  });
});
