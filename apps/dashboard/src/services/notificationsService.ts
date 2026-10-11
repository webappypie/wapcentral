import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isOfflineMode, isTestEnv } from '../lib/firestore.js';
import { auth } from '../lib/firebase.js';
import { COLLECTIONS, NOTIFICATIONS_CONFIG } from '@wapcentral/config';
import type {
  NotificationDoc,
  NotificationTemplateDoc,
  NotificationCategoryDoc,
  NotificationDeliveryLogDoc,
  NotificationSettingsDoc,
  NotificationOverviewMetrics,
  NotificationCategory,
} from '@wapcentral/types';
import {
  CreateNotificationSchema,
  UpdateNotificationSchema,
  CreateNotificationTemplateSchema,
  UpdateNotificationTemplateSchema,
  UpdateNotificationSettingsSchema,
  type CreateNotificationInput,
  type UpdateNotificationInput,
  type CreateNotificationTemplateInput,
  type UpdateNotificationTemplateInput,
  type UpdateNotificationSettingsInput,
} from '@wapcentral/validation';
import { recordAuditLog } from './auditService.js';

// ============================================================
// In-Memory Fallback Seed State
// ============================================================
const memoryNotifications: NotificationDoc[] = [
  {
    id: 'notif_welcome_filezen',
    title: 'Welcome to FileZen 2.0',
    message: 'Try our all-new AI duplicate file remover and auto-tagger today!',
    category: 'FEATURE',
    type: 'announcement',
    priority: 'normal',
    targetType: 'specific_app',
    targetAppIds: ['filezen'],
    deepLink: 'filezen://features/cleaner',
    status: 'sent',
    stats: { queued: 1250, sent: 1250, delivered: 1210, opened: 480, failed: 40 },
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    sentAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'notif_maint_notice',
    title: 'Scheduled Maintenance Notice',
    message: 'Backend services will undergo routine upgrades on Sunday 02:00 UTC.',
    category: 'MAINTENANCE',
    type: 'maintenance',
    priority: 'high',
    targetType: 'all_apps',
    targetAppIds: ['filezen', 'optilens'],
    status: 'sent',
    isMandatory: true,
    stats: { queued: 2400, sent: 2400, delivered: 2380, opened: 1120, failed: 20 },
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    sentAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

const memoryTemplates: NotificationTemplateDoc[] = [
  {
    id: 'tmpl_app_update',
    name: 'New Version Available',
    title: 'Update to v{{version}} is now available',
    body: 'Discover the latest features and speed improvements in {{appName}}.',
    category: 'UPDATE',
    type: 'update',
    priority: 'normal',
    deepLink: 'https://play.google.com/store/apps/details?id={{packageId}}',
    variables: ['version', 'appName', 'packageId'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl_maintenance',
    name: 'Downtime Alert',
    title: 'Scheduled Maintenance',
    body: 'We will be performing system maintenance on {{date}} at {{time}} UTC.',
    category: 'MAINTENANCE',
    type: 'maintenance',
    priority: 'high',
    variables: ['date', 'time'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const memoryCategories: NotificationCategoryDoc[] = [
  { id: 'SYSTEM', name: 'System Notifications', description: 'Critical platform messages', isMandatory: true, defaultEnabled: true },
  { id: 'SECURITY', name: 'Security Alerts', description: 'Account and device security notices', isMandatory: true, defaultEnabled: true },
  { id: 'MAINTENANCE', name: 'Service Maintenance', description: 'Planned maintenance and downtime', isMandatory: true, defaultEnabled: true },
  { id: 'IMPORTANT', name: 'Important Notices', description: 'Crucial app updates and operational alerts', isMandatory: false, defaultEnabled: true },
  { id: 'UPDATE', name: 'Application Updates', description: 'New releases and version changes', isMandatory: false, defaultEnabled: true },
  { id: 'FEATURE', name: 'Feature Announcements', description: 'Product feature walkthroughs and improvements', isMandatory: false, defaultEnabled: true },
  { id: 'PROMOTION', name: 'Promotions & Offers', description: 'Special offers and app cross-promotions', isMandatory: false, defaultEnabled: true },
  { id: 'CUSTOM', name: 'Custom App Events', description: 'Application-specific notifications and events', isMandatory: false, defaultEnabled: true },
];

let memorySettings: NotificationSettingsDoc = {
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
// Subscriptions & Realtime Queries
// ============================================================
export function subscribeNotifications(
  callback: (items: NotificationDoc[]) => void,
  appId?: string,
): () => void {
  if (isOfflineMode) {
    const filtered = appId
      ? memoryNotifications.filter((n) => n.targetType === 'all_apps' || n.targetAppIds.includes(appId))
      : memoryNotifications;
    callback(filtered);
    return () => {};
  }

  const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as NotificationDoc));
      if (appId) {
        items = items.filter((n) => n.targetType === 'all_apps' || n.targetAppIds.includes(appId));
      }
      callback(items);
    },
    (err) => {
      console.warn('[notificationsService] Falling back to memory for notifications:', err);
      callback(memoryNotifications);
    },
  );
}

export function subscribeTemplates(
  callback: (items: NotificationTemplateDoc[]) => void,
): () => void {
  if (isOfflineMode) {
    callback(memoryTemplates);
    return () => {};
  }

  const q = query(collection(db, COLLECTIONS.NOTIFICATION_TEMPLATES), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationTemplateDoc)));
    },
    () => callback(memoryTemplates),
  );
}

export function subscribeCategories(
  callback: (items: NotificationCategoryDoc[]) => void,
): () => void {
  if (isOfflineMode) {
    callback(memoryCategories);
    return () => {};
  }

  return onSnapshot(
    collection(db, COLLECTIONS.NOTIFICATION_CATEGORIES),
    (snapshot) => {
      if (snapshot.empty) {
        callback(memoryCategories);
      } else {
        callback(snapshot.docs.map((d) => ({ id: d.id as any, ...d.data() } as NotificationCategoryDoc)));
      }
    },
    () => callback(memoryCategories),
  );
}

export function subscribeSettings(
  callback: (settings: NotificationSettingsDoc) => void,
): () => void {
  if (isOfflineMode) {
    callback(memorySettings);
    return () => {};
  }

  return onSnapshot(
    doc(db, COLLECTIONS.NOTIFICATION_SETTINGS, 'global'),
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as NotificationSettingsDoc);
      } else {
        callback(memorySettings);
      }
    },
    () => callback(memorySettings),
  );
}

export function subscribeDeliveryLogs(
  callback: (logs: NotificationDeliveryLogDoc[]) => void,
  limitCount = 50,
): () => void {
  if (isOfflineMode) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, COLLECTIONS.NOTIFICATION_DELIVERY_LOGS), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() } as NotificationDeliveryLogDoc)));
    },
    () => callback([]),
  );
}

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
// Safe Notification & Template Payload Builders
// ============================================================
export function buildNotificationDoc(
  validated: CreateNotificationInput,
  id: string,
  now: string,
  createdBy: string,
): NotificationDoc {
  const targetAppIds = Array.isArray(validated.targetAppIds) && validated.targetAppIds.length > 0
    ? validated.targetAppIds
    : validated.targetAppId
    ? [validated.targetAppId]
    : [];

  const docData: NotificationDoc = {
    id,
    title: validated.title,
    message: validated.message,
    category: validated.category || 'SYSTEM',
    type: validated.type || 'system',
    priority: validated.priority || 'normal',
    targetType: validated.targetType || 'all_apps',
    targetAppIds,
    isMandatory: Boolean(validated.isMandatory || NOTIFICATIONS_CONFIG.MANDATORY_CATEGORIES.includes(validated.category as any)),
    status: validated.schedule && validated.schedule !== 'now' ? 'scheduled' : 'draft',
    ttlSeconds: validated.ttlSeconds || NOTIFICATIONS_CONFIG.DEFAULT_TTL_SECONDS,
    stats: { queued: 0, sent: 0, delivered: 0, opened: 0, failed: 0 },
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  // Optional: targetAppId (app-specific single target reference)
  if (validated.targetAppId && typeof validated.targetAppId === 'string' && validated.targetAppId.trim()) {
    docData.targetAppId = validated.targetAppId.trim();
  } else if (validated.targetType === 'specific_app' && targetAppIds.length > 0) {
    docData.targetAppId = targetAppIds[0];
  }

  // Optional: targetDeviceTokens (omit for app-wide notifications or if empty/undefined)
  if (Array.isArray(validated.targetDeviceTokens) && validated.targetDeviceTokens.length > 0) {
    docData.targetDeviceTokens = validated.targetDeviceTokens;
  }

  // Optional: imageUrl
  if (validated.imageUrl && typeof validated.imageUrl === 'string' && validated.imageUrl.trim().length > 0) {
    docData.imageUrl = validated.imageUrl.trim();
  }

  // Optional: icon
  if (validated.icon && typeof validated.icon === 'string' && validated.icon.trim().length > 0) {
    docData.icon = validated.icon.trim();
  }

  // Optional: deepLink
  if (validated.deepLink && typeof validated.deepLink === 'string' && validated.deepLink.trim().length > 0) {
    docData.deepLink = validated.deepLink.trim();
  }

  // Optional: externalUrl
  if (validated.externalUrl && typeof validated.externalUrl === 'string' && validated.externalUrl.trim().length > 0) {
    docData.externalUrl = validated.externalUrl.trim();
  }

  // Optional: sound
  if (validated.sound && typeof validated.sound === 'string' && validated.sound.trim().length > 0) {
    docData.sound = validated.sound.trim();
  }

  // Optional: badge
  if (typeof validated.badge === 'number') {
    docData.badge = validated.badge;
  }

  // Optional: dataPayload
  if (validated.dataPayload && typeof validated.dataPayload === 'object' && Object.keys(validated.dataPayload).length > 0) {
    docData.dataPayload = stripUndefined(validated.dataPayload);
  }

  // Optional: campaignId
  if (validated.campaignId && typeof validated.campaignId === 'string' && validated.campaignId.trim().length > 0) {
    docData.campaignId = validated.campaignId.trim();
  }

  // Optional: templateId
  if (validated.templateId && typeof validated.templateId === 'string' && validated.templateId.trim().length > 0) {
    docData.templateId = validated.templateId.trim();
  }

  // Optional: metadata
  if (validated.metadata && typeof validated.metadata === 'object' && Object.keys(validated.metadata).length > 0) {
    docData.metadata = stripUndefined(validated.metadata as Record<string, unknown>);
  }

  // Optional: schedule & scheduledAt
  if (validated.schedule && typeof validated.schedule === 'string' && validated.schedule.trim().length > 0) {
    docData.schedule = validated.schedule.trim();
    if (validated.schedule !== 'now') {
      docData.scheduledAt = validated.schedule.trim();
    }
  } else if (validated.scheduledAt && typeof validated.scheduledAt === 'string' && validated.scheduledAt.trim().length > 0) {
    docData.scheduledAt = validated.scheduledAt.trim();
  }

  // Optional: expiry
  if (validated.expiry && typeof validated.expiry === 'string' && validated.expiry.trim().length > 0) {
    docData.expiry = validated.expiry.trim();
  }

  return stripUndefined(docData);
}

export function buildTemplateDoc(
  validated: CreateNotificationTemplateInput,
  id: string,
  now: string,
): NotificationTemplateDoc {
  const docData: NotificationTemplateDoc = {
    id,
    name: validated.name,
    title: validated.title,
    body: validated.body,
    category: validated.category || 'SYSTEM',
    type: validated.type || 'system',
    priority: validated.priority || 'normal',
    variables: validated.variables || [],
    createdAt: now,
    updatedAt: now,
  };

  if (validated.imageUrl && typeof validated.imageUrl === 'string' && validated.imageUrl.trim().length > 0) {
    docData.imageUrl = validated.imageUrl.trim();
  }
  if (validated.icon && typeof validated.icon === 'string' && validated.icon.trim().length > 0) {
    docData.icon = validated.icon.trim();
  }
  if (validated.deepLink && typeof validated.deepLink === 'string' && validated.deepLink.trim().length > 0) {
    docData.deepLink = validated.deepLink.trim();
  }
  if (validated.sound && typeof validated.sound === 'string' && validated.sound.trim().length > 0) {
    docData.sound = validated.sound.trim();
  }
  if (typeof validated.badge === 'number') {
    docData.badge = validated.badge;
  }
  if (validated.dataPayload && typeof validated.dataPayload === 'object' && Object.keys(validated.dataPayload).length > 0) {
    docData.dataPayload = stripUndefined(validated.dataPayload);
  }

  return stripUndefined(docData);
}

// ============================================================
// Mutations & Admin Actions
// ============================================================
export async function createNotification(input: CreateNotificationInput): Promise<NotificationDoc> {
  const validated = CreateNotificationSchema.parse(input);
  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const createdBy = auth.currentUser?.email || 'admin';

  const newDoc = buildNotificationDoc(validated, id, now, createdBy);

  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), newDoc);
  }
  memoryNotifications.unshift(newDoc);

  await recordAuditLog({
    action: 'notifications.create',
    actorUid: auth.currentUser?.uid || 'admin',
    actorEmail: auth.currentUser?.email || 'admin@wapcentral.io',
    resourceType: 'campaign',
    resourceId: id,
    metadata: stripUndefined({
      title: validated.title,
      category: validated.category,
      targetAppId: newDoc.targetAppId || newDoc.targetAppIds[0] || 'all',
    }),
  });

  return newDoc;
}

export async function sendNotification(id: string): Promise<{ success: boolean }> {
  if (isOfflineMode) {
    const found = memoryNotifications.find((n) => n.id === id);
    if (found) {
      found.status = 'sent';
      found.sentAt = new Date().toISOString();
      found.stats = { queued: 50, sent: 50, delivered: 48, opened: 12, failed: 2 };
    }
    return { success: true };
  }

  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady();
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required: please log in to send push notifications.');
  }

  const token = await currentUser.getIdToken();
  const res = await fetch(`/api/admin/v1/notifications/${id}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      `Push notification delivery failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  const data = await res.json().catch(() => ({ success: true }));
  if (data.success === false) {
    throw new Error(data.error?.message || 'Push notification delivery failed');
  }

  await recordAuditLog({
    action: 'notifications.send',
    actorUid: currentUser.uid,
    actorEmail: currentUser.email || 'admin@wapcentral.io',
    resourceType: 'campaign',
    resourceId: id,
    metadata: { sentAt: new Date().toISOString() },
  });

  return { success: true };
}

export async function updateNotification(id: string, input: UpdateNotificationInput): Promise<void> {
  const validated = UpdateNotificationSchema.parse(input);
  const now = new Date().toISOString();
  const cleanUpdate = stripUndefined({ ...validated, updatedAt: now });

  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id), cleanUpdate, { merge: true });
  }

  const idx = memoryNotifications.findIndex((n) => n.id === id);
  if (idx !== -1) {
    memoryNotifications[idx] = { ...memoryNotifications[idx]!, ...cleanUpdate } as NotificationDoc;
  }
}

export async function deleteNotification(id: string): Promise<void> {
  if (!isOfflineMode) {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, id));
  }
  const idx = memoryNotifications.findIndex((n) => n.id === id);
  if (idx !== -1) memoryNotifications.splice(idx, 1);
}

export async function createTemplate(input: CreateNotificationTemplateInput): Promise<NotificationTemplateDoc> {
  const validated = CreateNotificationTemplateSchema.parse(input);
  const id = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newDoc = buildTemplateDoc(validated, id, now);

  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATION_TEMPLATES, id), newDoc);
  }
  memoryTemplates.unshift(newDoc);
  return newDoc;
}

export async function updateTemplate(id: string, input: UpdateNotificationTemplateInput): Promise<void> {
  const validated = UpdateNotificationTemplateSchema.parse(input);
  const cleanUpdate = stripUndefined({ ...validated, updatedAt: new Date().toISOString() });
  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATION_TEMPLATES, id), cleanUpdate, { merge: true });
  }
  const idx = memoryTemplates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    memoryTemplates[idx] = { ...memoryTemplates[idx]!, ...cleanUpdate } as NotificationTemplateDoc;
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!isOfflineMode) {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATION_TEMPLATES, id));
  }
  const idx = memoryTemplates.findIndex((t) => t.id === id);
  if (idx !== -1) memoryTemplates.splice(idx, 1);
}

export async function updateCategory(
  id: NotificationCategory,
  input: Partial<NotificationCategoryDoc>,
): Promise<void> {
  const cleanUpdate = stripUndefined({ ...input, id });
  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATION_CATEGORIES, id), cleanUpdate, { merge: true });
  }
  const idx = memoryCategories.findIndex((c) => c.id === id);
  if (idx !== -1) {
    memoryCategories[idx] = { ...memoryCategories[idx]!, ...cleanUpdate };
  }
}

export async function updateSettings(input: UpdateNotificationSettingsInput): Promise<void> {
  const validated = UpdateNotificationSettingsSchema.parse(input);
  const now = new Date().toISOString();

  memorySettings = stripUndefined({
    ...memorySettings,
    ...(validated.globalNotificationsOff !== undefined ? { globalNotificationsOff: validated.globalNotificationsOff } : {}),
    appKillSwitches: {
      ...memorySettings.appKillSwitches,
      ...(validated.appKillSwitches || {}),
    },
    categoryKillSwitches: {
      ...memorySettings.categoryKillSwitches,
      ...(validated.categoryKillSwitches as any || {}),
    },
    updatedAt: now,
  });

  if (!isOfflineMode) {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATION_SETTINGS, 'global'), memorySettings, { merge: true });
  }

  await recordAuditLog({
    action: 'notifications.kill_switch_update',
    actorUid: auth.currentUser?.uid || 'admin',
    actorEmail: auth.currentUser?.email || 'admin@wapcentral.io',
    resourceType: 'system',
    resourceId: 'global',
    metadata: stripUndefined(validated as Record<string, unknown>),
  });
}
