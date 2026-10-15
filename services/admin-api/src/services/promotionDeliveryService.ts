import crypto from 'node:crypto';
import { COLLECTIONS } from '@wapcentral/config';
import { GoogleAuth } from 'google-auth-library';
import { getFirestoreDb } from './firestore.js';

/**
 * Promotion delivery for mobile apps (wap_promo_sdk), served by the Platform
 * gateway at `/api/platform/v1/promotion` and `/api/platform/v1/analytics/*`.
 *
 * Campaigns are the ones the dashboard writes to Firestore `campaigns`.
 * Payloads are signed RS256 (RSASSA-PKCS1-v1_5 / SHA-256) by a Cloud KMS
 * asymmetric key over the canonical form wap_promo_sdk's CryptoValidator
 * rebuilds on device. Apps verify with the public key only, so no signing
 * secret ever ships in an app.
 */

export interface PromotionMatchParams {
  appId: string;
  version?: string | undefined;
  env?: string | undefined;
  platform?: string | undefined;
}

export interface StoredCampaign {
  id: string;
  title?: string | undefined;
  description?: string | undefined;
  ctaText?: string | undefined;
  storeUrl?: string | undefined;
  sponsorLabel?: string | undefined;
  imageUrl?: string | undefined;
  animationUrl?: string | undefined;
  layoutVariant?: string | undefined;
  targetAppIds: string[];
  priority: number;
  enabled: boolean;
  status: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  frequencyCap?: { maxImpressions: number; periodHours: number };
  targetingRules?: {
    minAppVersion?: string;
    maxAppVersion?: string;
    platforms?: string[];
    environments?: string[];
  };
}

export type PromotionPayload = Record<string, unknown> & { signature: string };

/** Cache lifetimes, matching promotion-api (`@wapcentral/config` PROMOTION). */
export const PROMOTION_CACHE_TTL_SECONDS = 21600; // 6h with a campaign
export const PROMOTION_EMPTY_TTL_SECONDS = 3600; // 1h when nothing is eligible

/** Campaigns are re-read from Firestore at most this often per instance. */
const CAMPAIGN_CACHE_MS = 30_000;
let campaignCache: { at: number; campaigns: StoredCampaign[] } | null = null;

export function resetPromotionCacheForTest(): void {
  campaignCache = null;
}

// ---------------------------------------------------------------------------
// Signing (must match wap_promo_sdk CryptoValidator.verifyRs256Signature)
// ---------------------------------------------------------------------------

/** Signs a SHA-256 digest with an RSA PKCS#1 v1.5 key; returns the raw signature. */
export interface PromotionSigner {
  keyId: string;
  signDigest: (sha256Digest: Buffer) => Promise<Buffer>;
}

/**
 * Cloud KMS signer for `PROMOTION_KMS_KEY_VERSION`
 * (`projects/../locations/../keyRings/../cryptoKeys/../cryptoKeyVersions/N`,
 * algorithm RSA_SIGN_PKCS1_2048_SHA256 or larger). The private key never
 * leaves KMS; the service account needs roles/cloudkms.signer on the key.
 */
function kmsSigner(keyVersion: string): PromotionSigner {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloudkms'] });
  const match = /cryptoKeys\/([^/]+)\/cryptoKeyVersions\/([^/]+)$/.exec(keyVersion);
  return {
    // Public identifier apps use to pick the matching public key.
    keyId: match ? `${match[1]}-v${match[2]}` : keyVersion,
    signDigest: async (digest) => {
      const client = await auth.getClient();
      const res = await client.request<{ signature?: string }>({
        url: `https://cloudkms.googleapis.com/v1/${keyVersion}:asymmetricSign`,
        method: 'POST',
        data: { digest: { sha256: digest.toString('base64') } },
      });
      if (!res.data.signature) throw new Error('Cloud KMS returned no signature');
      return Buffer.from(res.data.signature, 'base64');
    },
  };
}

let signerOverride: PromotionSigner | null | undefined;
let cachedKmsSigner: { version: string; signer: PromotionSigner } | null = null;

export function setPromotionSignerForTest(signer: PromotionSigner | null | undefined): void {
  signerOverride = signer;
  signatureCache.clear();
}

/** The configured signer, or null when promotion signing is not set up. */
export function getPromotionSigner(): PromotionSigner | null {
  if (signerOverride !== undefined) return signerOverride;
  const version = process.env['PROMOTION_KMS_KEY_VERSION']?.trim();
  if (!version) return null;
  if (cachedKmsSigner?.version !== version) {
    cachedKmsSigner = { version, signer: kmsSigner(version) };
  }
  return cachedKmsSigner.signer;
}

/**
 * Renders a JSON value the way Dart's `toString()` does after `jsonDecode`,
 * because the SDK canonicalizes `'$key:${value.toString()}'`.
 */
function dartString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(dartString).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${dartString(v)}`,
    );
    return `{${entries.join(', ')}}`;
  }
  return String(value);
}

export function canonicalPromotionString(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter((k) => k !== 'signature' && payload[k] !== null && payload[k] !== undefined)
    .sort()
    .map((k) => `${k}:${dartString(payload[k])}`)
    .join('|');
}

/** Payloads repeat until a campaign changes, so KMS signs each one once per instance. */
const signatureCache = new Map<string, string>();
const SIGNATURE_CACHE_MAX = 256;

/** Adds `signatureAlg`, `keyId` and the base64url RS256 `signature`. */
export async function signPromotionPayload(
  payload: Record<string, unknown>,
  signer: PromotionSigner,
): Promise<PromotionPayload> {
  const unsigned = { ...payload, signatureAlg: 'RS256', keyId: signer.keyId };
  const canonical = canonicalPromotionString(unsigned);
  let signature = signatureCache.get(canonical);
  if (!signature) {
    const digest = crypto.createHash('sha256').update(canonical, 'utf8').digest();
    signature = (await signer.signDigest(digest)).toString('base64url');
    if (signatureCache.size >= SIGNATURE_CACHE_MAX) signatureCache.clear();
    signatureCache.set(canonical, signature);
  }
  return { ...unsigned, signature };
}

// ---------------------------------------------------------------------------
// Campaign loading and matching
// ---------------------------------------------------------------------------

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Firestore Timestamp, Date or ISO string → ISO string. */
function isoTime(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return Number.isNaN(Date.parse(value)) ? undefined : value;
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  return undefined;
}

function strList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

/** Normalizes a dashboard campaign document (same defaults as the dashboard). */
export function toStoredCampaign(id: string, data: Record<string, any>): StoredCampaign {
  const cap = data['frequencyCap'];
  const maxImpressions = num(cap?.maxImpressions);
  const periodHours = num(cap?.periodHours);
  const rules = data['targetingRules'];

  return {
    id,
    title: str(data['title']),
    description: str(data['description']),
    ctaText: str(data['ctaText']),
    storeUrl: str(data['storeUrl']),
    sponsorLabel: str(data['sponsorLabel']),
    imageUrl: str(data['imageUrl']),
    animationUrl: str(data['animationUrl']),
    layoutVariant: str(data['layoutVariant']),
    targetAppIds: strList(data['targetAppIds']) ?? [],
    priority: num(data['priority']) ?? 50,
    // Dashboard defaults: enabled unless set false; status 'draft' until published.
    enabled: data['enabled'] !== false,
    status: str(data['status']) ?? 'draft',
    ...(isoTime(data['scheduleStart']) ? { scheduleStart: isoTime(data['scheduleStart'])! } : {}),
    ...(isoTime(data['scheduleEnd']) ? { scheduleEnd: isoTime(data['scheduleEnd'])! } : {}),
    ...(maxImpressions && periodHours
      ? { frequencyCap: { maxImpressions: Math.trunc(maxImpressions), periodHours: Math.trunc(periodHours) } }
      : {}),
    ...(rules && typeof rules === 'object'
      ? {
          targetingRules: {
            ...(str(rules.minAppVersion) ? { minAppVersion: str(rules.minAppVersion)! } : {}),
            ...(str(rules.maxAppVersion) ? { maxAppVersion: str(rules.maxAppVersion)! } : {}),
            ...(strList(rules.platforms) ? { platforms: strList(rules.platforms)! } : {}),
            ...(strList(rules.environments) ? { environments: strList(rules.environments)! } : {}),
          },
        }
      : {}),
  };
}

export async function loadCampaigns(): Promise<StoredCampaign[]> {
  const now = Date.now();
  if (campaignCache && now - campaignCache.at < CAMPAIGN_CACHE_MS) {
    return campaignCache.campaigns;
  }
  const snap = await getFirestoreDb().collection(COLLECTIONS.CAMPAIGNS).get();
  const campaigns = snap.docs.map((d) => toStoredCampaign(d.id, d.data() ?? {}));
  campaignCache = { at: now, campaigns };
  return campaigns;
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    (v.replace(/^v/i, '').split('-')[0] ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Whether a campaign may be served to this caller right now. */
export function isCampaignEligible(
  camp: StoredCampaign,
  params: PromotionMatchParams,
  nowMs = Date.now(),
): boolean {
  if (camp.status !== 'published' || !camp.enabled) return false;
  if (!camp.targetAppIds.includes(params.appId) && !camp.targetAppIds.includes('*')) return false;
  if (!camp.title || !camp.storeUrl) return false;

  if (camp.scheduleStart && nowMs < Date.parse(camp.scheduleStart)) return false;
  if (camp.scheduleEnd && nowMs > Date.parse(camp.scheduleEnd)) return false;

  const rules = camp.targetingRules;
  if (rules?.platforms?.length && params.platform && !rules.platforms.includes(params.platform)) return false;
  if (rules?.environments?.length && params.env && !rules.environments.includes(params.env)) return false;
  if (params.version) {
    if (rules?.minAppVersion && compareSemver(params.version, rules.minAppVersion) < 0) return false;
    if (rules?.maxAppVersion && compareSemver(params.version, rules.maxAppVersion) > 0) return false;
  }
  return true;
}

/** Highest-priority eligible campaign (ties: lowest id, for stable delivery). */
export async function matchCampaignForApp(
  params: PromotionMatchParams,
): Promise<StoredCampaign | null> {
  const eligible = (await loadCampaigns()).filter((c) => isCampaignEligible(c, params));
  eligible.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return eligible[0] ?? null;
}

/** Signed wap_promo_sdk payload: the campaign, or `enabled: false` when none. */
export async function buildPromotionPayload(
  camp: StoredCampaign | null,
  signer: PromotionSigner,
  nowMs = Date.now(),
): Promise<{ payload: PromotionPayload; cacheTtlSeconds: number }> {
  if (!camp) {
    const base = { schemaVersion: 1, enabled: false, cacheTtlSeconds: PROMOTION_EMPTY_TTL_SECONDS };
    return {
      payload: await signPromotionPayload(base, signer),
      cacheTtlSeconds: PROMOTION_EMPTY_TTL_SECONDS,
    };
  }

  // Refresh no later than the campaign's end.
  let ttl = PROMOTION_CACHE_TTL_SECONDS;
  if (camp.scheduleEnd) {
    const remaining = Math.floor((Date.parse(camp.scheduleEnd) - nowMs) / 1000);
    ttl = Math.max(300, Math.min(ttl, remaining));
  }

  const base: Record<string, unknown> = {
    schemaVersion: 1,
    enabled: true,
    campaignId: camp.id,
    title: camp.title,
    ...(camp.description ? { description: camp.description } : {}),
    ...(camp.imageUrl ? { imageUrl: camp.imageUrl } : {}),
    ...(camp.animationUrl ? { animationUrl: camp.animationUrl } : {}),
    ...(camp.ctaText ? { ctaText: camp.ctaText } : {}),
    storeUrl: camp.storeUrl,
    ...(camp.sponsorLabel ? { sponsorLabel: camp.sponsorLabel } : {}),
    layoutVariant: camp.layoutVariant ?? 'sponsored',
    ...(camp.scheduleEnd ? { expiresAt: camp.scheduleEnd } : {}),
    cacheTtlSeconds: ttl,
    ...(camp.frequencyCap
      ? {
          frequencyCap: {
            maxImpressions: camp.frequencyCap.maxImpressions,
            periodHours: camp.frequencyCap.periodHours,
          },
        }
      : {}),
  };
  return { payload: await signPromotionPayload(base, signer), cacheTtlSeconds: ttl };
}

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

/**
 * Records a genuine impression/click in Firestore `promotionEvents` (the
 * source the dashboard's campaign analytics aggregate). Only campaigns that
 * target the caller app are accepted, so apps cannot skew other apps' data.
 */
export async function recordPromotionEvent(input: {
  eventType: 'impression' | 'click';
  campaignId: string;
  appId: string;
  deviceId?: string | undefined;
}): Promise<{ recorded: boolean; eventId?: string }> {
  const campaigns = await loadCampaigns();
  const camp = campaigns.find((c) => c.id === input.campaignId);
  if (!camp || (!camp.targetAppIds.includes(input.appId) && !camp.targetAppIds.includes('*'))) {
    return { recorded: false };
  }

  const ref = getFirestoreDb().collection(COLLECTIONS.PROMOTION_EVENTS).doc();
  await ref.set({
    id: ref.id,
    eventType: input.eventType,
    campaignId: input.campaignId,
    appId: input.appId,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    source: 'wap_promo_sdk',
    timestamp: new Date().toISOString(),
  });
  return { recorded: true, eventId: ref.id };
}
