import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, isOfflineMode } from '../lib/firestore.js';
import { COLLECTIONS } from '@wapcentral/config';
import {
  CreateAppSchema,
  UpdateAppSchema,
  type CreateAppInput,
  type UpdateAppInput,
} from '@wapcentral/validation';
import type { App } from '@wapcentral/types';
import { recordAuditLog } from './auditService.js';

// In-memory fallback dataset for offline/development mode
let memoryApps: App[] = [
  {
    id: 'app_01',
    name: 'WebAppyPie Reader',
    packageId: 'com.webappypie.reader',
    platform: 'android',
    version: '1.2.0',
    environment: 'production',
    enabledModules: ['promotion', 'ads', 'analytics'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'app_02',
    name: 'Pie Calc Pro',
    packageId: 'com.webappypie.calc',
    bundleId: 'com.webappypie.calc',
    platform: 'ios',
    version: '2.0.4',
    environment: 'production',
    enabledModules: ['ads', 'promotion'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'app_03',
    name: 'WAP Notes AI',
    packageId: 'com.webappypie.notes',
    platform: 'android',
    version: '0.9.5',
    environment: 'staging',
    enabledModules: ['ai', 'promotion', 'analytics'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function subscribeApps(
  onData: (apps: App[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData(memoryApps);
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.APPS);
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty && memoryApps.length > 0) {
          onData(memoryApps);
          return;
        }

        const apps: App[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const appItem: App = {
            id: docSnap.id,
            name: data.name,
            packageId: data.packageId,
            ...(data.bundleId ? { bundleId: data.bundleId } : {}),
            platform: data.platform,
            version: data.version || '1.0.0',
            environment: data.environment || 'production',
            ...(data.firebaseProjectId ? { firebaseProjectId: data.firebaseProjectId } : {}),
            ...(data.storeUrl ? { storeUrl: data.storeUrl } : {}),
            ...(data.adConfig ? { adConfig: data.adConfig } : {}),
            enabledModules: data.enabledModules || [],
            status: data.status || 'active',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
          return appItem;
        });

        onData(apps.length > 0 ? apps : memoryApps);
      },
      (err) => {
        onData(memoryApps);
        if (onError) onError(err);
      },
    );
  } catch {
    onData(memoryApps);
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

  const newApp: App = {
    id: appId,
    name: validated.name,
    packageId: validated.packageId,
    ...(validated.bundleId ? { bundleId: validated.bundleId } : {}),
    platform: validated.platform,
    version: validated.version,
    environment: validated.environment,
    ...(validated.firebaseProjectId ? { firebaseProjectId: validated.firebaseProjectId } : {}),
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
          },
        }
      : {}),
    enabledModules: validated.enabledModules || [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  memoryApps = [newApp, ...memoryApps];

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.APPS, appId);
      await setDoc(docRef, {
        ...newApp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Stored in memory fallback
    }
  }

  await recordAuditLog({
    action: 'app.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: null, after: newApp },
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
  const existing = memoryApps.find((a) => a.id === appId);

  if (existing) {
    Object.assign(existing, validated, { updatedAt: new Date().toISOString() });
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.APPS, appId);
      await setDoc(
        docRef,
        {
          ...validated,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'app.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: existing ?? null, after: validated },
    },
  });
}

export async function deleteApp(
  appId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const before = memoryApps.find((a) => a.id === appId);
  memoryApps = memoryApps.filter((a) => a.id !== appId);

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.APPS, appId);
      await deleteDoc(docRef);
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'app.archive',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'app',
    resourceId: appId,
    changes: {
      app: { before: before ?? null, after: null },
    },
  });
}
