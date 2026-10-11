import crypto from 'crypto';
import { COLLECTIONS, ADS_CONFIG } from '@wapcentral/config';
import type {
  AdNetwork,
  AdAppConfig,
  FormatToggleConfig,
  AdUnitDoc,
  AdPlacementDoc,
  AdRotationPolicy,
  AdFrequencyPolicy,
  AdFormatFrequency,
  AdSafetyPolicy,
  AdKillSwitches,
  CustomAdCampaign,
  CustomAdCreative,
  EffectiveAdConfigResponse,
  EffectiveAdFormatConfig,
  AdsOverviewMetrics,
  AdFormat,
  AuditLog,
} from '@wapcentral/types';
import type {
  CreateAdNetworkInput,
  UpdateAdNetworkInput,
  AdAppConfigInput,
  UpdateAdAppConfigInput,
  CreateAdUnitDocInput,
  UpdateAdUnitDocInput,
  CreateAdPlacementDocInput,
  UpdateAdPlacementDocInput,
  AdRotationPolicyInput,
  UpdateAdRotationPolicyInput,
  AdFrequencyPolicyInput,
  UpdateAdFrequencyPolicyInput,
  AdSafetyPolicyInput,
  UpdateAdSafetyPolicyInput,
  UpdateAdKillSwitchesInput,
  CreateCustomAdCampaignInput,
  UpdateCustomAdCampaignInput,
  PlatformAdTrackRequestInput,
} from '@wapcentral/validation';
import { getFirestoreDb } from './firestore.js';
import { logAdminAction } from './auditService.js';
import { AnalyticsQueryService } from './analytics/analyticsQueryService.js';

// ============================================================
// Default Fallback Seeds (Production-grade Defaults)
// ============================================================

const defaultNetworks: AdNetwork[] = [
  {
    id: 'admob',
    name: 'Google AdMob',
    enabled: true,
    environmentMode: 'production',
    secretReferenceName: 'ADMOB_REPORTING_CREDENTIALS',
    configured: true,
    supportedFormats: [
      'banner',
      'native',
      'interstitial',
      'rewarded',
      'app_open',
      'rewarded_interstitial',
    ],
    priority: 1,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Primary global advertising mediation network for Android and iOS',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meta',
    name: 'Meta Audience Network',
    enabled: true,
    environmentMode: 'production',
    secretReferenceName: 'META_AAN_CREDENTIALS',
    configured: true,
    supportedFormats: ['banner', 'native', 'interstitial', 'rewarded'],
    priority: 2,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Secondary bidding network for high-CPM programmatic fills',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'applovin',
    name: 'AppLovin MAX',
    enabled: true,
    environmentMode: 'production',
    secretReferenceName: 'APPLOVIN_API_KEY',
    configured: true,
    supportedFormats: ['banner', 'native', 'interstitial', 'rewarded', 'rewarded_interstitial', 'app_open'],
    priority: 1,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Primary mediation platform and direct AppLovin demand',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inmobi',
    name: 'InMobi',
    enabled: true,
    environmentMode: 'production',
    secretReferenceName: 'INMOBI_API_KEY',
    configured: true,
    supportedFormats: ['banner', 'native', 'interstitial', 'rewarded'],
    priority: 4,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'InMobi demand source via AppLovin MAX mediation adapter',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'unity',
    name: 'Unity Ads',
    enabled: true,
    environmentMode: 'production',
    secretReferenceName: 'UNITY_ADS_API_KEY',
    configured: true,
    supportedFormats: ['banner', 'interstitial', 'rewarded'],
    priority: 5,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Unity Ads demand source via AppLovin MAX mediation adapter',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'custom_ads',
    name: 'WebAppyPie Custom Ads',
    enabled: true,
    environmentMode: 'production',
    configured: true,
    supportedFormats: ['banner', 'native', 'interstitial', 'app_open'],
    priority: 6,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Internal first-party inventory and cross-promotion engine',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultKillSwitches: AdKillSwitches = {
  id: 'current',
  globalAdsDisabled: false,
  networks: {
    admob: false,
    meta: false,
    applovin: false,
    inmobi: false,
    unity: false,
    custom_ads: false,
  },
  apps: {},
  formats: {
    banner: false,
    native: false,
    interstitial: false,
    rewarded: false,
    app_open: false,
    rewarded_interstitial: false,
  },
  placements: {},
  customAdsDisabled: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system_bootstrap',
};

const defaultAppConfigs: Record<string, AdAppConfig> = {
  filezen: {
    id: 'filezen',
    appId: 'filezen',
    appName: 'FileZen — AI File & Document Manager',
    masterEnabled: true,
    formats: {
      banner: { enabled: true, refreshIntervalSeconds: 60 },
      native: { enabled: true },
      interstitial: { enabled: true, cooldownSeconds: 60, sessionCap: 3, dailyCap: 10 },
      rewarded: { enabled: true, dailyCap: 15 },
      app_open: { enabled: true },
      rewarded_interstitial: { enabled: false },
    },
    networkSettings: {
      admob: { enabled: true },
      meta: { enabled: false },
      applovin: { enabled: false },
      custom_ads: { enabled: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  optilens: {
    id: 'optilens',
    appId: 'optilens',
    appName: 'OptiLens AI — Smart Camera',
    masterEnabled: true,
    formats: {
      banner: { enabled: true, refreshIntervalSeconds: 60 },
      native: { enabled: true },
      interstitial: { enabled: true, cooldownSeconds: 60, sessionCap: 3, dailyCap: 10 },
      rewarded: { enabled: true, dailyCap: 15 },
      app_open: { enabled: true },
      rewarded_interstitial: { enabled: false },
    },
    networkSettings: {
      admob: { enabled: true },
      meta: { enabled: false },
      applovin: { enabled: false },
      custom_ads: { enabled: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const defaultUnits: AdUnitDoc[] = [];

const defaultPlacements: AdPlacementDoc[] = [];

const defaultCustomCampaigns: CustomAdCampaign[] = [
  {
    id: 'camp_cross_optilens',
    title: 'OptiLens AI Camera',
    description: 'Transform your photos with intelligent neural enhancement tools.',
    ctaText: 'Install Free',
    destinationUrl: 'https://webappypie.com/apps/optilens',
    targetApps: ['filezen', '*'],
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    priority: 50,
    enabled: true,
    status: 'active',
    impressionsCount: 0,
    clicksCount: 0,
    creatives: [
      {
        id: 'cr_optilens_banner',
        campaignId: 'camp_cross_optilens',
        format: 'banner',
        headline: 'Enhance Photos Instantly with OptiLens',
        bodyText: 'Restore blur, remove glare and upscale in 1-tap.',
        callToAction: 'Get App',
        imageUrl: 'https://webappypie.com/assets/promo/optilens_banner.png',
        destinationUrl: 'https://webappypie.com/apps/optilens',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultGlobalSafetyPolicy: AdSafetyPolicy = {
  id: 'global',
  appId: 'global',
  blockedCategories: [...ADS_CONFIG.DEFAULT_BLOCKED_CATEGORIES],
  maxAdRating: 'PG',
  blockSensitiveCategories: true,
  childDirectedApp: false,
  customBlockedKeywords: ['crypto', 'loan shark', 'fast rich'],
  disclaimer:
    'WAPCentral centrally restricts ad content categories and rating thresholds. Third-party ad-serving networks (AdMob, Meta, AppLovin) operate through real-time SDK mediation auctions; emergency kill switches are available.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultGlobalFrequencyPolicy: AdFrequencyPolicy = {
  id: 'global',
  appId: 'global',
  formats: {
    banner: {
      minIntervalSeconds: 30,
      cooldownSeconds: 0,
      sessionCap: 100,
      dailyCap: 500,
    },
    native: {
      minIntervalSeconds: 15,
      cooldownSeconds: 0,
      sessionCap: 50,
      dailyCap: 200,
    },
    interstitial: {
      minIntervalSeconds: 45,
      cooldownSeconds: 45,
      sessionCap: 4,
      dailyCap: 12,
    },
    rewarded: {
      minIntervalSeconds: 10,
      cooldownSeconds: 10,
      sessionCap: 10,
      dailyCap: 25,
    },
    app_open: {
      minIntervalSeconds: 60,
      cooldownSeconds: 60,
      sessionCap: 3,
      dailyCap: 8,
      appForegroundRule: 'min_background_30s',
    },
    rewarded_interstitial: {
      minIntervalSeconds: 30,
      cooldownSeconds: 30,
      sessionCap: 3,
      dailyCap: 8,
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================
// Internal State Initialization & Helpers
// ============================================================

let isSeeded = false;

export async function ensureAdsDataSeeded(): Promise<void> {
  if (isSeeded) return;
  const db = getFirestoreDb();

  try {
    // 1. Seed Networks
    const networksSnap = await db.collection(COLLECTIONS.AD_NETWORKS).get();
    if (networksSnap.empty) {
      for (const net of defaultNetworks) {
        await db.collection(COLLECTIONS.AD_NETWORKS).doc(net.id).set(net);
      }
    }

    // 2. Seed Kill Switches
    const killDoc = await db.collection(COLLECTIONS.AD_KILL_SWITCHES).doc('current').get();
    if (!killDoc.exists) {
      await db.collection(COLLECTIONS.AD_KILL_SWITCHES).doc('current').set(defaultKillSwitches);
    }

    // 3. Seed App Configs
    const appsSnap = await db.collection(COLLECTIONS.AD_APPS).get();
    if (appsSnap.empty) {
      for (const [appId, appCfg] of Object.entries(defaultAppConfigs)) {
        await db.collection(COLLECTIONS.AD_APPS).doc(appId).set(appCfg);
      }
    }

    // 4. Seed Ad Units
    const unitsSnap = await db.collection(COLLECTIONS.AD_UNITS).get();
    if (unitsSnap.empty) {
      for (const unit of defaultUnits) {
        await db.collection(COLLECTIONS.AD_UNITS).doc(unit.id).set(unit);
      }
    }

    // 5. Seed Placements
    const placementsSnap = await db.collection(COLLECTIONS.AD_PLACEMENTS).get();
    if (placementsSnap.empty) {
      for (const pl of defaultPlacements) {
        await db.collection(COLLECTIONS.AD_PLACEMENTS).doc(pl.id).set(pl);
      }
    }

    // 6. Seed Safety Policies
    const safetyDoc = await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).doc('global').get();
    if (!safetyDoc.exists) {
      await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).doc('global').set(defaultGlobalSafetyPolicy);
    }

    // 7. Seed Frequency Policies
    const freqDoc = await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).doc('global').get();
    if (!freqDoc.exists) {
      await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).doc('global').set(defaultGlobalFrequencyPolicy);
    }

    // 8. Seed Custom Campaigns
    const campSnap = await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).get();
    if (campSnap.empty) {
      for (const c of defaultCustomCampaigns) {
        await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(c.id).set(c);
      }
    }

    isSeeded = true;
  } catch {
    // Graceful fallback for test environments without full firestore initialization
    isSeeded = true;
  }
}

export function resetAdsServiceForTest(): void {
  isSeeded = false;
}

// ============================================================
// 1. Ad Networks Management
// ============================================================

export async function getAdNetworks(): Promise<AdNetwork[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_NETWORKS).get();
  const networks: AdNetwork[] = snap.docs.map((d) => d.data() as AdNetwork);
  return networks.sort((a, b) => a.priority - b.priority);
}

export async function getAdNetwork(id: string): Promise<AdNetwork | null> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_NETWORKS).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as AdNetwork;
}

export async function createAdNetwork(
  input: CreateAdNetworkInput,
  actor: { uid: string; email: string },
): Promise<AdNetwork> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const now = new Date().toISOString();

  // Strip any accidental secret keys from client payload
  const sanitized: Partial<CreateAdNetworkInput> = { ...input };
  delete (sanitized as any).apiKey;
  delete (sanitized as any).secret;
  delete (sanitized as any).secretKey;

  const network: AdNetwork = {
    ...sanitized,
    id: input.id,
    name: input.name,
    enabled: input.enabled,
    environmentMode: input.environmentMode,
    configured: input.configured ?? false,
    supportedFormats: input.supportedFormats,
    priority: input.priority,
    healthStatus: input.healthStatus
      ? {
          status: input.healthStatus.status,
          lastCheckedAt: input.healthStatus.lastCheckedAt || now,
          latencyMs: input.healthStatus.latencyMs,
          error: input.healthStatus.error,
        }
      : { status: 'unknown', lastCheckedAt: now },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_NETWORKS).doc(network.id).set(network);

  await logAdminAction({
    action: 'ads.network_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: network.id,
    changes: { network: { before: null, after: network } },
    metadata: { module: 'ads' },
  });

  return network;
}

export async function updateAdNetwork(
  id: string,
  input: UpdateAdNetworkInput,
  actor: { uid: string; email: string },
): Promise<AdNetwork> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdNetwork(id);
  if (!existing) {
    throw new Error(`AdNetwork '${id}' not found`);
  }

  const now = new Date().toISOString();
  const sanitized: Partial<UpdateAdNetworkInput> = { ...input };
  delete (sanitized as any).apiKey;
  delete (sanitized as any).secret;

  const updated: AdNetwork = {
    ...existing,
    name: input.name ?? existing.name,
    enabled: input.enabled ?? existing.enabled,
    environmentMode: input.environmentMode ?? existing.environmentMode,
    configured: input.configured ?? existing.configured,
    supportedFormats: input.supportedFormats ?? existing.supportedFormats,
    priority: input.priority ?? existing.priority,
    healthStatus: input.healthStatus
      ? {
          status: input.healthStatus.status,
          lastCheckedAt: input.healthStatus.lastCheckedAt || now,
          latencyMs: input.healthStatus.latencyMs,
          error: input.healthStatus.error,
        }
      : existing.healthStatus,
    secretReferenceName: input.secretReferenceName ?? existing.secretReferenceName,
    notes: input.notes ?? existing.notes,
    allowedAppIds: input.allowedAppIds ?? existing.allowedAppIds,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_NETWORKS).doc(id).set(updated, { merge: true });

  await logAdminAction({
    action: 'ads.network_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: id,
    changes: { network: { before: existing, after: updated } },
    metadata: { module: 'ads' },
  });

  return updated;
}

export async function deleteAdNetwork(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdNetwork(id);
  if (!existing) {
    throw new Error(`AdNetwork '${id}' not found`);
  }

  await db.collection(COLLECTIONS.AD_NETWORKS).doc(id).delete();

  await logAdminAction({
    action: 'ads.network_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: id,
    changes: { network: { before: existing, after: null } },
    metadata: { module: 'ads' },
  });
}

// ============================================================
// 2. App-Wise Ad Configuration
// ============================================================

export async function getAdAppConfigs(): Promise<AdAppConfig[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_APPS).get();
  return snap.docs.map((d) => d.data() as AdAppConfig);
}

export async function getAdAppConfig(appId: string): Promise<AdAppConfig | null> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_APPS).doc(appId).get();
  if (!doc.exists) return null;
  return doc.data() as AdAppConfig;
}

export async function upsertAdAppConfig(
  appId: string,
  input: AdAppConfigInput | UpdateAdAppConfigInput,
  actor: { uid: string; email: string },
): Promise<AdAppConfig> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdAppConfig(appId);
  const now = new Date().toISOString();

  const defaultFormats: Record<AdFormat, FormatToggleConfig> = {
    banner: { enabled: true, refreshIntervalSeconds: 60 },
    native: { enabled: true },
    interstitial: { enabled: true, cooldownSeconds: 60, sessionCap: 3, dailyCap: 10 },
    rewarded: { enabled: true, dailyCap: 15 },
    app_open: { enabled: true },
    rewarded_interstitial: { enabled: false },
  };

  const mergedFormats: Record<AdFormat, FormatToggleConfig> = {
    ...defaultFormats,
    ...(existing?.formats || {}),
    ...((input.formats as Record<AdFormat, FormatToggleConfig>) || {}),
  };

  const configToSave: AdAppConfig = {
    id: appId,
    appId,
    appName: input.appName || existing?.appName || appId,
    masterEnabled: input.masterEnabled ?? existing?.masterEnabled ?? true,
    formats: mergedFormats,
    networkSettings: input.networkSettings || existing?.networkSettings || {},
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_APPS).doc(appId).set(configToSave, { merge: true });

  await logAdminAction({
    action: 'ads.app_config_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adAppConfig',
    resourceId: appId,
    changes: { adAppConfig: { before: existing, after: configToSave } },
    metadata: { module: 'ads', appId },
  });

  return configToSave;
}

// ============================================================
// 3. Ad Units Management
// ============================================================

export async function getAdUnits(appId?: string): Promise<AdUnitDoc[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_UNITS).get();
  const units = snap.docs.map((d) => d.data() as AdUnitDoc);
  if (appId) {
    return units.filter((u) => u.appId === appId);
  }
  return units;
}

export async function getAdUnit(id: string): Promise<AdUnitDoc | null> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_UNITS).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as AdUnitDoc;
}

export async function createAdUnit(
  input: CreateAdUnitDocInput,
  actor: { uid: string; email: string },
): Promise<AdUnitDoc> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const now = new Date().toISOString();
  const id = input.id || `unit_${input.appId}_${input.networkId}_${input.format}_${Date.now()}`;
  const unit: AdUnitDoc = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_UNITS).doc(unit.id).set(unit);

  await logAdminAction({
    action: 'ads.unit_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: unit.id,
    changes: { adUnit: { before: null, after: unit } },
    metadata: { module: 'ads', appId: unit.appId },
  });

  return unit;
}

export async function updateAdUnit(
  id: string,
  input: UpdateAdUnitDocInput,
  actor: { uid: string; email: string },
): Promise<AdUnitDoc> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdUnit(id);
  if (!existing) throw new Error(`AdUnit '${id}' not found`);

  const updated: AdUnitDoc = {
    id: existing.id,
    appId: existing.appId,
    networkId: input.networkId ?? existing.networkId,
    format: input.format ?? existing.format,
    platform: input.platform ?? existing.platform,
    name: input.name ?? existing.name,
    adUnitId: input.adUnitId ?? existing.adUnitId,
    enabled: input.enabled ?? existing.enabled,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.AD_UNITS).doc(id).set(updated, { merge: true });

  await logAdminAction({
    action: 'ads.unit_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: id,
    changes: { adUnit: { before: existing, after: updated } },
    metadata: { module: 'ads', appId: updated.appId },
  });

  return updated;
}

export async function deleteAdUnit(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdUnit(id);
  if (!existing) throw new Error(`AdUnit '${id}' not found`);

  await db.collection(COLLECTIONS.AD_UNITS).doc(id).delete();

  await logAdminAction({
    action: 'ads.unit_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: id,
    changes: { adUnit: { before: existing, after: null } },
    metadata: { module: 'ads', appId: existing.appId },
  });
}

// ============================================================
// 4. Ad Placements Management
// ============================================================

export async function getAdPlacements(appId?: string): Promise<AdPlacementDoc[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_PLACEMENTS).get();
  const placements = snap.docs.map((d) => d.data() as AdPlacementDoc);
  if (appId) {
    return placements.filter((p) => p.appId === appId);
  }
  return placements;
}

export async function getAdPlacement(id: string): Promise<AdPlacementDoc | null> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_PLACEMENTS).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as AdPlacementDoc;
}

export async function createAdPlacement(
  input: CreateAdPlacementDocInput,
  actor: { uid: string; email: string },
): Promise<AdPlacementDoc> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const now = new Date().toISOString();
  const id = input.id || `place_${input.appId}_${input.placementKey}`;
  const pl: AdPlacementDoc = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_PLACEMENTS).doc(pl.id).set(pl);

  await logAdminAction({
    action: 'ads.placement_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: pl.id,
    changes: { adPlacement: { before: null, after: pl } },
    metadata: { module: 'ads', appId: pl.appId },
  });

  return pl;
}

export async function updateAdPlacement(
  id: string,
  input: UpdateAdPlacementDocInput,
  actor: { uid: string; email: string },
): Promise<AdPlacementDoc> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdPlacement(id);
  if (!existing) throw new Error(`AdPlacement '${id}' not found`);

  const updated: AdPlacementDoc = {
    id: existing.id,
    appId: existing.appId,
    placementKey: input.placementKey ?? existing.placementKey,
    name: input.name ?? existing.name,
    format: input.format ?? existing.format,
    enabled: input.enabled ?? existing.enabled,
    cooldownSeconds: input.cooldownSeconds ?? existing.cooldownSeconds,
    sessionCap: input.sessionCap ?? existing.sessionCap,
    dailyCap: input.dailyCap ?? existing.dailyCap,
    foregroundRule: input.foregroundRule ?? existing.foregroundRule,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.AD_PLACEMENTS).doc(id).set(updated, { merge: true });

  await logAdminAction({
    action: 'ads.placement_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: id,
    changes: { adPlacement: { before: existing, after: updated } },
    metadata: { module: 'ads', appId: updated.appId },
  });

  return updated;
}

export async function deleteAdPlacement(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdPlacement(id);
  if (!existing) throw new Error(`AdPlacement '${id}' not found`);

  await db.collection(COLLECTIONS.AD_PLACEMENTS).doc(id).delete();

  await logAdminAction({
    action: 'ads.placement_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: id,
    changes: { adPlacement: { before: existing, after: null } },
    metadata: { module: 'ads', appId: existing.appId },
  });
}

// ============================================================
// 5. Ad Rotation & Mediation Policies
// ============================================================

export async function getAdRotationPolicies(): Promise<AdRotationPolicy[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_ROTATION_POLICIES).get();
  return snap.docs.map((d) => d.data() as AdRotationPolicy);
}

export async function getAdRotationPolicy(
  appId: string,
  format: AdFormat,
): Promise<AdRotationPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const policyId = `${appId}_${format}`;
  const doc = await db.collection(COLLECTIONS.AD_ROTATION_POLICIES).doc(policyId).get();
  if (doc.exists) {
    return doc.data() as AdRotationPolicy;
  }

  // Fallback to default tiers if not found
  const networks = await getAdNetworks();
  return {
    id: policyId,
    appId,
    format,
    tiers: networks.map((net, idx) => ({
      networkId: net.id,
      priority: idx + 1,
      enabled: net.enabled,
      timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
    })),
    fallbackToCustomAds: true,
    bannerRefreshIntervalSeconds: ADS_CONFIG.DEFAULT_BANNER_REFRESH_INTERVAL_SECONDS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertAdRotationPolicy(
  input: AdRotationPolicyInput,
  actor: { uid: string; email: string },
): Promise<AdRotationPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const now = new Date().toISOString();
  const id = input.id || `${input.appId}_${input.format}`;

  // Safe refresh interval policy enforcement: min 30 seconds
  const refreshInterval = Math.max(
    ADS_CONFIG.MIN_BANNER_REFRESH_INTERVAL_SECONDS,
    input.bannerRefreshIntervalSeconds || ADS_CONFIG.DEFAULT_BANNER_REFRESH_INTERVAL_SECONDS,
  );

  const existingDoc = await db.collection(COLLECTIONS.AD_ROTATION_POLICIES).doc(id).get();
  const existing = existingDoc.exists ? (existingDoc.data() as AdRotationPolicy) : null;

  const policy: AdRotationPolicy = {
    id,
    appId: input.appId,
    format: input.format,
    tiers: input.tiers || existing?.tiers || [],
    fallbackToCustomAds: input.fallbackToCustomAds ?? existing?.fallbackToCustomAds ?? true,
    bannerRefreshIntervalSeconds: refreshInterval,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_ROTATION_POLICIES).doc(id).set(policy, { merge: true });

  await logAdminAction({
    action: 'ads.rotation_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adRotationPolicy',
    resourceId: id,
    changes: { rotationPolicy: { before: existing, after: policy } },
    metadata: { module: 'ads', appId: policy.appId, format: policy.format },
  });

  return policy;
}

// ============================================================
// 6. Frequency Policies
// ============================================================

export async function getAdFrequencyPolicies(): Promise<AdFrequencyPolicy[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).get();
  return snap.docs.map((d) => d.data() as AdFrequencyPolicy);
}

export async function getAdFrequencyPolicy(appId: string): Promise<AdFrequencyPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).doc(appId).get();
  if (doc.exists) {
    return doc.data() as AdFrequencyPolicy;
  }
  // Fall back to global policy
  const globalDoc = await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).doc('global').get();
  if (globalDoc.exists) {
    return { ...(globalDoc.data() as AdFrequencyPolicy), id: appId, appId };
  }
  return { ...defaultGlobalFrequencyPolicy, id: appId, appId };
}

export async function upsertAdFrequencyPolicy(
  appId: string,
  input: AdFrequencyPolicyInput | UpdateAdFrequencyPolicyInput,
  actor: { uid: string; email: string },
): Promise<AdFrequencyPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdFrequencyPolicy(appId);
  const now = new Date().toISOString();

  const formats: Record<AdFormat, AdFormatFrequency> = {
    ...defaultGlobalFrequencyPolicy.formats,
    ...existing.formats,
    ...((input.formats as Record<AdFormat, AdFormatFrequency>) || {}),
  };

  const policy: AdFrequencyPolicy = {
    id: appId,
    appId,
    formats,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_FREQUENCY_POLICIES).doc(appId).set(policy, { merge: true });

  await logAdminAction({
    action: 'ads.frequency_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adFrequencyPolicy',
    resourceId: appId,
    changes: { frequencyPolicy: { before: existing, after: policy } },
    metadata: { module: 'ads', appId },
  });

  return policy;
}

// ============================================================
// 7. Safety Policies
// ============================================================

export async function getAdSafetyPolicies(): Promise<AdSafetyPolicy[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).get();
  return snap.docs.map((d) => d.data() as AdSafetyPolicy);
}

export async function getAdSafetyPolicy(appId: string): Promise<AdSafetyPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).doc(appId).get();
  if (doc.exists) {
    return doc.data() as AdSafetyPolicy;
  }
  const globalDoc = await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).doc('global').get();
  if (globalDoc.exists) {
    return { ...(globalDoc.data() as AdSafetyPolicy), id: appId, appId };
  }
  return { ...defaultGlobalSafetyPolicy, id: appId, appId };
}

export async function upsertAdSafetyPolicy(
  appId: string,
  input: AdSafetyPolicyInput | UpdateAdSafetyPolicyInput,
  actor: { uid: string; email: string },
): Promise<AdSafetyPolicy> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdSafetyPolicy(appId);
  const now = new Date().toISOString();

  const policy: AdSafetyPolicy = {
    id: appId,
    appId,
    blockedCategories: input.blockedCategories || existing.blockedCategories,
    maxAdRating: input.maxAdRating || existing.maxAdRating,
    blockSensitiveCategories: input.blockSensitiveCategories ?? existing.blockSensitiveCategories,
    childDirectedApp: input.childDirectedApp ?? existing.childDirectedApp,
    customBlockedKeywords: input.customBlockedKeywords || existing.customBlockedKeywords,
    disclaimer: input.disclaimer || existing.disclaimer,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.AD_SAFETY_POLICIES).doc(appId).set(policy, { merge: true });

  await logAdminAction({
    action: 'ads.safety_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adSafetyPolicy',
    resourceId: appId,
    changes: { safetyPolicy: { before: existing, after: policy } },
    metadata: { module: 'ads', appId },
  });

  return policy;
}

// ============================================================
// 8. Custom Ad Campaigns
// ============================================================

export async function getCustomAdCampaigns(): Promise<CustomAdCampaign[]> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).get();
  return snap.docs.map((d) => d.data() as CustomAdCampaign);
}

export async function getCustomAdCampaign(id: string): Promise<CustomAdCampaign | null> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as CustomAdCampaign;
}

export async function createCustomAdCampaign(
  input: CreateCustomAdCampaignInput,
  actor: { uid: string; email: string },
): Promise<CustomAdCampaign> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const now = new Date().toISOString();
  const id = input.id || `camp_${Date.now()}`;
  const endDate = input.endDate || new Date(Date.now() + 365 * 86400000).toISOString();

  const creatives = (input.creatives || []).map((c) => ({
    ...c,
    createdAt: c.createdAt || now,
    updatedAt: c.updatedAt || now,
  }));

  const campaign: CustomAdCampaign = {
    ...input,
    id,
    endDate,
    enabled: input.enabled ?? true,
    impressionsCount: input.impressionsCount ?? 0,
    clicksCount: input.clicksCount ?? 0,
    creatives,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(campaign.id).set(campaign);

  await logAdminAction({
    action: 'ads.custom_campaign_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: campaign.id,
    changes: { campaign: { before: null, after: campaign } },
    metadata: { module: 'ads' },
  });

  return campaign;
}

export async function updateCustomAdCampaign(
  id: string,
  input: UpdateCustomAdCampaignInput,
  actor: { uid: string; email: string },
): Promise<CustomAdCampaign> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getCustomAdCampaign(id);
  if (!existing) throw new Error(`CustomAdCampaign '${id}' not found`);

  const updated: CustomAdCampaign = {
    id: existing.id,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    ctaText: input.ctaText ?? existing.ctaText,
    destinationUrl: input.destinationUrl ?? existing.destinationUrl,
    targetApps: input.targetApps ?? existing.targetApps,
    targetAppId: input.targetAppId !== undefined ? input.targetAppId : existing.targetAppId,
    creativeType: input.creativeType !== undefined ? input.creativeType : existing.creativeType,
    placements: input.placements !== undefined ? input.placements : existing.placements,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    priority: input.priority ?? existing.priority,
    enabled: input.enabled ?? existing.enabled,
    status: input.status ?? existing.status,
    impressionsCount: input.impressionsCount ?? existing.impressionsCount,
    clicksCount: input.clicksCount ?? existing.clicksCount,
    creatives: input.creatives
      ? input.creatives.map((c) => ({
          ...c,
          createdAt: c.createdAt || existing.createdAt,
          updatedAt: new Date().toISOString(),
        }))
      : existing.creatives,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(id).set(updated, { merge: true });

  await logAdminAction({
    action: 'ads.custom_campaign_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: id,
    changes: { campaign: { before: existing, after: updated } },
    metadata: { module: 'ads' },
  });

  return updated;
}

export async function deleteCustomAdCampaign(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getCustomAdCampaign(id);
  if (!existing) throw new Error(`CustomAdCampaign '${id}' not found`);

  await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(id).delete();

  await logAdminAction({
    action: 'ads.custom_campaign_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: id,
    changes: { campaign: { before: existing, after: null } },
    metadata: { module: 'ads' },
  });
}

export async function trackCustomAdEvent(input: PlatformAdTrackRequestInput): Promise<{
  tracked: boolean;
  impressionsCount?: number;
  clicksCount?: number;
}> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const campaign = await getCustomAdCampaign(input.campaignId);
  if (!campaign) return { tracked: false };

  if (input.type === 'impression') {
    campaign.impressionsCount = (campaign.impressionsCount || 0) + 1;
  } else if (input.type === 'click') {
    campaign.clicksCount = (campaign.clicksCount || 0) + 1;
  }
  campaign.updatedAt = new Date().toISOString();

  await db.collection(COLLECTIONS.CUSTOM_AD_CAMPAIGNS).doc(campaign.id).set(campaign, { merge: true });

  return {
    tracked: true,
    impressionsCount: campaign.impressionsCount,
    clicksCount: campaign.clicksCount,
  };
}

// ============================================================
// 9. Kill Switches
// ============================================================

export async function getAdKillSwitches(): Promise<AdKillSwitches> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTIONS.AD_KILL_SWITCHES).doc('current').get();
  if (doc.exists) {
    return doc.data() as AdKillSwitches;
  }
  return defaultKillSwitches;
}

export async function updateAdKillSwitches(
  input: UpdateAdKillSwitchesInput,
  actor: { uid: string; email: string },
): Promise<AdKillSwitches> {
  await ensureAdsDataSeeded();
  const db = getFirestoreDb();
  const existing = await getAdKillSwitches();
  const now = new Date().toISOString();

  const updated: AdKillSwitches = {
    id: 'current',
    globalAdsDisabled: input.globalAdsDisabled ?? existing.globalAdsDisabled,
    networks: { ...existing.networks, ...(input.networks || {}) },
    apps: { ...existing.apps, ...(input.apps || {}) },
    formats: { ...existing.formats, ...(input.formats || {}) },
    placements: { ...existing.placements, ...(input.placements || {}) },
    customAdsDisabled: input.customAdsDisabled ?? existing.customAdsDisabled,
    updatedAt: now,
    updatedBy: actor.email || actor.uid || 'admin',
    reason: input.reason || existing.reason,
  };

  await db.collection(COLLECTIONS.AD_KILL_SWITCHES).doc('current').set(updated);

  await logAdminAction({
    action: 'ads.kill_switch_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adKillSwitches',
    resourceId: 'current',
    changes: { killSwitches: { before: existing, after: updated } },
    metadata: { module: 'ads', reason: updated.reason },
  });

  return updated;
}

// ============================================================
// 10. Effective Ad Configuration Resolver
// ============================================================

/**
 * Resolves the effective, client-safe ad configuration for a given app.
 *
 * Evaluation Chain:
 * 1. Global Kill Switch -> If true, ads completely disabled
 * 2. App Kill Switch / App Master Toggle -> If kill-switched or disabled, app ads disabled
 * 3. Content Safety Policy -> Determine ratings and category blocks
 * 4. For each Format:
 *    a. Check Format Kill Switch
 *    b. Check App Format Toggle
 *    c. Resolve Frequency Limits
 *    d. Resolve Mediation Chain: Filter out kill-switched/disabled networks, map public ad unit IDs
 *    e. Attach Custom Ad creative fallback if available and enabled
 * 5. Placements resolution: Check placement kill switch and attach caps
 * 6. Generate configuration version hash
 *
 * CRITICAL SECURITY GUARANTEE:
 * Provider secret keys (e.g. reporting secrets, private credentials) are NEVER returned.
 */
export async function resolveEffectiveAdConfig(
  appId: string,
): Promise<EffectiveAdConfigResponse> {
  await ensureAdsDataSeeded();

  const killSwitches = await getAdKillSwitches();
  const appConfig = await getAdAppConfig(appId);
  const safetyPolicy = await getAdSafetyPolicy(appId);
  const frequencyPolicy = await getAdFrequencyPolicy(appId);
  const allUnits = await getAdUnits(appId);
  const allPlacements = await getAdPlacements(appId);
  const allNetworks = await getAdNetworks();
  const customCampaigns = await getCustomAdCampaigns();

  const supportedFormats: AdFormat[] = [
    'banner',
    'native',
    'interstitial',
    'rewarded',
    'app_open',
    'rewarded_interstitial',
  ];

  // 0. Check for centralized App record in 'apps' collection with simpleAdsConfig
  const db = getFirestoreDb();
  let registeredApp: any = null;
  try {
    const docSnap = await db.collection(COLLECTIONS.APPS).doc(appId).get();
    if (docSnap.exists) {
      registeredApp = docSnap.data();
    }
  } catch (err) {
    // Non-blocking in mock environments
  }

  if (registeredApp && registeredApp.simpleAdsConfig) {
    const simple = registeredApp.simpleAdsConfig;
    const isGlobalKilled = Boolean(killSwitches.globalAdsDisabled);
    const isAppKilled = Boolean(killSwitches.apps[appId]);
    const overallEnabled = !isGlobalKilled && !isAppKilled && Boolean(simple.adsEnabled);
    const testMode = simple.environment === 'testing';
    const strategy = simple.strategy || 'automatic';
    const singleSource = simple.singleSourceNetwork || 'applovin';
    const bundled = simple.bundledAdapters || {
      applovin: true,
      admob: true,
      meta: true,
      inmobi: true,
      unity: true,
      wapCustomAds: true,
    };

    const isDemandSourceAllowed = (id: string) => {
      if (strategy === 'single_source') {
        return singleSource === id;
      }
      return true;
    };

    const isAdapterBundled = (id: string) => {
      return bundled[id as keyof typeof bundled] !== false;
    };

    const fmtMapping: Record<AdFormat, keyof typeof simple.enabledFormats> = {
      banner: 'banner',
      native: 'native',
      interstitial: 'interstitial',
      rewarded: 'rewarded',
      app_open: 'appOpen',
      rewarded_interstitial: 'rewardedInterstitial',
    };

    const admobTestUnits: Record<AdFormat, string> = {
      banner: 'ca-app-pub-3940256099942544/6300978111',
      native: 'ca-app-pub-3940256099942544/2247696110',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      app_open: 'ca-app-pub-3940256099942544/9257395921',
      rewarded_interstitial: 'ca-app-pub-3940256099942544/5354046379',
    };

    const applovinTestUnits: Record<AdFormat, string> = {
      banner: 'applovin_max_test_banner',
      native: 'applovin_max_test_native',
      interstitial: 'applovin_max_test_interstitial',
      rewarded: 'applovin_max_test_rewarded',
      app_open: 'applovin_max_test_app_open',
      rewarded_interstitial: 'applovin_max_test_rewarded_interstitial',
    };

    const metaTestUnits: Record<AdFormat, string> = {
      banner: 'IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID',
      native: 'IMG_16_9_APP_INSTALL#YOUR_PLACEMENT_ID',
      interstitial: 'VID_HD_9_16_39S_APP_INSTALL#YOUR_PLACEMENT_ID',
      rewarded: 'VID_HD_9_16_39S_APP_INSTALL#YOUR_PLACEMENT_ID',
      app_open: '',
      rewarded_interstitial: '',
    };

    const inmobiTestUnits: Record<AdFormat, string> = {
      banner: 'inmobi_test_banner_1478192',
      native: 'inmobi_test_native_1478193',
      interstitial: 'inmobi_test_interstitial_1478194',
      rewarded: 'inmobi_test_rewarded_1478195',
      app_open: '',
      rewarded_interstitial: '',
    };

    const unityTestUnits: Record<AdFormat, string> = {
      banner: 'Banner_Android',
      native: '',
      interstitial: 'Interstitial_Android',
      rewarded: 'Rewarded_Android',
      app_open: '',
      rewarded_interstitial: '',
    };

    const admobProdUnits: Record<AdFormat, string | undefined> = {
      banner: simple.networkConfig?.admob?.bannerId,
      native: simple.networkConfig?.admob?.nativeId,
      interstitial: simple.networkConfig?.admob?.interstitialId,
      rewarded: simple.networkConfig?.admob?.rewardedId,
      app_open: simple.networkConfig?.admob?.appOpenId,
      rewarded_interstitial: simple.networkConfig?.admob?.rewardedInterstitialId,
    };

    const resolvedFormats: Record<AdFormat, EffectiveAdFormatConfig> = {} as any;

    const nowTime = Date.now();
    const eligibleCustom = customCampaigns.filter(
      (c) =>
        c.enabled &&
        c.status === 'active' &&
        !killSwitches.customAdsDisabled &&
        (!c.startDate || new Date(c.startDate).getTime() <= nowTime) &&
        (!c.endDate || new Date(c.endDate).getTime() >= nowTime) &&
        (c.targetAppId === appId || c.targetApps.includes(appId) || c.targetApps.includes('*')),
    );

    for (const fmt of supportedFormats) {
      const isFormatKilled = Boolean(killSwitches.formats[fmt]);
      const fmtKey = fmtMapping[fmt];
      const isFormatEnabled = Boolean(simple.enabledFormats?.[fmtKey] ?? true);
      const formatEnabled = overallEnabled && !isFormatKilled && isFormatEnabled;

      const chain: Array<{ networkId: string; priority: number; adUnitId: string; timeoutMs: number }> = [];

      if (formatEnabled) {
        // AppLovin MAX Demand (built-in demand)
        if (
          (simple.networks?.applovin ?? true) &&
          !killSwitches.networks['applovin'] &&
          isDemandSourceAllowed('applovin') &&
          isAdapterBundled('applovin')
        ) {
          const adUnitId = testMode
            ? applovinTestUnits[fmt]
            : simple.networkConfig?.applovin?.placementIds?.[fmt];
          if (adUnitId) {
            chain.push({
              networkId: 'applovin',
              priority: 1,
              adUnitId,
              timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
            });
          }
        }

        // Google AdMob Demand via MAX
        if (
          simple.networks?.admob &&
          !killSwitches.networks['admob'] &&
          isDemandSourceAllowed('admob') &&
          isAdapterBundled('admob')
        ) {
          const adUnitId = testMode ? admobTestUnits[fmt] : admobProdUnits[fmt];
          if (adUnitId) {
            chain.push({
              networkId: 'admob',
              priority: 2,
              adUnitId,
              timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
            });
          }
        }

        // Meta Audience Network Demand via MAX
        if (
          fmt !== 'app_open' &&
          fmt !== 'rewarded_interstitial' &&
          simple.networks?.meta &&
          !killSwitches.networks['meta'] &&
          isDemandSourceAllowed('meta') &&
          isAdapterBundled('meta')
        ) {
          const placementId = testMode
            ? metaTestUnits[fmt]
            : simple.networkConfig?.meta?.placementIds?.[fmt];
          if (placementId) {
            chain.push({
              networkId: 'meta',
              priority: 3,
              adUnitId: placementId,
              timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
            });
          }
        }

        // InMobi Demand via MAX
        if (
          fmt !== 'app_open' &&
          fmt !== 'rewarded_interstitial' &&
          simple.networks?.inmobi &&
          !killSwitches.networks['inmobi'] &&
          isDemandSourceAllowed('inmobi') &&
          isAdapterBundled('inmobi')
        ) {
          const placementId = testMode
            ? inmobiTestUnits[fmt]
            : simple.networkConfig?.inmobi?.placementIds?.[fmt];
          if (placementId) {
            chain.push({
              networkId: 'inmobi',
              priority: 4,
              adUnitId: placementId,
              timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
            });
          }
        }

        // Unity Ads Demand via MAX
        if (
          (fmt === 'banner' || fmt === 'interstitial' || fmt === 'rewarded') &&
          simple.networks?.unity &&
          !killSwitches.networks['unity'] &&
          isDemandSourceAllowed('unity') &&
          isAdapterBundled('unity')
        ) {
          const placementId = testMode
            ? unityTestUnits[fmt]
            : simple.networkConfig?.unity?.placementIds?.[fmt];
          if (placementId) {
            chain.push({
              networkId: 'unity',
              priority: 5,
              adUnitId: placementId,
              timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
            });
          }
        }

        // WebAppyPie Custom Ads (House ads)
        if (simple.networks?.wapCustomAds && !killSwitches.networks['custom_ads'] && isAdapterBundled('wapCustomAds')) {
          chain.push({
            networkId: 'custom_ads',
            priority: 6,
            adUnitId: 'custom_inhouse',
            timeoutMs: ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
          });
        }
      }

      chain.sort((a, b) => a.priority - b.priority);

      const fmtFreq = frequencyPolicy.formats[fmt] || {
        minIntervalSeconds: fmt === 'banner' ? 30 : 45,
        cooldownSeconds: fmt === 'banner' ? 0 : 45,
        sessionCap: fmt === 'banner' ? 100 : 4,
        dailyCap: fmt === 'banner' ? 500 : 12,
      };

      let customFallback = null;
      if (simple.networks?.wapCustomAds && eligibleCustom.length > 0) {
        const fmtEligible = eligibleCustom.filter(
          (c) => !c.placements || c.placements.length === 0 || c.placements.includes(fmt),
        );
        if (fmtEligible.length > 0) {
          const camp = fmtEligible[0]!;
          const creative = camp.creatives?.find((cr) => cr.format === fmt) || camp.creatives?.[0];
          customFallback = {
            campaignId: camp.id,
            title: camp.title,
            description: camp.description,
            ctaText: camp.ctaText,
            destinationUrl: camp.destinationUrl,
            imageUrl: creative?.imageUrl || (camp as any).imageUrl,
            videoUrl: creative?.videoUrl,
            thumbnailUrl: creative?.thumbnailUrl,
            animationUrl: creative?.animationUrl,
            creativeType: camp.creativeType || creative?.creativeType || 'image',
            carouselItems: creative?.carouselItems,
          };
        }
      }

      resolvedFormats[fmt] = {
        enabled: formatEnabled,
        format: fmt,
        refreshIntervalSeconds: fmt === 'banner' ? 60 : undefined,
        frequency: {
          minIntervalSeconds: fmtFreq.minIntervalSeconds,
          cooldownSeconds: fmtFreq.cooldownSeconds,
          sessionCap: fmtFreq.sessionCap,
          dailyCap: fmtFreq.dailyCap,
        },
        mediationChain: chain,
        customAdFallback: customFallback,
      };
    }

    const payloadToHash = JSON.stringify({
      appId,
      overallEnabled,
      testMode,
      formats: resolvedFormats,
    });
    const version = crypto.createHash('sha256').update(payloadToHash).digest('hex').substring(0, 16);

    return {
      appId,
      enabled: overallEnabled,
      testMode,
      version,
      safety: {
        maxAdRating: safetyPolicy.maxAdRating,
        blockedCategories: safetyPolicy.blockedCategories,
      },
      formats: resolvedFormats,
      placements: {},
      disclaimer: safetyPolicy.disclaimer,
      timestamp: new Date().toISOString(),
    };
  }

  const isGlobalKilled = Boolean(killSwitches.globalAdsDisabled);
  const isAppKilled = Boolean(killSwitches.apps[appId]);
  const isAppMasterOn = Boolean(appConfig?.masterEnabled ?? true);
  const overallEnabled = !isGlobalKilled && !isAppKilled && isAppMasterOn;

  const resolvedFormats: Record<AdFormat, EffectiveAdFormatConfig> = {} as any;

  // Active custom ads eligible for this app
  const nowTimeLegacy = Date.now();
  const eligibleCustomCampaigns = customCampaigns.filter(
    (c) =>
      c.enabled &&
      c.status === 'active' &&
      !killSwitches.customAdsDisabled &&
      (!c.startDate || new Date(c.startDate).getTime() <= nowTimeLegacy) &&
      (!c.endDate || new Date(c.endDate).getTime() >= nowTimeLegacy) &&
      (c.targetAppId === appId || c.targetApps.includes(appId) || c.targetApps.includes('*')),
  );

  for (const fmt of supportedFormats) {
    const isFormatKilled = Boolean(killSwitches.formats[fmt]);
    const isFormatAppEnabled = Boolean(appConfig?.formats?.[fmt]?.enabled ?? true);
    const formatEnabled = overallEnabled && !isFormatKilled && isFormatAppEnabled;

    // Get rotation policy for this app + format
    const rotationPolicy = await getAdRotationPolicy(appId, fmt);

    // Filter available networks in rotation
    const chain: Array<{
      networkId: string;
      priority: number;
      adUnitId: string;
      timeoutMs: number;
    }> = [];

    if (formatEnabled) {
      for (const tier of rotationPolicy.tiers) {
        if (!tier.enabled) continue;
        const netId = tier.networkId;

        // Check if network is kill-switched or globally disabled
        const isNetKilled = Boolean(killSwitches.networks[netId]);
        const netDoc = allNetworks.find((n) => n.id === netId);
        if (isNetKilled || !netDoc || !netDoc.enabled) continue;

        // Check app restriction on network
        if (
          netDoc.allowedAppIds &&
          netDoc.allowedAppIds.length > 0 &&
          !netDoc.allowedAppIds.includes('*') &&
          !netDoc.allowedAppIds.includes(appId)
        ) {
          continue;
        }

        // Match registered public ad unit ID
        const matchedUnit = allUnits.find(
          (u) => u.appId === appId && u.networkId === netId && u.format === fmt && u.enabled,
        );

        const adUnitId = matchedUnit?.adUnitId || (netId === 'custom_ads' ? 'custom_inhouse' : '');

        if (adUnitId) {
          chain.push({
            networkId: netId,
            priority: tier.priority,
            adUnitId,
            timeoutMs: tier.timeoutMs || ADS_CONFIG.DEFAULT_MEDIATION_TIMEOUT_MS,
          });
        }
      }
    }

    chain.sort((a, b) => a.priority - b.priority);

    // Frequency controls for this format
    const fmtFreq = frequencyPolicy.formats[fmt] || {
      minIntervalSeconds: fmt === 'banner' ? 30 : 45,
      cooldownSeconds: fmt === 'banner' ? 0 : 45,
      sessionCap: fmt === 'banner' ? 100 : 4,
      dailyCap: fmt === 'banner' ? 500 : 12,
    };

    // Custom ad fallback creative
    let customFallback = null;
    if (rotationPolicy.fallbackToCustomAds && eligibleCustomCampaigns.length > 0) {
      const fmtEligible = eligibleCustomCampaigns.filter(
        (c) => !c.placements || c.placements.length === 0 || c.placements.includes(fmt),
      );
      if (fmtEligible.length > 0) {
        const camp = fmtEligible[0]!;
        const creative = camp.creatives?.find((cr) => cr.format === fmt) || camp.creatives?.[0];
        customFallback = {
          campaignId: camp.id,
          title: camp.title,
          description: camp.description,
          ctaText: camp.ctaText,
          destinationUrl: camp.destinationUrl,
          imageUrl: creative?.imageUrl || (camp as any).imageUrl,
          videoUrl: creative?.videoUrl,
          thumbnailUrl: creative?.thumbnailUrl,
          animationUrl: creative?.animationUrl,
          creativeType: camp.creativeType || creative?.creativeType || 'image',
          carouselItems: creative?.carouselItems,
        };
      }
    }

    // Refresh interval for banner
    const refreshSec =
      fmt === 'banner'
        ? Math.max(
            ADS_CONFIG.MIN_BANNER_REFRESH_INTERVAL_SECONDS,
            appConfig?.formats?.banner?.refreshIntervalSeconds ||
              rotationPolicy.bannerRefreshIntervalSeconds ||
              ADS_CONFIG.DEFAULT_BANNER_REFRESH_INTERVAL_SECONDS,
          )
        : undefined;

    resolvedFormats[fmt] = {
      enabled: formatEnabled,
      format: fmt,
      ...(refreshSec ? { refreshIntervalSeconds: refreshSec } : {}),
      frequency: {
        minIntervalSeconds: fmtFreq.minIntervalSeconds,
        cooldownSeconds: fmtFreq.cooldownSeconds,
        sessionCap: fmtFreq.sessionCap,
        dailyCap: fmtFreq.dailyCap,
      },
      mediationChain: chain,
      customAdFallback: customFallback,
    };
  }

  // Resolved Placements
  const resolvedPlacements: Record<string, any> = {};
  for (const pl of allPlacements) {
    const isPlKilled = Boolean(killSwitches.placements[pl.placementKey]);
    resolvedPlacements[pl.placementKey] = {
      placementKey: pl.placementKey,
      format: pl.format,
      enabled: overallEnabled && !isPlKilled && pl.enabled,
      ...(pl.cooldownSeconds !== undefined ? { cooldownSeconds: pl.cooldownSeconds } : {}),
      ...(pl.sessionCap !== undefined ? { sessionCap: pl.sessionCap } : {}),
      ...(pl.dailyCap !== undefined ? { dailyCap: pl.dailyCap } : {}),
      ...(pl.foregroundRule ? { foregroundRule: pl.foregroundRule } : {}),
    };
  }

  // Stable configuration hash
  const payloadToHash = JSON.stringify({
    appId,
    overallEnabled,
    safety: safetyPolicy.blockedCategories,
    formats: resolvedFormats,
    placements: resolvedPlacements,
  });
  const version = crypto.createHash('sha256').update(payloadToHash).digest('hex').substring(0, 16);

  return {
    appId,
    enabled: overallEnabled,
    testMode: false,
    version,
    safety: {
      maxAdRating: safetyPolicy.maxAdRating,
      blockedCategories: safetyPolicy.blockedCategories,
    },
    formats: resolvedFormats,
    placements: resolvedPlacements,
    disclaimer: safetyPolicy.disclaimer,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// 11. Ads Overview Metrics
// ============================================================

export async function getAdsOverviewMetrics(): Promise<AdsOverviewMetrics> {
  await ensureAdsDataSeeded();
  const networks = await getAdNetworks();
  const apps = await getAdAppConfigs();
  const placements = await getAdPlacements();
  const killSwitches = await getAdKillSwitches();

  const activeNetworks = networks.filter(
    (n) => n.enabled && !killSwitches.networks[n.id] && !killSwitches.globalAdsDisabled,
  );
  const activePlacements = placements.filter(
    (p) => p.enabled && !killSwitches.placements[p.placementKey] && !killSwitches.globalAdsDisabled,
  );

  // Derive real metrics from existing AnalyticsQueryService (zero fabrication)
  let totalImpressions = 0;
  let overallFillRate = 0.0;
  let revenueStatus = 'Not connected';

  const networkBreakdown: Record<
    string,
    {
      impressions: number;
      revenueUsd: number;
      fillRatePct: number;
      status: any;
      revenueStatus?: string;
    }
  > = {};

  try {
    const [overview, netList] = await Promise.all([
      AnalyticsQueryService.getOverview({ preset: 'today' }),
      AnalyticsQueryService.getNetworks({ preset: 'today' }),
    ]);

    totalImpressions = overview.totalImpressions || 0;
    overallFillRate = overview.overallFillRate || 0.0;
    revenueStatus = overview.revenueStatus || 'Not connected';

    for (const net of netList) {
      const netConfig = networks.find((n) => n.id === net.provider);
      networkBreakdown[net.provider] = {
        impressions: net.impressions || 0,
        revenueUsd: 0.0, // Strict zero-fabrication: reporting APIs not connected
        fillRatePct: net.fillRate || 0.0,
        status:
          netConfig?.healthStatus ||
          net.status || { status: 'unknown', lastCheckedAt: new Date().toISOString() },
        revenueStatus: net.revenueStatus || 'Not connected',
      };
    }
  } catch (err) {
    console.warn('[adConfigService] Failed to query AnalyticsQueryService for overview metrics:', err);
  }

  // Ensure all configured networks exist in networkBreakdown
  for (const net of networks) {
    if (!networkBreakdown[net.id]) {
      networkBreakdown[net.id] = {
        impressions: 0,
        revenueUsd: 0.0,
        fillRatePct: 0.0,
        status: net.healthStatus || { status: 'unknown', lastCheckedAt: new Date().toISOString() },
        revenueStatus: 'Not connected',
      };
    }
  }

  return {
    totalApps: apps.length,
    activeAdNetworks: activeNetworks.length,
    activeAdPlacements: activePlacements.length,
    adsMasterEnabled: !killSwitches.globalAdsDisabled,
    estimatedImpressionsDaily: totalImpressions,
    estimatedRevenueDailyUsd: 0.0, // Strict zero-fabrication: reporting APIs not connected
    fillRatePct: overallFillRate,
    revenueStatus,
    isRevenueConnected: false,
    networkBreakdown,
    recentAuditLogs: [],
  };
}
