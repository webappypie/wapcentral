import crypto from 'crypto';
import { COLLECTIONS, NOTIFICATIONS_CONFIG } from '@wapcentral/config';
import type {
  NotificationDoc,
  NotificationRecipientDoc,
  NotificationDeviceDoc,
  NotificationPreferencesDoc,
  NotificationCategoryDoc,
  NotificationTemplateDoc,
  NotificationDeliveryLogDoc,
  NotificationAuditLogDoc,
  NotificationSettingsDoc,
  NotificationOverviewMetrics,
  NotificationCategory,
  NotificationStatus,
  PlatformNotificationConfigResponse,
} from '@wapcentral/types';
import {
  CreateNotificationSchema,
  CreateNotificationTemplateSchema,
  type CreateNotificationInput,
  type UpdateNotificationInput,
  type CreateNotificationTemplateInput,
  type UpdateNotificationTemplateInput,
  type RegisterNotificationDeviceInput,
  type UpdateNotificationPreferencesInput,
  type UpdateNotificationSettingsInput,
  type PlatformNotificationEventRequestInput,
} from '@wapcentral/validation';
import { getFirestoreDb } from './firestore.js';
import { dispatchFcmMulticast, type FcmDispatchResult } from './fcmService.js';

// ============================================================
// Sanitization Helper: Recursively strip undefined properties
// ============================================================
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }

  if (obj instanceof Date) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = typeof value === 'object' && value !== null ? stripUndefined(value) : value;
    }
  }
  return result as T;
}

// ============================================================
// Privacy Helper: Mask device token for privacy-safe logs
// ============================================================
export function maskDeviceToken(token: string): string {
  if (!token || token.length < 10) return 'token_***';
  return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
}

// ============================================================
// Default Categories & Settings
// ============================================================
const DEFAULT_CATEGORIES: NotificationCategoryDoc[] = [
  { id: 'SYSTEM', name: 'System Notifications', description: 'Critical platform messages', isMandatory: true, defaultEnabled: true },
  { id: 'SECURITY', name: 'Security Alerts', description: 'Account and device security notices', isMandatory: true, defaultEnabled: true },
  { id: 'MAINTENANCE', name: 'Service Maintenance', description: 'Planned maintenance and downtime', isMandatory: true, defaultEnabled: true },
  { id: 'IMPORTANT', name: 'Important Notices', description: 'Crucial app updates and operational alerts', isMandatory: false, defaultEnabled: true },
  { id: 'UPDATE', name: 'Application Updates', description: 'New releases and version changes', isMandatory: false, defaultEnabled: true },
  { id: 'FEATURE', name: 'Feature Announcements', description: 'Product feature walkthroughs and improvements', isMandatory: false, defaultEnabled: true },
  { id: 'PROMOTION', name: 'Promotions & Offers', description: 'Special offers and app cross-promotions', isMandatory: false, defaultEnabled: true },
  { id: 'CUSTOM', name: 'Custom App Events', description: 'Application-specific notifications and events', isMandatory: false, defaultEnabled: true },
];

const DEFAULT_SETTINGS: NotificationSettingsDoc = {
  id: 'global',
  globalNotificationsOff: false,
  appKillSwitches: {},
  categoryKillSwitches: {
    SYSTEM: false,
    SECURITY: false,
    MAINTENANCE: false,
    IMPORTANT: false,
    UPDATE: false,
    FEATURE: false,
    PROMOTION: false,
    CUSTOM: false,
  },
  campaignKillSwitches: {},
  updatedAt: new Date().toISOString(),
};

// ============================================================
// Actor Type for Audit Logs
// ============================================================
export interface NotificationActor {
  id: string;
  email?: string | undefined;
  role?: string | undefined;
}

// ============================================================
// Audit Logging Helper
// ============================================================
export async function logNotificationAudit(log: Omit<NotificationAuditLogDoc, 'id' | 'timestamp'>): Promise<void> {
  const db = getFirestoreDb();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const auditDoc: NotificationAuditLogDoc = stripUndefined({
    ...log,
    id,
    timestamp: new Date().toISOString(),
  });

  try {
    await db.collection(COLLECTIONS.NOTIFICATION_AUDIT_LOGS).doc(id).set(auditDoc);
  } catch (err) {
    console.error('[NotificationService] Failed to record audit log:', err);
  }
}

// ============================================================
// 1. Settings & Kill Switch Management
// ============================================================
export async function getNotificationSettings(): Promise<NotificationSettingsDoc> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS).doc('global').get();
  if (!doc.exists) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...(doc.data() as Partial<NotificationSettingsDoc>) };
}

export async function updateNotificationSettings(
  input: UpdateNotificationSettingsInput,
  actor: NotificationActor,
): Promise<NotificationSettingsDoc> {
  const db = getFirestoreDb();
  const current = await getNotificationSettings();

  const updated: NotificationSettingsDoc = stripUndefined({
    ...current,
    ...(input.globalNotificationsOff !== undefined ? { globalNotificationsOff: input.globalNotificationsOff } : {}),
    appKillSwitches: {
      ...current.appKillSwitches,
      ...(input.appKillSwitches || {}),
    },
    categoryKillSwitches: {
      ...current.categoryKillSwitches,
      ...(input.categoryKillSwitches as any || {}),
    },
    campaignKillSwitches: {
      ...current.campaignKillSwitches,
      ...(input.campaignKillSwitches || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email || actor.id,
  });

  await db.collection(COLLECTIONS.NOTIFICATION_SETTINGS).doc('global').set(updated);

  await logNotificationAudit({
    actor,
    action: 'UPDATE_NOTIFICATION_SETTINGS',
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

/**
 * Resolves all identifier aliases for a list of app identifiers.
 * E.g., maps 'filezen' <-> 'app_1791324566055' and package IDs.
 */
export async function resolveAppIdAliases(appIds: string[]): Promise<Set<string>> {
  const aliases = new Set<string>(appIds);
  try {
    const db = getFirestoreDb();
    const appsSnap = await db.collection(COLLECTIONS.APPS).get();
    for (const doc of appsSnap.docs) {
      const data = doc.data() || {};
      const docId = doc.id;
      const appNameClean = typeof data['name'] === 'string' ? data['name'].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
      const pkgId = typeof data['packageId'] === 'string' ? data['packageId'] : '';

      const matches = appIds.some((id) => {
        const idLower = id.toLowerCase().replace(/[^a-z0-9]/g, '');
        return id === docId || idLower === appNameClean || id === pkgId;
      });

      if (matches) {
        aliases.add(docId);
        if (appNameClean) aliases.add(appNameClean);
        if (pkgId) aliases.add(pkgId);
      }
    }
  } catch {
    // Ignore error
  }
  return aliases;
}

export async function checkNotificationSuppression(
  appId: string,
  category: NotificationCategory,
  campaignId?: string,
): Promise<{ suppressed: boolean; reason?: string }> {
  const settings = await getNotificationSettings();

  if (settings.globalNotificationsOff) {
    return { suppressed: true, reason: 'GLOBAL_NOTIFICATIONS_OFF' };
  }

  if (settings.appKillSwitches[appId]) {
    return { suppressed: true, reason: `APP_KILL_SWITCH_ACTIVE (${appId})` };
  }

  if (settings.categoryKillSwitches[category]) {
    return { suppressed: true, reason: `CATEGORY_KILL_SWITCH_ACTIVE (${category})` };
  }

  if (campaignId && settings.campaignKillSwitches[campaignId]) {
    return { suppressed: true, reason: `CAMPAIGN_KILL_SWITCH_ACTIVE (${campaignId})` };
  }

  return { suppressed: false };
}

// ============================================================
// 2. Categories
// ============================================================
export async function getNotificationCategories(): Promise<NotificationCategoryDoc[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTIONS.NOTIFICATION_CATEGORIES).get();
  if (snapshot.empty) {
    return DEFAULT_CATEGORIES;
  }
  return snapshot.docs.map((d) => d.data() as NotificationCategoryDoc);
}

export async function updateNotificationCategory(
  id: NotificationCategory,
  input: Partial<NotificationCategoryDoc>,
  actor: NotificationActor,
): Promise<NotificationCategoryDoc> {
  const db = getFirestoreDb();
  const existing = (await db.collection(COLLECTIONS.NOTIFICATION_CATEGORIES).doc(id).get()).data() as NotificationCategoryDoc | undefined;
  const base = existing || DEFAULT_CATEGORIES.find((c) => c.id === id) || {
    id,
    name: id,
    description: '',
    isMandatory: false,
    defaultEnabled: true,
  };

  const updated: NotificationCategoryDoc = stripUndefined({
    ...base,
    ...input,
    id,
  });

  await db.collection(COLLECTIONS.NOTIFICATION_CATEGORIES).doc(id).set(updated);

  await logNotificationAudit({
    actor,
    action: 'UPDATE_NOTIFICATION_CATEGORY',
    requestId: `req_${Date.now()}`,
    before: base as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

// ============================================================
// 3. Device Registration & Preferences
// ============================================================
export async function registerDevice(
  input: RegisterNotificationDeviceInput,
): Promise<{ success: boolean; deviceId: string; registeredAt: string }> {
  const db = getFirestoreDb();
  const now = new Date().toISOString();
  const docId = `${input.appId}_${input.deviceId}`;

  const deviceDoc: NotificationDeviceDoc = {
    id: docId,
    appId: input.appId,
    deviceId: input.deviceId,
    fcmToken: input.fcmToken,
    platform: input.platform || 'android',
    active: true,
    lastSeenAt: now,
    registeredAt: now,
  };
  if (input.appVersion && input.appVersion.trim()) {
    deviceDoc.appVersion = input.appVersion.trim();
  }
  if (input.osVersion && input.osVersion.trim()) {
    deviceDoc.osVersion = input.osVersion.trim();
  }

  await db.collection(COLLECTIONS.NOTIFICATION_DEVICES).doc(docId).set(stripUndefined(deviceDoc), { merge: true });

  return { success: true, deviceId: input.deviceId, registeredAt: now };
}

export async function unregisterDevice(
  appId: string,
  deviceId: string,
): Promise<{ success: boolean }> {
  const db = getFirestoreDb();
  const docId = `${appId}_${deviceId}`;
  const now = new Date().toISOString();

  await db.collection(COLLECTIONS.NOTIFICATION_DEVICES).doc(docId).set(
    { active: false, unregisteredAt: now, lastSeenAt: now },
    { merge: true },
  );

  return { success: true };
}

export async function listRegisteredDevices(appId?: string, limit = 50): Promise<Array<Omit<NotificationDeviceDoc, 'fcmToken'> & { maskedToken: string }>> {
  const db = getFirestoreDb();
  let query = db.collection(COLLECTIONS.NOTIFICATION_DEVICES);
  const snapshot = appId && query.where ? await query.where('appId', '==', appId).get() : await query.get();

  return snapshot.docs.slice(0, limit).map((d) => {
    const data = d.data() as NotificationDeviceDoc;
    return {
      id: data.id,
      appId: data.appId,
      deviceId: data.deviceId,
      maskedToken: maskDeviceToken(data.fcmToken),
      platform: data.platform,
      appVersion: data.appVersion,
      osVersion: data.osVersion,
      active: data.active,
      lastSeenAt: data.lastSeenAt,
      registeredAt: data.registeredAt,
      unregisteredAt: data.unregisteredAt,
    };
  });
}

export async function getNotificationPreferences(
  appId: string,
  deviceId: string,
): Promise<NotificationPreferencesDoc> {
  const db = getFirestoreDb();
  const docId = `${appId}_${deviceId}`;
  const doc = await db.collection(COLLECTIONS.NOTIFICATION_PREFERENCES).doc(docId).get();

  if (doc.exists) {
    return doc.data() as NotificationPreferencesDoc;
  }

  // Default preferences
  return {
    id: docId,
    appId,
    deviceId,
    notificationsEnabled: true,
    promotionalEnabled: true,
    categories: {
      SYSTEM: true,
      SECURITY: true,
      MAINTENANCE: true,
      IMPORTANT: true,
      UPDATE: true,
      FEATURE: true,
      PROMOTION: true,
      CUSTOM: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferencesDoc> {
  const db = getFirestoreDb();
  const docId = `${input.appId}_${input.deviceId}`;
  const now = new Date().toISOString();

  const mergedCategories = {
    ...(input.categories as Record<NotificationCategory, boolean>),
  };
  mergedCategories.SYSTEM = true;
  mergedCategories.SECURITY = true;
  mergedCategories.MAINTENANCE = true;

  const preferencesDoc: NotificationPreferencesDoc = stripUndefined({
    id: docId,
    appId: input.appId,
    deviceId: input.deviceId,
    notificationsEnabled: input.notificationsEnabled ?? true,
    promotionalEnabled: input.promotionalEnabled ?? true,
    categories: mergedCategories,
    updatedAt: now,
  });

  await db.collection(COLLECTIONS.NOTIFICATION_PREFERENCES).doc(docId).set(preferencesDoc);
  return preferencesDoc;
}

// ============================================================
// 4. Platform Effective Notification Config
// ============================================================
export async function getEffectiveNotificationConfig(
  appId: string,
  deviceId?: string,
): Promise<PlatformNotificationConfigResponse> {
  const settings = await getNotificationSettings();
  const categories = await getNotificationCategories();
  const preferences = deviceId ? await getNotificationPreferences(appId, deviceId) : undefined;

  const appKillSwitch = !!settings.appKillSwitches[appId];
  const globalKillSwitch = !!settings.globalNotificationsOff;

  return {
    appId,
    notificationsEnabled: !globalKillSwitch && !appKillSwitch,
    globalNotificationsOff: globalKillSwitch,
    appKillSwitchActive: appKillSwitch,
    activeCategories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      isMandatory: c.isMandatory,
      enabled: !settings.categoryKillSwitches[c.id],
    })),
    preferences: preferences
      ? {
          notificationsEnabled: preferences.notificationsEnabled,
          promotionalEnabled: preferences.promotionalEnabled,
          categories: preferences.categories,
        }
      : undefined,
    version: 'v1',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Safe Notification & Template Payload Builders
// ============================================================
export function buildNotificationDoc(
  input: CreateNotificationInput,
  id: string,
  now: string,
  createdBy: string,
): NotificationDoc {
  const targetAppIds = Array.isArray(input.targetAppIds) && input.targetAppIds.length > 0
    ? input.targetAppIds
    : input.targetAppId
    ? [input.targetAppId]
    : [];

  const docData: NotificationDoc = {
    id,
    title: input.title,
    message: input.message,
    category: input.category || 'SYSTEM',
    type: input.type || 'system',
    priority: input.priority || 'normal',
    targetType: input.targetType || 'all_apps',
    targetAppIds,
    isMandatory: Boolean(input.isMandatory || NOTIFICATIONS_CONFIG.MANDATORY_CATEGORIES.includes(input.category as any)),
    status: input.schedule && input.schedule !== 'now' ? 'scheduled' : 'draft',
    ttlSeconds: input.ttlSeconds || NOTIFICATIONS_CONFIG.DEFAULT_TTL_SECONDS,
    stats: { queued: 0, sent: 0, delivered: 0, opened: 0, failed: 0 },
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Optional: targetAppId (app-specific single target reference)
  if (input.targetAppId && typeof input.targetAppId === 'string' && input.targetAppId.trim()) {
    docData.targetAppId = input.targetAppId.trim();
  } else if (input.targetType === 'specific_app' && targetAppIds.length > 0) {
    docData.targetAppId = targetAppIds[0];
  }

  // Optional: targetDeviceTokens (omit for app-wide notifications or if empty/undefined)
  if (Array.isArray(input.targetDeviceTokens) && input.targetDeviceTokens.length > 0) {
    docData.targetDeviceTokens = input.targetDeviceTokens;
  }

  // Optional: imageUrl
  if (input.imageUrl && typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0) {
    docData.imageUrl = input.imageUrl.trim();
  }

  // Optional: icon
  if (input.icon && typeof input.icon === 'string' && input.icon.trim().length > 0) {
    docData.icon = input.icon.trim();
  }

  // Optional: deepLink
  if (input.deepLink && typeof input.deepLink === 'string' && input.deepLink.trim().length > 0) {
    docData.deepLink = input.deepLink.trim();
  }

  // Optional: externalUrl
  if (input.externalUrl && typeof input.externalUrl === 'string' && input.externalUrl.trim().length > 0) {
    docData.externalUrl = input.externalUrl.trim();
  }

  // Optional: sound
  if (input.sound && typeof input.sound === 'string' && input.sound.trim().length > 0) {
    docData.sound = input.sound.trim();
  }

  // Optional: badge
  if (typeof input.badge === 'number') {
    docData.badge = input.badge;
  }

  // Optional: dataPayload
  if (input.dataPayload && typeof input.dataPayload === 'object' && Object.keys(input.dataPayload).length > 0) {
    docData.dataPayload = stripUndefined(input.dataPayload);
  }

  // Optional: campaignId
  if (input.campaignId && typeof input.campaignId === 'string' && input.campaignId.trim().length > 0) {
    docData.campaignId = input.campaignId.trim();
  }

  // Optional: templateId
  if (input.templateId && typeof input.templateId === 'string' && input.templateId.trim().length > 0) {
    docData.templateId = input.templateId.trim();
  }

  // Optional: metadata
  if (input.metadata && typeof input.metadata === 'object' && Object.keys(input.metadata).length > 0) {
    docData.metadata = stripUndefined(input.metadata as Record<string, unknown>);
  }

  // Optional: schedule & scheduledAt
  if (input.schedule && typeof input.schedule === 'string' && input.schedule.trim().length > 0) {
    docData.schedule = input.schedule.trim();
    if (input.schedule !== 'now') {
      docData.scheduledAt = input.schedule.trim();
    }
  } else if (input.scheduledAt && typeof input.scheduledAt === 'string' && input.scheduledAt.trim().length > 0) {
    docData.scheduledAt = input.scheduledAt.trim();
  }

  // Optional: expiry
  if (input.expiry && typeof input.expiry === 'string' && input.expiry.trim().length > 0) {
    docData.expiry = input.expiry.trim();
  }

  return stripUndefined(docData);
}

export function buildTemplateDoc(
  input: CreateNotificationTemplateInput,
  id: string,
  now: string,
): NotificationTemplateDoc {
  const docData: NotificationTemplateDoc = {
    id,
    name: input.name,
    title: input.title,
    body: input.body,
    category: input.category || 'SYSTEM',
    type: input.type || 'system',
    priority: input.priority || 'normal',
    variables: input.variables || [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.imageUrl && typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0) {
    docData.imageUrl = input.imageUrl.trim();
  }
  if (input.icon && typeof input.icon === 'string' && input.icon.trim().length > 0) {
    docData.icon = input.icon.trim();
  }
  if (input.deepLink && typeof input.deepLink === 'string' && input.deepLink.trim().length > 0) {
    docData.deepLink = input.deepLink.trim();
  }
  if (input.sound && typeof input.sound === 'string' && input.sound.trim().length > 0) {
    docData.sound = input.sound.trim();
  }
  if (typeof input.badge === 'number') {
    docData.badge = input.badge;
  }
  if (input.dataPayload && typeof input.dataPayload === 'object' && Object.keys(input.dataPayload).length > 0) {
    docData.dataPayload = stripUndefined(input.dataPayload);
  }

  return stripUndefined(docData);
}

// ============================================================
// 5. Notifications CRUD & Sending
// ============================================================
export async function createNotification(
  rawInput: CreateNotificationInput,
  actor: NotificationActor,
): Promise<NotificationDoc> {
  const input = CreateNotificationSchema.parse(rawInput);
  const db = getFirestoreDb();
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const createdBy = actor.email || actor.id;

  const notificationDoc = buildNotificationDoc(input, id, now, createdBy);

  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(notificationDoc);

  await logNotificationAudit({
    actor,
    action: 'CREATE_NOTIFICATION',
    appId: notificationDoc.targetAppIds.join(','),
    notificationId: id,
    ...(notificationDoc.campaignId ? { campaignId: notificationDoc.campaignId } : {}),
    requestId: `req_${Date.now()}`,
    after: notificationDoc as unknown as Record<string, unknown>,
  });

  return notificationDoc;
}

export async function sendNotification(
  id: string,
  actor: NotificationActor,
): Promise<{ success: boolean; notification: NotificationDoc; dispatchResult: any }> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).get();

  if (!doc.exists) {
    throw new Error(`Notification '${id}' not found.`);
  }

  const notification = doc.data() as NotificationDoc;

  // Check kill switch for primary targeted apps
  const targetAppId = notification.targetAppIds[0] || 'all';
  const suppression = await checkNotificationSuppression(
    targetAppId,
    notification.category,
    notification.campaignId,
  );

  if (suppression.suppressed) {
    const updated: NotificationDoc = {
      ...notification,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(updated);
    throw new Error(`Notification delivery suppressed by kill switch: ${suppression.reason}`);
  }

  // Resolve target devices
  let targetDevices: NotificationDeviceDoc[] = [];

  if (notification.targetType === 'device_token' && notification.targetDeviceTokens?.length) {
    targetDevices = notification.targetDeviceTokens.map((token, idx) => ({
      id: `dev_${idx}`,
      appId: targetAppId,
      deviceId: `dev_${idx}`,
      fcmToken: token,
      platform: 'android',
      active: true,
      lastSeenAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
    }));
  } else {
    // Query active registered devices
    const devicesSnap = await db.collection(COLLECTIONS.NOTIFICATION_DEVICES).get();
    targetDevices = devicesSnap.docs
      .map((d) => d.data() as NotificationDeviceDoc)
      .filter((d) => d.active);

    if (notification.targetType === 'specific_app' || notification.targetType === 'multiple_apps') {
      const allowedAppIds = await resolveAppIdAliases(notification.targetAppIds);
      targetDevices = targetDevices.filter((d) => allowedAppIds.has(d.appId));
    }
  }

  // Filter against user preferences if not mandatory
  if (!notification.isMandatory) {
    const filtered: NotificationDeviceDoc[] = [];
    for (const dev of targetDevices) {
      const prefs = await getNotificationPreferences(dev.appId, dev.deviceId);
      if (
        prefs.notificationsEnabled !== false &&
        (notification.category !== 'PROMOTION' || prefs.promotionalEnabled !== false) &&
        prefs.categories[notification.category] !== false
      ) {
        filtered.push(dev);
      }
    }
    targetDevices = filtered;
  }

  const requestId = `req_dispatch_${Date.now()}`;
  const now = new Date().toISOString();

  // If no target devices found, record failure delivery log and do NOT report success
  if (targetDevices.length === 0) {
    const logId = `log_${Date.now()}_0_${Math.random().toString(36).substring(2, 6)}`;
    const logDoc: NotificationDeliveryLogDoc = {
      id: logId,
      requestId,
      notificationId: notification.id,
      appId: targetAppId,
      deviceIdentifier: 'none',
      timestamp: now,
      status: 'failed',
      provider: 'fcm',
      attemptCount: 0,
      failureReason: 'No active eligible target devices registered for notification',
    };
    await db.collection(COLLECTIONS.NOTIFICATION_DELIVERY_LOGS).doc(logId).set(stripUndefined(logDoc));

    const updatedNotification: NotificationDoc = stripUndefined({
      ...notification,
      status: 'failed',
      sentAt: now,
      stats: {
        queued: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        failed: 0,
      },
      updatedAt: now,
    });
    await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(updatedNotification);

    await logNotificationAudit({
      actor,
      action: 'SEND_NOTIFICATION',
      appId: notification.targetAppIds.join(','),
      notificationId: id,
      campaignId: notification.campaignId,
      requestId,
      before: notification as unknown as Record<string, unknown>,
      after: updatedNotification as unknown as Record<string, unknown>,
    });

    return {
      success: false,
      notification: updatedNotification,
      dispatchResult: {
        totalRequested: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      },
    };
  }

  // Group target devices by appId for per-app FCM dispatch
  const devicesByAppId = new Map<string, NotificationDeviceDoc[]>();
  for (const dev of targetDevices) {
    const list = devicesByAppId.get(dev.appId) || [];
    list.push(dev);
    devicesByAppId.set(dev.appId, list);
  }

  // Pre-load apps for project configuration
  const appsSnap = await db.collection(COLLECTIONS.APPS).get().catch(() => null);
  const appsById = new Map<string, any>();
  if (appsSnap) {
    appsSnap.docs.forEach((d) => appsById.set(d.id, d.data()));
  }

  let totalRequested = 0;
  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  const allResults: any[] = [];

  for (const [devAppId, devList] of devicesByAppId.entries()) {
    const appData = appsById.get(devAppId);
    const tokens = devList.map((d) => d.fcmToken);

    const fcmResult = await dispatchFcmMulticast({
      tokens,
      title: notification.title,
      body: notification.message,
      imageUrl: notification.imageUrl,
      data: {
        notificationId: notification.id,
        category: notification.category,
        type: notification.type,
        ...(notification.deepLink ? { deepLink: notification.deepLink } : {}),
        ...(notification.externalUrl ? { externalUrl: notification.externalUrl } : {}),
        ...(notification.dataPayload || {}),
      },
      priority: notification.priority,
      ttlSeconds: notification.ttlSeconds,
      sound: notification.sound,
      badge: notification.badge,
      isMandatory: notification.isMandatory,
      appId: devAppId,
      firebaseProjectId: appData?.firebaseProjectId,
      fcmCredentialsSecretName: appData?.fcmCredentialsSecretName,
    });

    totalRequested += fcmResult.totalRequested;
    totalSuccessCount += fcmResult.successCount;
    totalFailureCount += fcmResult.failureCount;

    // Create per-device recipient and delivery log records with detailed error information
    for (let i = 0; i < devList.length; i++) {
      const dev = devList[i]!;
      const res = fcmResult.results[i];
      const isSuccess = res?.success ?? false;
      allResults.push(res);

      const logId = `log_${Date.now()}_${allResults.length}_${Math.random().toString(36).substring(2, 6)}`;
      const logDoc: NotificationDeliveryLogDoc = {
        id: logId,
        requestId,
        notificationId: notification.id,
        appId: dev.appId,
        deviceId: dev.deviceId,
        deviceIdentifier: maskDeviceToken(dev.fcmToken),
        timestamp: now,
        status: isSuccess ? 'sent' : 'failed',
        provider: 'fcm',
        attemptCount: 1,
      };
      if (res?.error) {
        logDoc.failureReason = `${res.errorCode ? `[${res.errorCode}] ` : ''}${res.error}`;
      }
      if (res?.messageId) {
        logDoc.messageId = res.messageId;
      }
      await db.collection(COLLECTIONS.NOTIFICATION_DELIVERY_LOGS).doc(logId).set(stripUndefined(logDoc));

      // Auto-deactivate stale or unregistered device tokens in the registry
      if (!isSuccess && (res?.errorCode === 'messaging/registration-token-not-registered' || res?.errorCode === 'messaging/invalid-argument')) {
        await db.collection(COLLECTIONS.NOTIFICATION_DEVICES).doc(dev.id).set({
          active: false,
          unregisteredAt: now,
        }, { merge: true }).catch(() => null);
      }

      // Recipient record (for in-app bell)
      const recipientId = `${notification.id}_${dev.deviceId}`;
      const recipientDoc: NotificationRecipientDoc = {
        id: recipientId,
        notificationId: notification.id,
        appId: dev.appId,
        deviceId: dev.deviceId,
        deviceToken: maskDeviceToken(dev.fcmToken),
        status: isSuccess ? 'sent' : 'failed',
        read: false,
        createdAt: now,
        updatedAt: now,
      };
      if (res?.error) {
        recipientDoc.failureReason = `${res.errorCode ? `[${res.errorCode}] ` : ''}${res.error}`;
      }
      await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).doc(recipientId).set(stripUndefined(recipientDoc));

      if (isSuccess) {
        console.log(`[NotificationService] FCM push succeeded for appId=${dev.appId}, deviceId=${dev.deviceId}, messageId=${res?.messageId}`);
      } else {
        console.error(`[NotificationService] FCM push failed for appId=${dev.appId}, deviceId=${dev.deviceId}: ${res?.error || 'Unknown error'}`);
      }
    }
  }

  // Update notification stats - only mark 'sent' or 'partially_delivered' if at least one succeeded
  const finalStatus: NotificationStatus =
    totalSuccessCount > 0
      ? totalFailureCount === 0
        ? 'sent'
        : 'partially_delivered'
      : 'failed';

  const combinedDispatchResult: FcmDispatchResult = {
    totalRequested,
    successCount: totalSuccessCount,
    failureCount: totalFailureCount,
    results: allResults,
  };

  const updatedNotification: NotificationDoc = stripUndefined({
    ...notification,
    status: finalStatus,
    sentAt: now,
    stats: {
      queued: totalRequested,
      sent: totalSuccessCount,
      delivered: totalSuccessCount,
      opened: 0,
      failed: totalFailureCount,
    },
    updatedAt: now,
  });

  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(updatedNotification);

  await logNotificationAudit({
    actor,
    action: 'SEND_NOTIFICATION',
    appId: notification.targetAppIds.join(','),
    notificationId: id,
    campaignId: notification.campaignId,
    requestId,
    before: notification as unknown as Record<string, unknown>,
    after: updatedNotification as unknown as Record<string, unknown>,
  });

  return { success: totalSuccessCount > 0, notification: updatedNotification, dispatchResult: combinedDispatchResult };
}

export async function scheduleNotification(
  id: string,
  scheduledTime: string,
  actor: NotificationActor,
): Promise<NotificationDoc> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).get();
  if (!doc.exists) {
    throw new Error(`Notification '${id}' not found.`);
  }

  const current = doc.data() as NotificationDoc;
  const now = new Date().toISOString();
  const updated: NotificationDoc = stripUndefined({
    ...current,
    status: 'scheduled',
    scheduledAt: scheduledTime,
    schedule: scheduledTime,
    updatedAt: now,
  });

  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(updated);

  await logNotificationAudit({
    actor,
    action: 'SCHEDULE_NOTIFICATION',
    appId: current.targetAppIds.join(','),
    notificationId: id,
    campaignId: current.campaignId,
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

export async function listNotifications(options?: {
  appId?: string | undefined;
  category?: NotificationCategory | undefined;
  status?: string | undefined;
  limit?: number | undefined;
  page?: number | undefined;
} | undefined): Promise<{ items: NotificationDoc[]; total: number; page: number; pageSize: number }> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTIONS.NOTIFICATIONS).get();

  let items = snapshot.docs.map((d) => d.data() as NotificationDoc);

  if (options?.appId) {
    items = items.filter(
      (n) => n.targetType === 'all_apps' || n.targetAppIds.includes(options.appId!),
    );
  }

  if (options?.category) {
    items = items.filter((n) => n.category === options.category);
  }

  if (options?.status) {
    items = items.filter((n) => n.status === options.status);
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = items.length;
  const page = options?.page || 1;
  const pageSize = options?.limit || 50;
  const paginated = items.slice((page - 1) * pageSize, page * pageSize);

  return { items: paginated, total, page, pageSize };
}

export async function getNotification(id: string): Promise<NotificationDoc | null> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).get();
  return doc.exists ? (doc.data() as NotificationDoc) : null;
}

export async function updateNotification(
  id: string,
  input: UpdateNotificationInput,
  actor: NotificationActor,
): Promise<NotificationDoc> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).get();
  if (!doc.exists) {
    throw new Error(`Notification '${id}' not found.`);
  }

  const current = doc.data() as NotificationDoc;
  const updatedDoc: NotificationDoc = {
    ...current,
    title: input.title !== undefined ? input.title : current.title,
    message: input.message !== undefined ? input.message : current.message,
    category: input.category !== undefined ? input.category : current.category,
    type: input.type !== undefined ? input.type : current.type,
    priority: input.priority !== undefined ? input.priority : current.priority,
    targetType: input.targetType !== undefined ? input.targetType : current.targetType,
    targetAppIds: input.targetAppIds !== undefined ? input.targetAppIds : current.targetAppIds,
    ttlSeconds: input.ttlSeconds !== undefined ? input.ttlSeconds : current.ttlSeconds,
    isMandatory: input.isMandatory !== undefined ? input.isMandatory : current.isMandatory,
    status: input.status !== undefined ? input.status : current.status,
    updatedAt: new Date().toISOString(),
  };

  if (input.targetAppId !== undefined) {
    if (input.targetAppId && input.targetAppId.trim()) updatedDoc.targetAppId = input.targetAppId.trim();
    else delete updatedDoc.targetAppId;
  }
  if (input.targetDeviceTokens !== undefined) {
    if (Array.isArray(input.targetDeviceTokens) && input.targetDeviceTokens.length > 0) {
      updatedDoc.targetDeviceTokens = input.targetDeviceTokens;
    } else {
      delete updatedDoc.targetDeviceTokens;
    }
  }
  if (input.imageUrl !== undefined) {
    if (input.imageUrl && input.imageUrl.trim()) updatedDoc.imageUrl = input.imageUrl.trim();
    else delete updatedDoc.imageUrl;
  }
  if (input.icon !== undefined) {
    if (input.icon && input.icon.trim()) updatedDoc.icon = input.icon.trim();
    else delete updatedDoc.icon;
  }
  if (input.deepLink !== undefined) {
    if (input.deepLink && input.deepLink.trim()) updatedDoc.deepLink = input.deepLink.trim();
    else delete updatedDoc.deepLink;
  }
  if (input.externalUrl !== undefined) {
    if (input.externalUrl && input.externalUrl.trim()) updatedDoc.externalUrl = input.externalUrl.trim();
    else delete updatedDoc.externalUrl;
  }
  if (input.sound !== undefined) {
    if (input.sound && input.sound.trim()) updatedDoc.sound = input.sound.trim();
    else delete updatedDoc.sound;
  }
  if (input.badge !== undefined) {
    updatedDoc.badge = input.badge;
  }
  if (input.dataPayload !== undefined) {
    if (input.dataPayload && Object.keys(input.dataPayload).length > 0) {
      updatedDoc.dataPayload = stripUndefined(input.dataPayload);
    } else {
      delete updatedDoc.dataPayload;
    }
  }
  if (input.campaignId !== undefined) {
    if (input.campaignId && input.campaignId.trim()) updatedDoc.campaignId = input.campaignId.trim();
    else delete updatedDoc.campaignId;
  }
  if (input.templateId !== undefined) {
    if (input.templateId && input.templateId.trim()) updatedDoc.templateId = input.templateId.trim();
    else delete updatedDoc.templateId;
  }
  if (input.metadata !== undefined) {
    if (input.metadata && Object.keys(input.metadata).length > 0) {
      updatedDoc.metadata = stripUndefined(input.metadata as Record<string, unknown>);
    } else {
      delete updatedDoc.metadata;
    }
  }
  if (input.schedule !== undefined) {
    if (input.schedule && input.schedule.trim()) updatedDoc.schedule = input.schedule.trim();
    else delete updatedDoc.schedule;
  }
  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt && input.scheduledAt.trim()) updatedDoc.scheduledAt = input.scheduledAt.trim();
    else delete updatedDoc.scheduledAt;
  }
  if (input.expiry !== undefined) {
    if (input.expiry && input.expiry.trim()) updatedDoc.expiry = input.expiry.trim();
    else delete updatedDoc.expiry;
  }

  const cleaned = stripUndefined(updatedDoc);
  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(cleaned);

  await logNotificationAudit({
    actor,
    action: 'UPDATE_NOTIFICATION',
    appId: current.targetAppIds.join(','),
    notificationId: id,
    campaignId: current.campaignId,
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
    after: cleaned as unknown as Record<string, unknown>,
  });

  return cleaned;
}

export async function deleteNotification(
  id: string,
  actor: NotificationActor,
): Promise<{ success: boolean }> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).get();
  if (!doc.exists) {
    return { success: true };
  }

  const current = doc.data() as NotificationDoc;
  await db.collection(COLLECTIONS.NOTIFICATIONS).doc(id).delete();

  await logNotificationAudit({
    actor,
    action: 'DELETE_NOTIFICATION',
    appId: current.targetAppIds.join(','),
    notificationId: id,
    campaignId: current.campaignId,
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
  });

  return { success: true };
}

// ============================================================
// 6. In-App Bell Notification System
// ============================================================
export interface BellNotificationItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: string;
  deepLink?: string | undefined;
  externalUrl?: string | undefined;
  imageUrl?: string | undefined;
  icon?: string | undefined;
  dataPayload?: Record<string, string> | undefined;
  read: boolean;
  readAt?: string | undefined;
  createdAt: string;
}

export async function getBellNotifications(
  appId: string,
  deviceId: string,
  options?: { limit?: number | undefined; page?: number | undefined; category?: string | undefined; unreadOnly?: boolean | undefined } | undefined,
): Promise<{ items: BellNotificationItem[]; unreadCount: number; total: number; page: number }> {
  const db = getFirestoreDb();

  const allowedAppIds = await resolveAppIdAliases([appId]);

  // 1. Fetch notifications applicable to this app
  const notifsSnap = await db.collection(COLLECTIONS.NOTIFICATIONS).get();
  const applicableNotifs = notifsSnap.docs
    .map((d) => d.data() as NotificationDoc)
    .filter(
      (n) =>
        (n.status === 'sent' || n.status === 'partially_delivered') &&
        (n.targetType === 'all_apps' || n.targetAppIds.some((id) => allowedAppIds.has(id))),
    );

  // 2. Fetch recipient records for this device
  const recipientsSnap = await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).get();
  const deviceRecipients = new Map<string, NotificationRecipientDoc>();
  recipientsSnap.docs
    .map((d) => d.data() as NotificationRecipientDoc)
    .filter((r) => r.deviceId === deviceId && (allowedAppIds.has(r.appId) || !r.appId))
    .forEach((r) => deviceRecipients.set(r.notificationId, r));

  // 3. Assemble bell list
  let items: BellNotificationItem[] = applicableNotifs.map((n) => {
    const recipient = deviceRecipients.get(n.id);
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      priority: n.priority,
      deepLink: n.deepLink,
      externalUrl: n.externalUrl,
      imageUrl: n.imageUrl,
      icon: n.icon,
      dataPayload: n.dataPayload,
      read: recipient?.read ?? false,
      readAt: recipient?.readAt,
      createdAt: n.sentAt || n.createdAt,
    };
  });

  // Calculate total unread
  const unreadCount = items.filter((i) => !i.read).length;

  if (options?.category) {
    items = items.filter((i) => i.category === options.category);
  }

  if (options?.unreadOnly) {
    items = items.filter((i) => !i.read);
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = items.length;
  const page = options?.page || 1;
  const limit = options?.limit || 30;
  const paginated = items.slice((page - 1) * limit, page * limit);

  return { items: paginated, unreadCount, total, page };
}

export async function getUnreadCount(appId: string, deviceId: string): Promise<number> {
  const { unreadCount } = await getBellNotifications(appId, deviceId, { limit: 1 });
  return unreadCount;
}

export async function markNotificationAsRead(
  appId: string,
  deviceId: string,
  notificationId: string,
): Promise<{ success: boolean; readAt: string }> {
  const db = getFirestoreDb();
  const recipientId = `${notificationId}_${deviceId}`;
  const now = new Date().toISOString();

  await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).doc(recipientId).set(
    {
      id: recipientId,
      notificationId,
      appId,
      deviceId,
      read: true,
      readAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  return { success: true, readAt: now };
}

export async function markAllNotificationsAsRead(
  appId: string,
  deviceId: string,
): Promise<{ success: boolean; count: number; timestamp: string }> {
  const db = getFirestoreDb();
  const { items } = await getBellNotifications(appId, deviceId);
  const now = new Date().toISOString();
  let count = 0;

  for (const item of items) {
    if (!item.read) {
      const recipientId = `${item.id}_${deviceId}`;
      await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).doc(recipientId).set(
        {
          id: recipientId,
          notificationId: item.id,
          appId,
          deviceId,
          read: true,
          readAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
      count++;
    }
  }

  return { success: true, count, timestamp: now };
}

export async function trackNotificationEvent(
  appId: string,
  notificationId: string,
  deviceId: string,
  event: 'delivered' | 'opened',
): Promise<{ success: boolean }> {
  const db = getFirestoreDb();
  const recipientId = `${notificationId}_${deviceId}`;
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    updatedAt: now,
    status: event,
  };

  if (event === 'delivered') updatePayload['deliveredAt'] = now;
  if (event === 'opened') {
    updatePayload['openedAt'] = now;
    updatePayload['read'] = true;
    updatePayload['readAt'] = now;
  }

  await db.collection(COLLECTIONS.NOTIFICATION_RECIPIENTS).doc(recipientId).set(updatePayload, { merge: true });

  // Update parent notification stats
  const notifDoc = await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).get();
  if (notifDoc.exists) {
    const notif = notifDoc.data() as NotificationDoc;
    const currentStats = notif.stats || { queued: 0, sent: 0, delivered: 0, opened: 0, failed: 0 };
    if (event === 'opened') currentStats.opened = (currentStats.opened || 0) + 1;
    if (event === 'delivered') currentStats.delivered = (currentStats.delivered || 0) + 1;
    await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).set({ stats: currentStats }, { merge: true });
  }

  return { success: true };
}

// ============================================================
// 7. Application Events API (Authorized Backend Events)
// ============================================================
export async function createApplicationEvent(
  callerAppId: string,
  input: PlatformNotificationEventRequestInput,
): Promise<{ success: boolean; notificationId: string; status: string }> {
  if (input.appId !== callerAppId) {
    throw new Error('APP_ISOLATION_VIOLATION: Payload appId must match caller authentication.');
  }

  const notification = await createNotification(
    {
      title: input.title,
      message: input.message,
      category: input.category,
      type: 'custom',
      priority: input.priority || 'high',
      targetType: input.targetDeviceTokens?.length ? 'device_token' : 'specific_app',
      targetAppIds: [callerAppId],
      targetDeviceTokens: input.targetDeviceTokens,
      deepLink: input.deepLink,
      dataPayload: input.dataPayload,
      isMandatory: NOTIFICATIONS_CONFIG.MANDATORY_CATEGORIES.includes(input.category as any),
      schedule: 'now',
    },
    { id: `app_${callerAppId}`, email: `${callerAppId}@backend.app`, role: 'service' },
  );

  const sendResult = await sendNotification(notification.id, {
    id: `app_${callerAppId}`,
    email: `${callerAppId}@backend.app`,
    role: 'service',
  });

  return {
    success: true,
    notificationId: notification.id,
    status: sendResult.notification.status,
  };
}

// ============================================================
// 8. Notification Templates CRUD
// ============================================================
export async function listTemplates(): Promise<NotificationTemplateDoc[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).get();
  return snapshot.docs.map((d) => d.data() as NotificationTemplateDoc);
}

export async function createTemplate(
  rawInput: CreateNotificationTemplateInput,
  actor: NotificationActor,
): Promise<NotificationTemplateDoc> {
  const input = CreateNotificationTemplateSchema.parse(rawInput);
  const db = getFirestoreDb();
  const id = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const template = buildTemplateDoc(input, id, now);

  await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(id).set(template);

  await logNotificationAudit({
    actor,
    action: 'CREATE_NOTIFICATION_TEMPLATE',
    requestId: `req_${Date.now()}`,
    after: template as unknown as Record<string, unknown>,
  });

  return template;
}

export async function updateTemplate(
  id: string,
  input: UpdateNotificationTemplateInput,
  actor: NotificationActor,
): Promise<NotificationTemplateDoc> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(id).get();
  if (!doc.exists) throw new Error(`Template '${id}' not found.`);

  const current = doc.data() as NotificationTemplateDoc;
  const updatedDoc: NotificationTemplateDoc = {
    ...current,
    name: input.name !== undefined ? input.name : current.name,
    title: input.title !== undefined ? input.title : current.title,
    body: input.body !== undefined ? input.body : current.body,
    category: input.category !== undefined ? input.category : current.category,
    type: input.type !== undefined ? input.type : current.type,
    priority: input.priority !== undefined ? input.priority : current.priority,
    variables: input.variables !== undefined ? input.variables : current.variables,
    updatedAt: new Date().toISOString(),
  };

  if (input.imageUrl !== undefined) {
    if (input.imageUrl && input.imageUrl.trim()) updatedDoc.imageUrl = input.imageUrl.trim();
    else delete updatedDoc.imageUrl;
  }
  if (input.icon !== undefined) {
    if (input.icon && input.icon.trim()) updatedDoc.icon = input.icon.trim();
    else delete updatedDoc.icon;
  }
  if (input.deepLink !== undefined) {
    if (input.deepLink && input.deepLink.trim()) updatedDoc.deepLink = input.deepLink.trim();
    else delete updatedDoc.deepLink;
  }
  if (input.sound !== undefined) {
    if (input.sound && input.sound.trim()) updatedDoc.sound = input.sound.trim();
    else delete updatedDoc.sound;
  }
  if (input.badge !== undefined) {
    updatedDoc.badge = input.badge;
  }
  if (input.dataPayload !== undefined) {
    if (input.dataPayload && Object.keys(input.dataPayload).length > 0) {
      updatedDoc.dataPayload = stripUndefined(input.dataPayload);
    } else {
      delete updatedDoc.dataPayload;
    }
  }

  const cleaned = stripUndefined(updatedDoc);
  await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(id).set(cleaned);

  await logNotificationAudit({
    actor,
    action: 'UPDATE_NOTIFICATION_TEMPLATE',
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
    after: cleaned as unknown as Record<string, unknown>,
  });

  return cleaned;
}

export async function deleteTemplate(
  id: string,
  actor: NotificationActor,
): Promise<{ success: boolean }> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(id).get();
  if (!doc.exists) return { success: true };

  const current = doc.data() as NotificationTemplateDoc;
  await db.collection(COLLECTIONS.NOTIFICATION_TEMPLATES).doc(id).delete();

  await logNotificationAudit({
    actor,
    action: 'DELETE_NOTIFICATION_TEMPLATE',
    requestId: `req_${Date.now()}`,
    before: current as unknown as Record<string, unknown>,
  });

  return { success: true };
}

// ============================================================
// 9. Delivery Logs & Overview Analytics
// ============================================================
export async function listDeliveryLogs(options?: {
  notificationId?: string | undefined;
  appId?: string | undefined;
  limit?: number | undefined;
} | undefined): Promise<NotificationDeliveryLogDoc[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTIONS.NOTIFICATION_DELIVERY_LOGS).get();
  let logs = snapshot.docs.map((d) => d.data() as NotificationDeliveryLogDoc);

  if (options?.notificationId) {
    logs = logs.filter((l) => l.notificationId === options.notificationId);
  }
  if (options?.appId) {
    logs = logs.filter((l) => l.appId === options.appId);
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return logs.slice(0, options?.limit || 100);
}

export async function getNotificationOverview(): Promise<NotificationOverviewMetrics> {
  const db = getFirestoreDb();
  const [notifsSnap, devicesSnap, logsSnap, settings] = await Promise.all([
    db.collection(COLLECTIONS.NOTIFICATIONS).get(),
    db.collection(COLLECTIONS.NOTIFICATION_DEVICES).get(),
    db.collection(COLLECTIONS.NOTIFICATION_DELIVERY_LOGS).get(),
    getNotificationSettings(),
  ]);

  const notifs = notifsSnap.docs.map((d) => d.data() as NotificationDoc);
  const devices = devicesSnap.docs.map((d) => d.data() as NotificationDeviceDoc);
  const logs = logsSnap.docs.map((d) => d.data() as NotificationDeliveryLogDoc);

  let totalSent = 0;
  let totalDelivered = 0;
  let totalOpened = 0;
  let totalFailed = 0;

  const categoryDistribution: Record<NotificationCategory, number> = {
    SYSTEM: 0,
    IMPORTANT: 0,
    SECURITY: 0,
    UPDATE: 0,
    FEATURE: 0,
    PROMOTION: 0,
    MAINTENANCE: 0,
    CUSTOM: 0,
  };

  const appDistribution: Record<string, number> = {};

  notifs.forEach((n) => {
    totalSent += n.stats?.sent || 0;
    totalDelivered += n.stats?.delivered || 0;
    totalOpened += n.stats?.opened || 0;
    totalFailed += n.stats?.failed || 0;

    if (categoryDistribution[n.category] !== undefined) {
      categoryDistribution[n.category]++;
    }

    n.targetAppIds.forEach((app) => {
      appDistribution[app] = (appDistribution[app] || 0) + 1;
    });
  });

  const activeDevicesCount = devices.filter((d) => d.active).length;
  const openRatePct = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100 * 10) / 10 : 0;

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalFailed,
    openRatePct,
    activeDevicesCount,
    unreadCountEstimate: Math.max(0, totalDelivered - totalOpened),
    categoryDistribution,
    appDistribution,
    recentLogs: logs.slice(0, 20),
    killSwitchState: {
      globalNotificationsOff: settings.globalNotificationsOff,
      appKillSwitches: settings.appKillSwitches,
    },
  };
}
