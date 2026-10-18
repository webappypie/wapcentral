import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isOfflineMode, isTestEnv } from '../lib/firestore.js';
import { auth } from '../lib/firebase.js';
import { COLLECTIONS } from '@wapcentral/config';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from '@wapcentral/validation';
import type { Campaign, CampaignStatus } from '@wapcentral/types';
import { recordAuditLog } from './auditService.js';

let memoryCampaigns: Campaign[] = [
  {
    id: 'camp_01',
    name: 'Pie Calc Pro Promo',
    promotedAppId: 'app_02',
    targetAppIds: ['app_01'],
    title: 'Unlock Scientific Functions',
    description: 'Upgrade to Pie Calc Pro for advanced equations',
    ctaText: 'Get 50% Off',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.calc',
    imageUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
    layoutVariant: 'banner',
    priority: 90,
    enabled: true,
    status: 'published',
    frequencyCap: {
      maxImpressions: 3,
      periodHours: 24,
    },
    scheduleStart: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'camp_02',
    name: 'WAP Notes AI Promo',
    promotedAppId: 'app_03',
    targetAppIds: ['app_01', 'app_02'],
    title: 'Summarize Notes with AI',
    description: 'Audio transcription, flashcards, and instant summaries',
    ctaText: 'Install Free',
    storeUrl: 'https://webappypie.com/notes',
    imageUrl:
      'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&auto=format&fit=crop&q=60',
    layoutVariant: 'interstitial',
    priority: 75,
    enabled: true,
    status: 'published',
    frequencyCap: {
      maxImpressions: 2,
      periodHours: 24,
    },
    scheduleStart: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'camp_03',
    name: 'Reader V2 Early Access',
    promotedAppId: 'app_01',
    targetAppIds: ['app_02'],
    title: 'Experience WAP Reader 2.0',
    description: 'Cloud sync, dark mode, and offline reading library',
    ctaText: 'Join Beta',
    storeUrl: 'https://webappypie.com/reader',
    imageUrl:
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60',
    layoutVariant: 'native',
    priority: 50,
    enabled: false,
    status: 'draft',
    frequencyCap: {
      maxImpressions: 5,
      periodHours: 48,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function subscribeCampaigns(
  onData: (campaigns: Campaign[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData([...memoryCampaigns]);
    return () => {};
  }

  try {
    let firestoreUnsub: (() => void) | null = null;
    let authUnsub: (() => void) | null = null;
    let isCleanedUp = false;

    const startFirestoreSubscription = () => {
      if (firestoreUnsub || isCleanedUp) return;
      const colRef = collection(db, COLLECTIONS.CAMPAIGNS);

      // Do NOT use orderBy('createdAt', 'desc') on the Firestore query because
      // Firestore strictly omits any documents where the orderBy field is undefined.
      // We query the collection and sort client-side.
      firestoreUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          const campaigns: Campaign[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const createdAtStr =
              data['createdAt']?.toDate?.()?.toISOString() ||
              (typeof data['createdAt'] === 'string' ? data['createdAt'] : undefined) ||
              data['updatedAt']?.toDate?.()?.toISOString() ||
              (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : undefined) ||
              new Date().toISOString();

            const updatedAtStr =
              data['updatedAt']?.toDate?.()?.toISOString() ||
              (typeof data['updatedAt'] === 'string' ? data['updatedAt'] : undefined) ||
              createdAtStr;

            const camp: Campaign = {
              id: docSnap.id,
              name: data['name'] || data['title'] || 'Untitled Campaign',
              promotedAppId: data['promotedAppId'] || '',
              targetAppIds: Array.isArray(data['targetAppIds']) ? data['targetAppIds'] : [],
              title: data['title'] || '',
              description: data['description'] || '',
              ctaText: data['ctaText'] || 'Learn More',
              storeUrl: data['storeUrl'] || '',
              ...(data['sponsorLabel'] ? { sponsorLabel: data['sponsorLabel'] } : {}),
              ...(data['imageUrl'] ? { imageUrl: data['imageUrl'] } : {}),
              ...(data['animationUrl'] ? { animationUrl: data['animationUrl'] } : {}),
              layoutVariant: data['layoutVariant'] || 'sponsored',
              ...(data['scheduleStart'] ? { scheduleStart: data['scheduleStart'] } : {}),
              ...(data['scheduleEnd'] ? { scheduleEnd: data['scheduleEnd'] } : {}),
              priority: typeof data['priority'] === 'number' ? data['priority'] : 50,
              enabled: data['enabled'] !== undefined ? Boolean(data['enabled']) : data['status'] === 'published',
              status: (data['status'] as CampaignStatus) || (data['enabled'] ? 'published' : 'draft'),
              ...(data['frequencyCap'] ? { frequencyCap: data['frequencyCap'] } : {}),
              ...(data['targetingRules'] ? { targetingRules: data['targetingRules'] } : {}),
              ...(data['analytics'] ? { analytics: data['analytics'] } : {}),
              createdAt: createdAtStr,
              updatedAt: updatedAtStr,
            };
            return camp;
          });

          // Sort in-memory: higher priority first, then most recently updated/created
          campaigns.sort((a, b) => {
            if (b.priority !== a.priority) {
              return b.priority - a.priority;
            }
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          // Always deliver real Firestore campaigns
          onData(campaigns);
        },
        (err) => {
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
  } catch (err: unknown) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

export async function createCampaign(
  input: CreateCampaignInput,
  actor: { uid: string; email: string },
): Promise<Campaign> {
  const validated = CreateCampaignSchema.parse(input);
  const campaignId = `camp_${Date.now()}`;
  const now = new Date().toISOString();

  const newCampaign: Campaign = {
    id: campaignId,
    name: validated.name,
    promotedAppId: validated.promotedAppId,
    targetAppIds: validated.targetAppIds,
    title: validated.title,
    description: validated.description,
    ctaText: validated.ctaText,
    storeUrl: validated.storeUrl,
    ...(validated.imageUrl ? { imageUrl: validated.imageUrl } : {}),
    ...(validated.animationUrl ? { animationUrl: validated.animationUrl } : {}),
    layoutVariant: validated.layoutVariant,
    ...(validated.scheduleStart ? { scheduleStart: validated.scheduleStart } : {}),
    ...(validated.scheduleEnd ? { scheduleEnd: validated.scheduleEnd } : {}),
    priority: validated.priority,
    enabled: true,
    status: 'draft',
    ...(validated.frequencyCap ? { frequencyCap: validated.frequencyCap } : {}),
    ...(validated.targetingRules
      ? {
          targetingRules: {
            ...(validated.targetingRules.minAppVersion
              ? { minAppVersion: validated.targetingRules.minAppVersion }
              : {}),
            ...(validated.targetingRules.maxAppVersion
              ? { maxAppVersion: validated.targetingRules.maxAppVersion }
              : {}),
            ...(validated.targetingRules.platforms
              ? { platforms: validated.targetingRules.platforms }
              : {}),
            ...(validated.targetingRules.environments
              ? { environments: validated.targetingRules.environments }
              : {}),
          },
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  memoryCampaigns = [newCampaign, ...memoryCampaigns];

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
      await setDoc(docRef, {
        ...newCampaign,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      // Surface the failure: a swallowed error made unsaved changes look saved.
      throw new Error(
        `Could not save campaign to Firestore: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await recordAuditLog({
    action: 'campaign.create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'campaign',
    resourceId: campaignId,
    changes: {
      campaign: { before: null, after: newCampaign },
    },
  });

  return newCampaign;
}

export async function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateCampaignSchema.parse(input);
  const existing = memoryCampaigns.find((c) => c.id === campaignId);

  if (existing) {
    Object.assign(existing, validated, { updatedAt: new Date().toISOString() });
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
      await setDoc(
        docRef,
        {
          ...validated,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err: unknown) {
      // Surface the failure: a swallowed error made unsaved changes look saved.
      throw new Error(
        `Could not save campaign to Firestore: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await recordAuditLog({
    action: 'campaign.update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'campaign',
    resourceId: campaignId,
    changes: {
      campaign: { before: existing ?? null, after: validated },
    },
  });
}

export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  actor: { uid: string; email: string },
): Promise<void> {
  const existing = memoryCampaigns.find((c) => c.id === campaignId);
  const before = existing ? { ...existing } : null;

  if (existing) {
    existing.status = status;
    existing.enabled = status === 'published';
    existing.updatedAt = new Date().toISOString();
  }

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
      await setDoc(
        docRef,
        {
          status,
          enabled: status === 'published',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err: unknown) {
      // Surface the failure: a swallowed error made unsaved changes look saved.
      throw new Error(
        `Could not save campaign to Firestore: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await recordAuditLog({
    action: status === 'published' ? 'campaign.publish' : 'campaign.pause',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'campaign',
    resourceId: campaignId,
    changes: {
      campaign: { before: before?.status ?? null, after: status },
    },
  });
}

export async function deleteCampaign(
  campaignId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const before = memoryCampaigns.find((c) => c.id === campaignId);
  memoryCampaigns = memoryCampaigns.filter((c) => c.id !== campaignId);

  if (!isOfflineMode) {
    try {
      const docRef = doc(db, COLLECTIONS.CAMPAIGNS, campaignId);
      await deleteDoc(docRef);
    } catch (err: unknown) {
      // Surface the failure: a swallowed error made unsaved changes look saved.
      throw new Error(
        `Could not save campaign to Firestore: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await recordAuditLog({
    action: 'campaign.pause',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'campaign',
    resourceId: campaignId,
    changes: {
      campaign: { before: before ?? null, after: null },
    },
  });
}
