import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, isOfflineMode, isTestEnv } from '../lib/firestore.js';
import { auth } from '../lib/firebase.js';
import { COLLECTIONS } from '@wapcentral/config';
import {
  CreateAppSchema,
  UpdateAppSchema,
  type CreateAppInput,
  type UpdateAppInput,
} from '@wapcentral/validation';
import type { App, AppSimpleAdsConfig } from '@wapcentral/types';
import { recordAuditLog } from './auditService.js';

/**
 * Recursively strips keys with `undefined` values from an object or array.
 * Converts explicit `null` values into Firestore `deleteField()` tokens when updating documents,
 * and preserves Firestore FieldValue instances (like serverTimestamp() and deleteField()).
 */
export function sanitizeForFirestore<T>(data: T, handleNullAsDelete = false): T {
  if (data === null) {
    return (handleNullAsDelete ? deleteField() : null) as unknown as T;
  }
  if (data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item, handleNullAsDelete)) as unknown as T;
  }
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (
      (proto && proto.constructor && proto.constructor.name === 'FieldValue') ||
      '_methodName' in (data as any)
    ) {
      return data;
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        result[key] = sanitizeForFirestore(value, handleNullAsDelete);
      }
    }
    return result as T;
  }
  return data;
}

/**
 * Generates a cryptographically secure App Key for client SDK authorization.
 * Prefix: 'wap_key_' followed by 40 hex characters.
 */
export function generateSecureAppKey(prefix = 'wap_key_'): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(20);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}${hex}`;
  }
  const rand = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `${prefix}${rand}`;
}

// In-memory test store (used exclusively in offline unit test environment)
let testApps: App[] = [];

export function resetTestApps(initial: App[] = []): void {
  testApps = [...initial];
}

export function subscribeApps(
  onData: (apps: App[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData([...testApps]);
    return () => {};
  }

  try {
    let firestoreUnsub: (() => void) | null = null;
    let authUnsub: (() => void) | null = null;
    let isCleanedUp = false;

    const startFirestoreSubscription = () => {
      if (firestoreUnsub || isCleanedUp) return;
      const colRef = collection(db, COLLECTIONS.APPS);
      const q = query(colRef, orderBy('createdAt', 'desc'));

      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          const apps: App[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const appItem: App = {
              id: docSnap.id,
              name: data['name'],
              packageId: data['packageId'],
              ...(data['bundleId'] ? { bundleId: data['bundleId'] } : {}),
              platform: data['platform'],
              version: data['version'] || '1.0.0',
              environment: data['environment'] || 'production',
              ...(data['firebaseProjectId'] ? { firebaseProjectId: data['firebaseProjectId'] } : {}),
              ...(data['firebaseAndroidAppId'] ? { firebaseAndroidAppId: data['firebaseAndroidAppId'] } : {}),
              ...(data['firebaseIosAppId'] ? { firebaseIosAppId: data['firebaseIosAppId'] } : {}),
              ...(data['fcmSenderId'] ? { fcmSenderId: data['fcmSenderId'] } : {}),
              ...(data['storeUrl'] ? { storeUrl: data['storeUrl'] } : {}),
              ...(data['adConfig'] ? { adConfig: data['adConfig'] } : {}),
              ...(data['simpleAdsConfig'] ? { simpleAdsConfig: data['simpleAdsConfig'] } : {}),
              ...(data['appKey'] ? { appKey: data['appKey'] } : {}),
              enabledModules: data['enabledModules'] || [],
              status: data['status'] || 'active',
              createdAt:
                data['createdAt']?.toDate?.()?.toISOString() ||
                (typeof data['createdAt'] === 'string' ? data['createdAt'] : new Date().toISOString()),
              updatedAt:
                data['updatedAt']?.toDate?.()?.toISOString() ||
                (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : new Date().toISOString()),
            };
            return appItem;
          });

          // Load strictly from Firestore
          onData(apps);
        },
        (err) => {
          // Surface Firestore error - never fall back to mock data
          if (onError) onError(err);
        },
      );
    };

    if (auth.currentUser || isTestEnv) {
      startFirestoreSubscription();
    } else {
      // Safe auth guard: wait for auth state before initiating query, preventing premature permission-denied
      authUnsub = auth.onAuthStateChanged((user) => {
        if (user && !firestoreUnsub && !isCleanedUp) {
          startFirestoreSubscription();
          if (authUnsub) {
            authUnsub();
            authUnsub = null;
          }
        }
      });
    }

    return () => {
      isCleanedUp = true;
      if (authUnsub) {
        authUnsub();
        authUnsub = null;
      }
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }
    };
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

export async function createApp(
  input: CreateAppInput,
  actor: { uid: string; email: string },
): Promise<App> {
  const validated = CreateAppSchema.parse(input);
  const appId = `app_${Date.now()}`;
  const now = new Date().toISOString();
  const generatedKey = validated.appKey?.trim() || generateSecureAppKey();

  const newApp: App = {
    id: appId,
    name: validated.name,
    packageId: validated.packageId,
    ...(validated.bundleId ? { bundleId: validated.bundleId } : {}),
    platform: validated.platform,
    version: validated.version,
    environment: validated.environment,
    appKey: generatedKey,
    ...(validated.firebaseProjectId ? { firebaseProjectId: validated.firebaseProjectId } : {}),
    ...(validated.firebaseAndroidAppId ? { firebaseAndroidAppId: validated.firebaseAndroidAppId } : {}),
    ...(validated.firebaseIosAppId ? { firebaseIosAppId: validated.firebaseIosAppId } : {}),
    ...(validated.fcmSenderId ? { fcmSenderId: validated.fcmSenderId } : {}),
    ...(validated.storeUrl
      ? {
          storeUrl: {
            ...(validated.storeUrl.android ? { android: validated.storeUrl.android } : {}),
            ...(validated.storeUrl.ios ? { ios: validated.storeUrl.ios } : {}),
          },
        }
      : {}),
    ...(validated.adConfig
      ? {
          adConfig: {
            ...(validated.adConfig.admob ? { admob: validated.adConfig.admob } : {}),
            ...(validated.adConfig.meta ? { meta: validated.adConfig.meta } : {}),
            ...(validated.adConfig.applovin ? { applovin: validated.adConfig.applovin } : {}),
            ...(validated.adConfig.wapads ? { wapads: validated.adConfig.wapads } : {}),
            ...(validated.adConfig.mediationPriority
              ? { mediationPriority: validated.adConfig.mediationPriority }
              : {}),
          },
        }
      : {}),
    enabledModules: validated.enabledModules || [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const sanitized = sanitizeForFirestore(newApp, false);

  if (isOfflineMode) {
    testApps = [newApp, ...testApps];
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    await setDoc(docRef, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Never expose raw App Key in audit logs
  const auditApp = {
    ...newApp,
    ...(newApp.appKey ? { appKey: '••••••••••••••••' } : {}),
  };

  await recordAuditLog({
    action: 'app.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: null, after: auditApp },
    },
  });

  return newApp;
}

export async function updateApp(
  appId: string,
  input: UpdateAppInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAppSchema.parse(input);
  const sanitized = sanitizeForFirestore(validated, true);

  if (isOfflineMode) {
    const existing = testApps.find((a) => a.id === appId);
    if (existing) {
      for (const [key, val] of Object.entries(sanitized as Record<string, any>)) {
        if (val && typeof val === 'object' && '_methodName' in val && val._methodName === 'deleteField') {
          delete (existing as any)[key];
        } else {
          (existing as any)[key] = val;
        }
      }
      existing.updatedAt = new Date().toISOString();
    }
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    await setDoc(
      docRef,
      {
        ...sanitized,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  // Mask sensitive appKey before writing to audit logs
  const auditValidated = {
    ...validated,
    ...(validated.appKey ? { appKey: '••••••••••••••••' } : {}),
  };

  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: null, after: auditValidated },
    },
  });
}

export async function deleteApp(
  appId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testApps = testApps.filter((a) => a.id !== appId);
  } else {
    // Write directly to Firestore - NO silent try/catch!
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'app.archive',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: null, after: null },
    },
  });
}

export function subscribeApp(
  appId: string,
  onData: (app: App | null) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    const found = testApps.find((a) => a.id === appId) || null;
    onData(found);
    return () => {};
  }

  try {
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          onData(null);
          return;
        }
        const data = docSnap.data();
        const appItem: App = {
          id: docSnap.id,
          name: data['name'],
          packageId: data['packageId'],
          ...(data['bundleId'] ? { bundleId: data['bundleId'] } : {}),
          platform: data['platform'],
          version: data['version'] || '1.0.0',
          environment: data['environment'] || 'production',
          ...(data['firebaseProjectId'] ? { firebaseProjectId: data['firebaseProjectId'] } : {}),
          ...(data['firebaseAndroidAppId'] ? { firebaseAndroidAppId: data['firebaseAndroidAppId'] } : {}),
          ...(data['firebaseIosAppId'] ? { firebaseIosAppId: data['firebaseIosAppId'] } : {}),
          ...(data['fcmSenderId'] ? { fcmSenderId: data['fcmSenderId'] } : {}),
          ...(data['storeUrl'] ? { storeUrl: data['storeUrl'] } : {}),
          ...(data['adConfig'] ? { adConfig: data['adConfig'] } : {}),
          ...(data['simpleAdsConfig'] ? { simpleAdsConfig: data['simpleAdsConfig'] } : {}),
          ...(data['appKey'] ? { appKey: data['appKey'] } : {}),
          enabledModules: data['enabledModules'] || [],
          status: data['status'] || 'active',
          createdAt:
            data['createdAt']?.toDate?.()?.toISOString() ||
            (typeof data['createdAt'] === 'string' ? data['createdAt'] : new Date().toISOString()),
          updatedAt:
            data['updatedAt']?.toDate?.()?.toISOString() ||
            (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : new Date().toISOString()),
        };
        onData(appItem);
      },
      (err) => {
        if (onError) onError(err);
      },
    );
    return unsub;
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

export async function regenerateAppKey(
  appId: string,
  actor: { uid: string; email: string },
): Promise<string> {
  const newKey = generateSecureAppKey();
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testApps.find((a) => a.id === appId);
    if (existing) {
      existing.appKey = newKey;
      existing.updatedAt = now;
    }
  } else {
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    await setDoc(
      docRef,
      {
        appKey: newKey,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  // Never expose raw App Key in audit logs
  await recordAuditLog({
    action: 'app.regenerate_key',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      appKey: { before: '••••••••••••••••', after: '••••••••••••••••' },
    },
  });

  return newKey;
}

export async function updateAppAdsConfig(
  appId: string,
  simpleAdsConfig: AppSimpleAdsConfig,
  actor: { uid: string; email: string },
): Promise<void> {
  const sanitized = sanitizeForFirestore(simpleAdsConfig, false);
  const now = new Date().toISOString();
  if (isOfflineMode) {
    const existing = testApps.find((a) => a.id === appId);
    if (existing) {
      existing.simpleAdsConfig = sanitized;
      existing.updatedAt = now;
    }
  } else {
    const docRef = doc(db, COLLECTIONS.APPS, appId);
    await setDoc(
      docRef,
      {
        simpleAdsConfig: sanitized,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await recordAuditLog({
    action: 'ads.app_config_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      simpleAdsConfig: { before: null, after: simpleAdsConfig },
    },
  });
}

/**
 * Downloads the application-specific integration guide Markdown (.md) document from the backend Admin API.
 * Uses the authenticated user's ID token to ensure secure authorized download.
 */
export async function downloadAppIntegrationGuide(appId: string, appName: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Support environment override or default /api/admin/v1 path
  const base = (import.meta as any).env?.VITE_ADMIN_API_BASE_URL || '/api/admin/v1';
  const url = `${base.replace(/\/+$/, '')}/apps/${encodeURIComponent(appId)}/integration-guide`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errMsg = `Failed to download integration guide (${response.status} ${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // response body was not JSON
    }
    throw new Error(errMsg);
  }

  const blob = await response.blob();
  const baseName = appName.split(/[\u2014\u2013-]/)[0]?.trim().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'App';
  let filename = `WAPCentral_${baseName}_Integration_Guide.md`;
  const disposition = response.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  // Trigger browser download via object URL
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}
