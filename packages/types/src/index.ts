/**
 * @wapcentral/types
 *
 * Shared TypeScript types and interfaces for the WAPCentral platform.
 * These types are used by the dashboard, backend services, and shared packages.
 * API contracts are designed to be platform-agnostic for future mobile SDK support.
 */

// ============================================================
// Common / Utility Types
// ============================================================

export type Platform = 'android' | 'ios' | 'web';
export type Environment = 'development' | 'staging' | 'production';
export type Status = 'active' | 'inactive' | 'archived';
export type Timestamp = string; // ISO 8601 format

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId: string;
  timestamp: Timestamp;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================
// App Registry Types
// ============================================================

export interface App {
  id: string;
  name: string;
  packageId: string; // e.g. "com.webappypie.appname"
  bundleId?: string; // iOS bundle ID
  platform: Platform;
  version: string;
  environment: Environment;
  firebaseProjectId?: string;
  storeUrl?: {
    android?: string;
    ios?: string;
  };
  adConfig?: AppAdConfig;
  enabledModules: AppModule[];
  status: Status;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AppModule = 'ai' | 'ads' | 'promotion' | 'analytics' | 'health';

export interface AppAdConfig {
  admob?: AdMobConfig;
  meta?: MetaAdConfig;
  applovin?: AppLovinConfig;
  wapads?: WapAdsConfig;
}

// ============================================================
// Ad Network Config Types
// ============================================================

export interface AdMobConfig {
  appId: string; // Public AdMob App ID
  adUnits: AdUnit[];
  enabled: boolean;
}

export interface MetaAdConfig {
  appId: string; // Meta App ID (public)
  placements: AdPlacement[];
  enabled: boolean;
}

export interface AppLovinConfig {
  sdkKey: string; // AppLovin SDK key (public identifier)
  adUnits: AdUnit[];
  enabled: boolean;
}

export interface WapAdsConfig {
  appKey: string; // App key for promotion-api auth
  enabled: boolean;
}

export interface AdUnit {
  id: string;
  name: string;
  type: AdUnitType;
  platform: Platform;
  adUnitId: string; // Provider-specific unit ID
}

export interface AdPlacement {
  id: string;
  name: string;
  type: AdUnitType;
  placementId: string;
}

export type AdUnitType = 'banner' | 'interstitial' | 'rewarded' | 'native' | 'rewarded_interstitial';

// ============================================================
// AI Provider Types
// ============================================================

export type AiProviderType = 'openai' | 'gemini' | 'anthropic' | 'self_hosted';

export interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
  enabled: boolean;
  models: AiModel[];
  healthStatus?: HealthStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AiModel {
  id: string;
  providerId: string;
  modelId: string; // e.g. "gpt-4o", "gemini-1.5-pro"
  name: string;
  enabled: boolean;
  inputCostPer1kTokens?: number; // USD estimate
  outputCostPer1kTokens?: number; // USD estimate
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface AiPolicy {
  id: string;
  appId: string;
  feature: string;
  primaryProviderId: string;
  primaryModelId: string;
  fallbackChain: FallbackEntry[];
  quotas: QuotaConfig;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FallbackEntry {
  providerId: string;
  modelId: string;
  priority: number;
}

export interface QuotaConfig {
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  perUserDailyRequestLimit?: number;
  maxInputTokensPerRequest?: number;
  maxOutputTokensPerRequest?: number;
}

// ============================================================
// AI Gateway Types (Platform-agnostic API contract)
// ============================================================

export interface GatewayRequest {
  appId: string;
  version: string;
  environment: Environment;
  feature: string;
  modelPreference?: string;
  payload: GatewayPayload;
  requestId: string;
}

export interface GatewayPayload {
  type: 'generate' | 'analyze_image' | 'embed';
  prompt?: string;
  imageData?: string; // base64
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GatewayResponse {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  usage?: TokenUsage;
  costEstimate?: CostEstimate;
  latencyMs: number;
  cached: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  amountUsd: number;
  isEstimate: true; // Always true — never exact billing
  currency: 'USD';
}

// ============================================================
// Promotion / Campaign Types (Platform-agnostic API contract)
// ============================================================

export type CampaignStatus = 'draft' | 'published' | 'paused' | 'ended';
export type LayoutVariant = 'banner' | 'interstitial' | 'native';

export interface Campaign {
  id: string;
  name: string;
  promotedAppId: string;
  targetAppIds: string[];
  title: string;
  description: string;
  ctaText: string;
  storeUrl: string;
  imageUrl?: string;
  animationUrl?: string; // Lottie JSON URL
  layoutVariant: LayoutVariant;
  scheduleStart?: Timestamp;
  scheduleEnd?: Timestamp;
  priority: number; // Higher = shown first
  enabled: boolean;
  frequencyCap?: FrequencyCap;
  targetingRules?: TargetingRules;
  status: CampaignStatus;
  analytics?: CampaignAnalytics;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FrequencyCap {
  maxImpressions: number;
  periodHours: number; // Per device per period
}

export interface TargetingRules {
  minAppVersion?: string;
  maxAppVersion?: string;
  platforms?: Platform[];
  environments?: Environment[];
}

export interface CampaignAnalytics {
  impressions: number;
  clicks: number;
  ctr: number; // clicks / impressions
}

/**
 * Promotion delivery payload — the response from promotion-api to mobile apps.
 * This is the platform-agnostic contract. HMAC-signed by backend.
 */
export interface PromotionPayload {
  schemaVersion: 1;
  enabled: boolean;
  campaignId: string;
  title: string;
  description: string;
  imageUrl?: string;
  animationUrl?: string;
  ctaText: string;
  storeUrl: string;
  layoutVariant: LayoutVariant;
  expiresAt: Timestamp;
  cacheTtlSeconds: number;
  signature: string; // HMAC-SHA256 signature (backend validates)
}

/**
 * Response when no active campaign is available
 */
export interface EmptyPromotionPayload {
  schemaVersion: 1;
  enabled: false;
  cacheTtlSeconds: number;
  signature: string;
}

// ============================================================
// Feature Flags Types
// ============================================================

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  value: boolean | string | number;
  type: 'boolean' | 'string' | 'number';
  scope: 'global' | 'per_app' | 'per_environment';
  appId?: string;
  environment?: Environment;
  enabled: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================
// Health / Monitoring Types
// ============================================================

export type HealthStatusLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthStatus {
  status: HealthStatusLevel;
  latencyMs?: number;
  lastCheckedAt: Timestamp;
  error?: string;
}

export interface ServiceHealth {
  serviceId: string;
  serviceName: string;
  status: HealthStatusLevel;
  latencyMs?: number;
  errorRate?: number;
  lastCheckedAt: Timestamp;
}

// ============================================================
// RBAC / Auth Types
// ============================================================

export type UserRole = 'viewer' | 'editor' | 'admin' | 'super_admin';

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  mfaEnabled: boolean;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

// ============================================================
// Audit Log Types
// ============================================================

export type AuditAction =
  | 'app.create'
  | 'app.update'
  | 'app.archive'
  | 'provider.create'
  | 'provider.update'
  | 'provider.disable'
  | 'secret.write'
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.publish'
  | 'campaign.pause'
  | 'flag.update'
  | 'role.assign'
  | 'gateway.kill_switch';

export interface AuditLog {
  id: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
  ipAddress?: string;
}

// ============================================================
// Usage / Cost Types
// ============================================================

export interface UsageEvent {
  id: string;
  appId: string;
  providerId: string;
  modelId: string;
  feature: string;
  requestId: string;
  inputTokens?: number;
  outputTokens?: number;
  costEstimateUsd?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: Timestamp;
}

export interface DailyUsage {
  id: string; // Format: "appId_providerId_YYYY-MM-DD"
  appId: string;
  providerId: string;
  date: string; // YYYY-MM-DD
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  costEstimateUsd: number;
  errorCount: number;
  avgLatencyMs: number;
}
