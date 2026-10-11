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
import { COLLECTIONS, ADS_CONFIG } from '@wapcentral/config';
import type {
  AdNetwork,
  AdAppConfig,
  AdUnitDoc,
  AdPlacementDoc,
  AdRotationPolicy,
  AdFrequencyPolicy,
  AdSafetyPolicy,
  AdKillSwitches,
  CustomAdCampaign,
  EffectiveAdConfigResponse,
  AdsOverviewMetrics,
  AuditLog,
  AdFormat,
} from '@wapcentral/types';
import {
  CreateAdNetworkSchema,
  UpdateAdNetworkSchema,
  AdAppConfigSchema,
  UpdateAdAppConfigSchema,
  CreateAdUnitDocSchema,
  UpdateAdUnitDocSchema,
  CreateAdPlacementDocSchema,
  UpdateAdPlacementDocSchema,
  AdRotationPolicySchema,
  UpdateAdFrequencyPolicySchema,
  UpdateAdSafetyPolicySchema,
  CreateCustomAdCampaignSchema,
  UpdateCustomAdCampaignSchema,
  UpdateAdKillSwitchesSchema,
  type CreateAdNetworkInput,
  type UpdateAdNetworkInput,
  type UpdateAdAppConfigInput,
  type CreateAdUnitDocInput,
  type UpdateAdUnitDocInput,
  type CreateAdPlacementDocInput,
  type UpdateAdPlacementDocInput,
  type AdRotationPolicyInput,
  type UpdateAdFrequencyPolicyInput,
  type UpdateAdSafetyPolicyInput,
  type CreateCustomAdCampaignInput,
  type UpdateCustomAdCampaignInput,
  type UpdateAdKillSwitchesInput,
} from '@wapcentral/validation';
import { recordAuditLog } from './auditService.js';
import { sanitizeForFirestore } from './appsService.js';

// ============================================================
// In-Memory Test State (Used during Vitest offline runs)
// ============================================================

let testNetworks: AdNetwork[] = [
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
    notes: 'Google AdMob primary SDK mediation network',
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
    notes: 'High-yield bidding for display & video',
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
    supportedFormats: ['banner', 'native', 'interstitial', 'rewarded', 'rewarded_interstitial'],
    priority: 3,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Global bidding and programmatic exchange',
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
    priority: 4,
    healthStatus: { status: 'unknown', lastCheckedAt: new Date().toISOString() },
    notes: 'Internal first-party cross-promotions',
    allowedAppIds: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testApps: AdAppConfig[] = [
  {
    id: 'filezen',
    appId: 'filezen',
    appName: 'FileZen — AI File & Document Manager',
    masterEnabled: true,
    formats: {
      banner: { enabled: true, refreshIntervalSeconds: 60 },
      native: { enabled: true },
      interstitial: { enabled: true, cooldownSeconds: 45, sessionCap: 4, dailyCap: 12 },
      rewarded: { enabled: true, dailyCap: 15 },
      app_open: { enabled: true },
      rewarded_interstitial: { enabled: false },
    },
    networkSettings: {
      admob: { enabled: true, appIdOrSdkKey: 'ca-app-pub-3940256099942544~3347511713' },
      meta: { enabled: true, appIdOrSdkKey: 'meta_app_filezen' },
      applovin: { enabled: true, appIdOrSdkKey: 'applovin_sdk_key_filezen' },
      custom_ads: { enabled: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'optilens',
    appId: 'optilens',
    appName: 'OptiLens AI — Smart Camera & Photo Enhancer',
    masterEnabled: true,
    formats: {
      banner: { enabled: true, refreshIntervalSeconds: 60 },
      native: { enabled: true },
      interstitial: { enabled: true, cooldownSeconds: 60, sessionCap: 3, dailyCap: 10 },
      rewarded: { enabled: true, dailyCap: 20 },
      app_open: { enabled: true },
      rewarded_interstitial: { enabled: true },
    },
    networkSettings: {
      admob: { enabled: true, appIdOrSdkKey: 'ca-app-pub-3940256099942544~3347511713' },
      meta: { enabled: true, appIdOrSdkKey: 'meta_app_optilens' },
      applovin: { enabled: true, appIdOrSdkKey: 'applovin_sdk_key_optilens' },
      custom_ads: { enabled: true },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testUnits: AdUnitDoc[] = [
  {
    id: 'filezen_admob_banner',
    appId: 'filezen',
    networkId: 'admob',
    format: 'banner',
    platform: 'android',
    name: 'FileZen Home Banner (AdMob)',
    adUnitId: 'ca-app-pub-3940256099942544/6300978111',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'filezen_admob_interstitial',
    appId: 'filezen',
    networkId: 'admob',
    format: 'interstitial',
    platform: 'android',
    name: 'FileZen Conversion Interstitial (AdMob)',
    adUnitId: 'ca-app-pub-3940256099942544/1033173712',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'optilens_admob_banner',
    appId: 'optilens',
    networkId: 'admob',
    format: 'banner',
    platform: 'android',
    name: 'OptiLens Gallery Banner (AdMob)',
    adUnitId: 'ca-app-pub-3940256099942544/6300978111',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testPlacements: AdPlacementDoc[] = [
  {
    id: 'filezen_home_banner',
    appId: 'filezen',
    placementKey: 'home_bottom_banner',
    name: 'Main Screen Bottom Banner',
    format: 'banner',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'filezen_export_interstitial',
    appId: 'filezen',
    placementKey: 'file_export_interstitial',
    name: 'File Export Completion Screen',
    format: 'interstitial',
    enabled: true,
    cooldownSeconds: 45,
    sessionCap: 3,
    dailyCap: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testRotationPolicies: AdRotationPolicy[] = [
  {
    id: 'filezen_banner',
    appId: 'filezen',
    format: 'banner',
    tiers: [
      { networkId: 'admob', priority: 1, enabled: true, timeoutMs: 5000 },
      { networkId: 'meta', priority: 2, enabled: true, timeoutMs: 5000 },
      { networkId: 'applovin', priority: 3, enabled: true, timeoutMs: 5000 },
      { networkId: 'custom_ads', priority: 4, enabled: true },
    ],
    fallbackToCustomAds: true,
    bannerRefreshIntervalSeconds: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testFrequencyPolicies: AdFrequencyPolicy[] = [
  {
    id: 'filezen',
    appId: 'filezen',
    formats: {
      banner: { minIntervalSeconds: 30, cooldownSeconds: 0, sessionCap: 100, dailyCap: 500 },
      native: { minIntervalSeconds: 15, cooldownSeconds: 0, sessionCap: 50, dailyCap: 200 },
      interstitial: { minIntervalSeconds: 45, cooldownSeconds: 45, sessionCap: 4, dailyCap: 12 },
      rewarded: { minIntervalSeconds: 10, cooldownSeconds: 10, sessionCap: 10, dailyCap: 25 },
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
  },
];

let testSafetyPolicies: AdSafetyPolicy[] = [
  {
    id: 'filezen',
    appId: 'filezen',
    blockedCategories: [...ADS_CONFIG.DEFAULT_BLOCKED_CATEGORIES],
    maxAdRating: 'PG',
    blockSensitiveCategories: true,
    childDirectedApp: false,
    customBlockedKeywords: ['crypto', 'loan', 'dating'],
    disclaimer:
      'WAPCentral restricts ad content categories. Third-party ad networks serve through programmatic auctions; emergency kill switches can instantly halt ads.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let testCustomCampaigns: CustomAdCampaign[] = [
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
        headline: 'Enhance Photos Instantly',
        bodyText: 'Restore blur and glare in 1-tap.',
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

let testKillSwitches: AdKillSwitches = {
  id: 'current',
  globalAdsDisabled: false,
  networks: { admob: false, meta: false, applovin: false, custom_ads: false },
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
  updatedBy: 'system',
};

// ============================================================
// Helper: Safe Realtime Subscription Factory & In-Memory Offline Bus
// ============================================================
const offlineListeners = new Map<string, Set<(items: any[]) => void>>();

function registerOfflineListener(colName: string, cb: (items: any[]) => void): () => void {
  if (!offlineListeners.has(colName)) {
    offlineListeners.set(colName, new Set());
  }
  offlineListeners.get(colName)!.add(cb);
  return () => {
    offlineListeners.get(colName)?.delete(cb);
  };
}

function notifyOfflineListeners(colName: string, items: any[]) {
  const set = offlineListeners.get(colName);
  if (set) {
    for (const listener of set) {
      listener([...items]);
    }
  }
}

function createSubscription<T>(
  collectionName: string,
  fallbackData: T[],
  onData: (items: T[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData([...fallbackData]);
    return registerOfflineListener(collectionName, onData);
  }

  try {
    const colRef = collection(db, collectionName);
    const q = query(colRef);
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as T);
        onData(items);
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

const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/admin/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Non-blocking in mock mode
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

// ============================================================
// 1. Overview & Metrics
// ============================================================
export async function fetchAdsOverview(): Promise<AdsOverviewMetrics> {
  if (!isOfflineMode && !isTestEnv) {
    try {
      const res = await fetchWithAuth(`${ADMIN_API_BASE}/ads/overview`);
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[adsService] Error calling GET /api/admin/v1/ads/overview, using zero-telemetry fallback:', err);
    }
  }

  // Offline / fallback zero-state (strictly zero fabrication)
  const activeNetworks = testNetworks.filter(
    (n) => n.enabled && !testKillSwitches.networks[n.id] && !testKillSwitches.globalAdsDisabled,
  );
  const activePlacements = testPlacements.filter(
    (p) => p.enabled && !testKillSwitches.placements[p.placementKey] && !testKillSwitches.globalAdsDisabled,
  );

  return {
    totalApps: testApps.length,
    activeAdNetworks: activeNetworks.length,
    activeAdPlacements: activePlacements.length,
    adsMasterEnabled: !testKillSwitches.globalAdsDisabled,
    estimatedImpressionsDaily: 0,
    estimatedRevenueDailyUsd: 0.0,
    fillRatePct: 0.0,
    revenueStatus: 'Not connected',
    isRevenueConnected: false,
    networkBreakdown: {
      admob: { impressions: 0, revenueUsd: 0.0, fillRatePct: 0.0, status: { status: 'unknown', lastCheckedAt: new Date().toISOString() }, revenueStatus: 'Not connected' },
      meta: { impressions: 0, revenueUsd: 0.0, fillRatePct: 0.0, status: { status: 'unknown', lastCheckedAt: new Date().toISOString() }, revenueStatus: 'Not connected' },
      applovin: { impressions: 0, revenueUsd: 0.0, fillRatePct: 0.0, status: { status: 'unknown', lastCheckedAt: new Date().toISOString() }, revenueStatus: 'Not connected' },
      custom_ads: { impressions: 0, revenueUsd: 0.0, fillRatePct: 0.0, status: { status: 'unknown', lastCheckedAt: new Date().toISOString() }, revenueStatus: 'Active (internal promotions)' },
    },
    recentAuditLogs: [],
  };
}

// ============================================================
// 2. Ad Networks
// ============================================================
export function subscribeAdNetworks(
  onData: (networks: AdNetwork[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdNetwork>(COLLECTIONS.AD_NETWORKS, testNetworks, onData, onError);
}

export async function createAdNetwork(
  input: CreateAdNetworkInput,
  actor: { uid: string; email: string },
): Promise<AdNetwork> {
  const validated = CreateAdNetworkSchema.parse(input);
  const now = new Date().toISOString();
  const network: AdNetwork = {
    ...validated,
    id: validated.id,
    configured: validated.configured ?? false,
    healthStatus: validated.healthStatus ? {
      ...validated.healthStatus,
      lastCheckedAt: validated.healthStatus.lastCheckedAt || now,
    } : { status: 'unknown', lastCheckedAt: now },
    createdAt: now,
    updatedAt: now,
  };

  if (isOfflineMode) {
    testNetworks = [...testNetworks, network];
    notifyOfflineListeners(COLLECTIONS.AD_NETWORKS, testNetworks);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_NETWORKS, network.id);
    await setDoc(docRef, { ...network, updatedAt: serverTimestamp() });
  }

  await recordAuditLog({
    action: 'ads.network_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: network.id,
    changes: { network: { before: null, after: network } },
  });

  return network;
}

export async function updateAdNetwork(
  id: string,
  input: UpdateAdNetworkInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdNetworkSchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testNetworks.find((n) => n.id === id);
    if (existing) {
      Object.assign(existing, validated, { updatedAt: now });
    }
    notifyOfflineListeners(COLLECTIONS.AD_NETWORKS, testNetworks);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_NETWORKS, id);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.network_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: id,
    changes: { network: { before: null, after: validated } },
  });
}

export async function deleteAdNetwork(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testNetworks = testNetworks.filter((n) => n.id !== id);
    notifyOfflineListeners(COLLECTIONS.AD_NETWORKS, testNetworks);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_NETWORKS, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'ads.network_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adNetwork',
    resourceId: id,
    changes: { network: { before: null, after: null } },
  });
}

// ============================================================
// 3. App-wise Ad Configuration
// ============================================================
export function subscribeAdApps(
  onData: (apps: AdAppConfig[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdAppConfig>(COLLECTIONS.AD_APPS, testApps, onData, onError);
}

export async function updateAdAppConfig(
  appId: string,
  input: UpdateAdAppConfigInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdAppConfigSchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testApps.find((a) => a.appId === appId);
    if (existing) {
      if (validated.formats) {
        existing.formats = { ...existing.formats, ...validated.formats };
      }
      if (validated.masterEnabled !== undefined) {
        existing.masterEnabled = validated.masterEnabled;
      }
      existing.updatedAt = now;
    }
    notifyOfflineListeners(COLLECTIONS.AD_APPS, testApps);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_APPS, appId);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.app_config_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adAppConfig',
    resourceId: appId,
    changes: { adAppConfig: { before: null, after: validated } },
  });
}

// ============================================================
// 4. Ad Units
// ============================================================
export function subscribeAdUnits(
  onData: (units: AdUnitDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdUnitDoc>(COLLECTIONS.AD_UNITS, testUnits, onData, onError);
}

export async function createAdUnit(
  input: CreateAdUnitDocInput,
  actor: { uid: string; email: string },
): Promise<AdUnitDoc> {
  const id = input.id || `unit_${input.appId}_${input.networkId}_${input.format}_${Date.now()}`;
  const validated = CreateAdUnitDocSchema.parse({ ...input, id });
  const now = new Date().toISOString();
  const unit: AdUnitDoc = { ...validated, id, createdAt: now, updatedAt: now };

  if (isOfflineMode) {
    testUnits = [...testUnits, unit];
    notifyOfflineListeners(COLLECTIONS.AD_UNITS, testUnits);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_UNITS, unit.id);
    await setDoc(docRef, { ...unit, updatedAt: serverTimestamp() });
  }

  await recordAuditLog({
    action: 'ads.unit_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: unit.id,
    changes: { adUnit: { before: null, after: unit } },
  });

  return unit;
}

export async function updateAdUnit(
  id: string,
  input: UpdateAdUnitDocInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdUnitDocSchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testUnits.find((u) => u.id === id);
    if (existing) Object.assign(existing, validated, { updatedAt: now });
    notifyOfflineListeners(COLLECTIONS.AD_UNITS, testUnits);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_UNITS, id);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.unit_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: id,
    changes: { adUnit: { before: null, after: validated } },
  });
}

export async function deleteAdUnit(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testUnits = testUnits.filter((u) => u.id !== id);
    notifyOfflineListeners(COLLECTIONS.AD_UNITS, testUnits);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_UNITS, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'ads.unit_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adUnit',
    resourceId: id,
    changes: { adUnit: { before: null, after: null } },
  });
}

// ============================================================
// 5. Ad Placements
// ============================================================
export function subscribeAdPlacements(
  onData: (placements: AdPlacementDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdPlacementDoc>(COLLECTIONS.AD_PLACEMENTS, testPlacements, onData, onError);
}

export async function createAdPlacement(
  input: CreateAdPlacementDocInput,
  actor: { uid: string; email: string },
): Promise<AdPlacementDoc> {
  const id = input.id || `place_${input.appId}_${input.placementKey}`;
  const validated = CreateAdPlacementDocSchema.parse({ ...input, id });
  const now = new Date().toISOString();
  const placement: AdPlacementDoc = { ...validated, id, createdAt: now, updatedAt: now };

  if (isOfflineMode) {
    testPlacements = [...testPlacements, placement];
    notifyOfflineListeners(COLLECTIONS.AD_PLACEMENTS, testPlacements);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_PLACEMENTS, placement.id);
    await setDoc(docRef, { ...placement, updatedAt: serverTimestamp() });
  }

  await recordAuditLog({
    action: 'ads.placement_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: placement.id,
    changes: { adPlacement: { before: null, after: placement } },
  });

  return placement;
}

export async function updateAdPlacement(
  id: string,
  input: UpdateAdPlacementDocInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdPlacementDocSchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testPlacements.find((p) => p.id === id);
    if (existing) Object.assign(existing, validated, { updatedAt: now });
    notifyOfflineListeners(COLLECTIONS.AD_PLACEMENTS, testPlacements);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_PLACEMENTS, id);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.placement_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: id,
    changes: { adPlacement: { before: null, after: validated } },
  });
}

export async function deleteAdPlacement(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testPlacements = testPlacements.filter((p) => p.id !== id);
    notifyOfflineListeners(COLLECTIONS.AD_PLACEMENTS, testPlacements);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_PLACEMENTS, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'ads.placement_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adPlacement',
    resourceId: id,
    changes: { adPlacement: { before: null, after: null } },
  });
}

// ============================================================
// 6. Rotation Policies
// ============================================================
export function subscribeAdRotationPolicies(
  onData: (policies: AdRotationPolicy[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdRotationPolicy>(COLLECTIONS.AD_ROTATION_POLICIES, testRotationPolicies, onData, onError);
}

export async function updateAdRotationPolicy(
  input: AdRotationPolicyInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const id = input.id || `${input.appId}_${input.format}`;
  const validated = AdRotationPolicySchema.parse({ ...input, id });
  const now = new Date().toISOString();
  const policy: AdRotationPolicy = {
    ...validated,
    id,
    bannerRefreshIntervalSeconds: Math.max(
      ADS_CONFIG.MIN_BANNER_REFRESH_INTERVAL_SECONDS,
      validated.bannerRefreshIntervalSeconds || 60,
    ),
    createdAt: validated.createdAt || now,
    updatedAt: now,
  };

  if (isOfflineMode) {
    const idx = testRotationPolicies.findIndex((p) => p.id === policy.id);
    if (idx >= 0) {
      testRotationPolicies[idx] = policy;
    } else {
      testRotationPolicies.push(policy);
    }
    notifyOfflineListeners(COLLECTIONS.AD_ROTATION_POLICIES, testRotationPolicies);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_ROTATION_POLICIES, policy.id);
    await setDoc(docRef, { ...policy, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.rotation_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adRotationPolicy',
    resourceId: policy.id,
    changes: { rotationPolicy: { before: null, after: policy } },
  });
}

// ============================================================
// 7. Frequency Policies
// ============================================================
export function subscribeAdFrequencyPolicies(
  onData: (policies: AdFrequencyPolicy[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdFrequencyPolicy>(COLLECTIONS.AD_FREQUENCY_POLICIES, testFrequencyPolicies, onData, onError);
}

export async function updateAdFrequencyPolicy(
  appId: string,
  input: UpdateAdFrequencyPolicyInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdFrequencyPolicySchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testFrequencyPolicies.find((p) => p.appId === appId);
    if (existing) {
      if (validated.formats) {
        existing.formats = { ...existing.formats, ...validated.formats };
      }
      existing.updatedAt = now;
    } else {
      testFrequencyPolicies.push({
        id: appId,
        appId,
        formats: validated.formats as any,
        createdAt: now,
        updatedAt: now,
      });
    }
    notifyOfflineListeners(COLLECTIONS.AD_FREQUENCY_POLICIES, testFrequencyPolicies);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_FREQUENCY_POLICIES, appId);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.frequency_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adFrequencyPolicy',
    resourceId: appId,
    changes: { frequencyPolicy: { before: null, after: validated } },
  });
}

// ============================================================
// 8. Content Safety Policies
// ============================================================
export function subscribeAdSafetyPolicies(
  onData: (policies: AdSafetyPolicy[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<AdSafetyPolicy>(COLLECTIONS.AD_SAFETY_POLICIES, testSafetyPolicies, onData, onError);
}

export async function updateAdSafetyPolicy(
  appId: string,
  input: UpdateAdSafetyPolicyInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdSafetyPolicySchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    const existing = testSafetyPolicies.find((p) => p.appId === appId);
    if (existing) {
      Object.assign(existing, validated, { updatedAt: now });
    } else {
      testSafetyPolicies.push({
        id: appId,
        appId,
        blockedCategories: validated.blockedCategories || [],
        maxAdRating: validated.maxAdRating || 'PG',
        blockSensitiveCategories: validated.blockSensitiveCategories ?? true,
        childDirectedApp: validated.childDirectedApp ?? false,
        disclaimer: 'Platform safety disclaimer',
        createdAt: now,
        updatedAt: now,
      });
    }
    notifyOfflineListeners(COLLECTIONS.AD_SAFETY_POLICIES, testSafetyPolicies);
  } else {
    const docRef = doc(db, COLLECTIONS.AD_SAFETY_POLICIES, appId);
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.safety_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adSafetyPolicy',
    resourceId: appId,
    changes: { safetyPolicy: { before: null, after: validated } },
  });
}

// ============================================================
// 9. Custom Ad Campaigns
// ============================================================
export function subscribeCustomAdCampaigns(
  onData: (campaigns: CustomAdCampaign[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return createSubscription<CustomAdCampaign>(COLLECTIONS.CUSTOM_AD_CAMPAIGNS, testCustomCampaigns, onData, onError);
}

export async function createCustomAdCampaign(
  input: CreateCustomAdCampaignInput,
  actor: { uid: string; email: string },
): Promise<CustomAdCampaign> {
  const id = input.id || `camp_${Date.now()}`;
  const endDate = input.endDate || new Date(Date.now() + 365 * 86400000).toISOString();
  const validated = CreateCustomAdCampaignSchema.parse({ ...input, id, endDate });
  const now = new Date().toISOString();
  const campaign: CustomAdCampaign = {
    ...validated,
    id,
    endDate,
    enabled: validated.enabled ?? true,
    impressionsCount: validated.impressionsCount ?? 0,
    clicksCount: validated.clicksCount ?? 0,
    creatives: (validated.creatives || []).map((c) => ({
      ...c,
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now,
    })),
    createdAt: now,
    updatedAt: now,
  };

  const sanitized = sanitizeForFirestore(campaign, false);

  if (isOfflineMode) {
    testCustomCampaigns = [...testCustomCampaigns, campaign];
    notifyOfflineListeners(COLLECTIONS.CUSTOM_AD_CAMPAIGNS, testCustomCampaigns);
  } else {
    const docRef = doc(db, COLLECTIONS.CUSTOM_AD_CAMPAIGNS, campaign.id);
    await setDoc(docRef, { ...sanitized, updatedAt: serverTimestamp() });
  }

  await recordAuditLog({
    action: 'ads.custom_campaign_create',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: campaign.id,
    changes: { campaign: { before: null, after: campaign } },
  });

  return campaign;
}

export async function updateCustomAdCampaign(
  id: string,
  input: UpdateCustomAdCampaignInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateCustomAdCampaignSchema.parse(input);
  const now = new Date().toISOString();
  const sanitized = sanitizeForFirestore(validated, true);

  if (isOfflineMode) {
    const existing = testCustomCampaigns.find((c) => c.id === id);
    if (existing) Object.assign(existing, validated, { updatedAt: now });
    notifyOfflineListeners(COLLECTIONS.CUSTOM_AD_CAMPAIGNS, testCustomCampaigns);
  } else {
    const docRef = doc(db, COLLECTIONS.CUSTOM_AD_CAMPAIGNS, id);
    await setDoc(docRef, { ...sanitized, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.custom_campaign_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: id,
    changes: { campaign: { before: null, after: validated } },
  });
}

export async function deleteCustomAdCampaign(
  id: string,
  actor: { uid: string; email: string },
): Promise<void> {
  if (isOfflineMode) {
    testCustomCampaigns = testCustomCampaigns.filter((c) => c.id !== id);
    notifyOfflineListeners(COLLECTIONS.CUSTOM_AD_CAMPAIGNS, testCustomCampaigns);
  } else {
    const docRef = doc(db, COLLECTIONS.CUSTOM_AD_CAMPAIGNS, id);
    await deleteDoc(docRef);
  }

  await recordAuditLog({
    action: 'ads.custom_campaign_delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'customAdCampaign',
    resourceId: id,
    changes: { campaign: { before: null, after: null } },
  });
}

// ============================================================
// 10. Kill Switches
// ============================================================
const offlineKillSwitchListeners = new Set<(switches: AdKillSwitches) => void>();

export function subscribeAdKillSwitches(
  onData: (switches: AdKillSwitches) => void,
  onError?: (err: Error) => void,
): () => void {
  if (isOfflineMode) {
    onData({ ...testKillSwitches });
    offlineKillSwitchListeners.add(onData);
    return () => {
      offlineKillSwitchListeners.delete(onData);
    };
  }

  try {
    const docRef = doc(db, COLLECTIONS.AD_KILL_SWITCHES, 'current');
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onData(docSnap.data() as AdKillSwitches);
        } else {
          onData({ ...testKillSwitches });
        }
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

export async function updateAdKillSwitches(
  input: UpdateAdKillSwitchesInput,
  actor: { uid: string; email: string },
): Promise<void> {
  const validated = UpdateAdKillSwitchesSchema.parse(input);
  const now = new Date().toISOString();

  if (isOfflineMode) {
    testKillSwitches = {
      ...testKillSwitches,
      globalAdsDisabled: validated.globalAdsDisabled ?? testKillSwitches.globalAdsDisabled,
      networks: { ...testKillSwitches.networks, ...(validated.networks || {}) },
      apps: { ...testKillSwitches.apps, ...(validated.apps || {}) },
      formats: { ...testKillSwitches.formats, ...(validated.formats || {}) },
      placements: { ...testKillSwitches.placements, ...(validated.placements || {}) },
      customAdsDisabled: validated.customAdsDisabled ?? testKillSwitches.customAdsDisabled,
      updatedAt: now,
      updatedBy: actor.email || 'admin',
    };
    for (const listener of offlineKillSwitchListeners) {
      listener({ ...testKillSwitches });
    }
  } else {
    const docRef = doc(db, COLLECTIONS.AD_KILL_SWITCHES, 'current');
    await setDoc(docRef, { ...validated, updatedAt: serverTimestamp() }, { merge: true });
  }

  await recordAuditLog({
    action: 'ads.kill_switch_update',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'adKillSwitches',
    resourceId: 'current',
    changes: { killSwitches: { before: null, after: validated } },
  });
}

// ============================================================
// 11. Effective Config Preview Simulator
// ============================================================
export async function fetchEffectiveAdConfig(appId: string): Promise<EffectiveAdConfigResponse> {
  const isGlobalKilled = Boolean(testKillSwitches.globalAdsDisabled);
  const isAppKilled = Boolean(testKillSwitches.apps[appId]);
  const appCfg = testApps.find((a) => a.appId === appId);
  const masterOn = Boolean(appCfg?.masterEnabled ?? true);
  const overallEnabled = !isGlobalKilled && !isAppKilled && masterOn;

  const supportedFormats: AdFormat[] = [
    'banner',
    'native',
    'interstitial',
    'rewarded',
    'app_open',
    'rewarded_interstitial',
  ];

  const resolvedFormats: Record<AdFormat, any> = {} as any;
  for (const fmt of supportedFormats) {
    const isFmtKilled = Boolean(testKillSwitches.formats[fmt]);
    const isFmtEnabled = Boolean(appCfg?.formats?.[fmt]?.enabled ?? true);
    const enabled = overallEnabled && !isFmtKilled && isFmtEnabled;

    const rotPolicy = testRotationPolicies.find((r) => r.appId === appId && r.format === fmt);
    const chain: any[] = [];
    if (enabled && rotPolicy) {
      for (const tier of rotPolicy.tiers) {
        if (!tier.enabled) continue;
        const netDoc = testNetworks.find((n) => n.id === tier.networkId);
        if (!netDoc || !netDoc.enabled || testKillSwitches.networks[tier.networkId]) continue;
        const matchedUnit = testUnits.find(
          (u) => u.appId === appId && u.networkId === tier.networkId && u.format === fmt && u.enabled,
        );
        const adUnitId = matchedUnit?.adUnitId || (tier.networkId === 'custom_ads' ? 'custom_inhouse' : '');
        if (adUnitId) {
          chain.push({
            networkId: tier.networkId,
            priority: tier.priority,
            adUnitId,
            timeoutMs: tier.timeoutMs || 5000,
          });
        }
      }
    }

    resolvedFormats[fmt] = {
      enabled,
      format: fmt,
      refreshIntervalSeconds: fmt === 'banner' ? 60 : undefined,
      frequency: { minIntervalSeconds: 30, cooldownSeconds: 45, sessionCap: 4, dailyCap: 12 },
      mediationChain: chain,
      customAdFallback: {
        campaignId: 'camp_cross_optilens',
        title: 'OptiLens AI Camera',
        description: 'Photo enhancement tools',
        ctaText: 'Install Free',
        destinationUrl: 'https://webappypie.com/apps/optilens',
      },
    };
  }

  return {
    appId,
    enabled: overallEnabled,
    testMode: false,
    version: 'sim_hash_' + Date.now().toString(36),
    safety: {
      maxAdRating: 'PG',
      blockedCategories: [...ADS_CONFIG.DEFAULT_BLOCKED_CATEGORIES],
    },
    formats: resolvedFormats,
    placements: {
      home_bottom_banner: {
        placementKey: 'home_bottom_banner',
        format: 'banner',
        enabled: overallEnabled,
      },
    },
    disclaimer: 'Effective preview evaluated using production hierarchy.',
    timestamp: new Date().toISOString(),
  };
}
