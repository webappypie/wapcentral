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
    adConfig: {
      admob: {
        appId: 'ca-app-pub-3940256099942544~3347511713',
        enabled: true,
        adUnits: [
          {
            id: 'unit_banner_01',
            name: 'Reader Main Banner',
            type: 'banner',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/6300978111',
          },
          {
            id: 'unit_interstitial_01',
            name: 'Chapter End Interstitial',
            type: 'interstitial',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/1033173712',
          },
          {
            id: 'unit_rewarded_01',
            name: 'Unlock Premium Feature',
            type: 'rewarded',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/5224354917',
          },
          {
            id: 'unit_native_01',
            name: 'In-Feed Native Ad',
            type: 'native',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/2247696110',
          },
        ],
      },
      meta: {
        appId: '102938475610293',
        enabled: true,
        placements: [
          {
            id: 'meta_banner_01',
            name: 'Meta Footer Banner',
            type: 'banner',
            placementId: '102938475610293_102938475610294',
          },
        ],
      },
      applovin: {
        sdkKey: 'applovin_sdk_key_live_abcdef1234567890',
        enabled: true,
        adUnits: [
          {
            id: 'max_banner_01',
            name: 'MAX Mediated Banner',
            type: 'banner',
            platform: 'android',
            adUnitId: 'max_unit_banner_9988',
          },
        ],
      },
      wapads: {
        appKey: 'wap_key_reader_prod',
        enabled: true,
      },
      mediationPriority: ['admob', 'meta', 'applovin', 'wapads'],
    },
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
    adConfig: {
      admob: {
        appId: 'ca-app-pub-3940256099942544~1458782514',
        enabled: true,
        adUnits: [
          {
            id: 'calc_banner_ios',
            name: 'Calc Bottom Banner',
            type: 'banner',
            platform: 'ios',
            adUnitId: 'ca-app-pub-3940256099942544/2934735716',
          },
        ],
      },
      meta: {
        appId: '987654321098765',
        enabled: false,
        placements: [],
      },
      applovin: {
        sdkKey: 'applovin_sdk_key_calc_ios_123',
        enabled: true,
        adUnits: [],
      },
      wapads: {
        appKey: 'wap_key_calc_prod',
        enabled: true,
      },
      mediationPriority: ['admob', 'applovin', 'wapads'],
    },
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
