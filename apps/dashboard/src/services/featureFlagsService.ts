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
import { UpsertFeatureFlagSchema, type UpsertFeatureFlagInput } from '@wapcentral/validation';
import type { FeatureFlag } from '@wapcentral/types';
import { recordAuditLog } from './auditService.js';

let memoryFlags: FeatureFlag[] = [
  {
    id: 'flag_01',
    key: 'promotion_sdk_enabled',
    description: 'Master switch to enable/disable WAP promo banner delivery across apps',
    value: true,
    type: 'boolean',
    scope: 'global',
    enabled: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedBy: 'admin@webappypie.com',
  },
  {
    id: 'flag_02',
    key: 'ai_copilot_enabled',
    description: 'Toggle AI copilot feature in mobile apps',
    value: true,
    type: 'boolean',
    scope: 'global',
    enabled: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedBy: 'admin@webappypie.com',
  },
  {
    id: 'flag_03',
    key: 'ad_refresh_interval_sec',
    description: 'Frequency in seconds to request new ads in active sessions',
    value: 60,
    type: 'number',
    scope: 'global',
    enabled: true,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updatedBy: 'editor@webappypie.com',
  },
  {
    id: 'flag_04',
    key: 'maintenance_banner_text',
    description: 'Global maintenance notice displayed on startup if non-empty',
    value: '',
    type: 'string',
    scope: 'global',
    enabled: false,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    updatedBy: 'admin@webappypie.com',
  },
];

export function subscribeFeatureFlags(
  onData: (flags: FeatureFlag[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData(memoryFlags);
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTIONS.FEATURE_FLAGS);
    const q = query(colRef, orderBy('key', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty && memoryFlags.length > 0) {
          onData(memoryFlags);
          return;
        }

        const flags: FeatureFlag[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const flag: FeatureFlag = {
            id: docSnap.id,
            key: data.key,
            description: data.description,
            value: data.value,
            type: data.type,
            scope: data.scope,
            ...(data.appId ? { appId: data.appId } : {}),
            ...(data.environment ? { environment: data.environment } : {}),
            enabled: data.enabled ?? true,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedBy: data.updatedBy || 'admin@webappypie.com',
          };
          return flag;
        });

        onData(flags.length > 0 ? flags : memoryFlags);
      },
      (err) => {
        onData(memoryFlags);
        if (onError) onError(err);
      },
    );
  } catch {
    onData(memoryFlags);
    return () => {};
  }
}

export async function upsertFeatureFlag(
  flagId: string | null,
  input: UpsertFeatureFlagInput,
  actor: { uid: string; email: string },
): Promise<FeatureFlag> {
  const validated = UpsertFeatureFlagSchema.parse(input);
  const id = flagId || `flag_${Date.now()}`;
  const now = new Date().toISOString();

  const newFlag: FeatureFlag = {
    id,
    key: validated.key,
    description: validated.description,
    value: validated.value,
    type: validated.type,
    scope: validated.scope,
    ...(validated.appId ? { appId: validated.appId } : {}),
    ...(validated.environment ? { environment: validated.environment } : {}),
    enabled: validated.enabled,
    updatedAt: now,
    updatedBy: actor.email,
  };

  const existingIdx = memoryFlags.findIndex((f) => f.id === id || f.key === validated.key);
  const before = existingIdx >= 0 ? memoryFlags[existingIdx] : null;

  if (existingIdx >= 0) {
    memoryFlags[existingIdx] = newFlag;
  } else {
    memoryFlags.unshift(newFlag);
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.FEATURE_FLAGS, id);
      await setDoc(docRef, {
        ...newFlag,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'featureFlag',
    resourceId: id,
    changes: {
      flag: { before, after: newFlag },
    },
  });

  return newFlag;
}

export async function toggleFeatureFlag(
  flagId: string,
  enabled: boolean,
  actor: { uid: string; email: string },
): Promise<void> {
  const flag = memoryFlags.find((f) => f.id === flagId);
  const before = flag ? { ...flag } : null;

  if (flag) {
    flag.enabled = enabled;
    flag.updatedAt = new Date().toISOString();
    flag.updatedBy = actor.email;
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.FEATURE_FLAGS, flagId);
      await setDoc(
        docRef,
        {
          enabled,
          updatedAt: serverTimestamp(),
          updatedBy: actor.email,
        },
        { merge: true },
      );
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'featureFlag',
    resourceId: flagId,
    changes: {
      flag: { before: before?.enabled ?? null, after: enabled },
    },
  });
}

export async function deleteFeatureFlag(
  flagId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const before = memoryFlags.find((f) => f.id === flagId);
  memoryFlags = memoryFlags.filter((f) => f.id !== flagId);

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.FEATURE_FLAGS, flagId);
      await deleteDoc(docRef);
    } catch {
      // Memory fallback
    }
  }

  await recordAuditLog({
    action: 'flag.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'featureFlag',
    resourceId: flagId,
    changes: {
      flag: { before: before ?? null, after: null },
    },
  });
}
