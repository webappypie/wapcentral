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

export type AdNetworkType = 'admob' | 'meta' | 'applovin' | 'wapads';

export interface AppAdConfig {
  admob?: AdMobConfig | undefined;
  meta?: MetaAdConfig | undefined;
  applovin?: AppLovinConfig | undefined;
  wapads?: WapAdsConfig | undefined;
  mediationPriority?: AdNetworkType[] | undefined;
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

export type AdUnitType =
  'banner' | 'interstitial' | 'rewarded' | 'native' | 'rewarded_interstitial';

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
  baseUrl?: string;
  description?: string;
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
  inputCostPer1kTokens?: number | undefined; // USD estimate
  outputCostPer1kTokens?: number | undefined; // USD estimate
  maxInputTokens?: number | undefined;
  maxOutputTokens?: number | undefined;
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
  dailyRequestLimit?: number | undefined;
  monthlyRequestLimit?: number | undefined;
  dailyTokenLimit?: number | undefined;
  monthlyTokenLimit?: number | undefined;
  perUserDailyRequestLimit?: number | undefined;
  maxInputTokensPerRequest?: number | undefined;
  maxOutputTokensPerRequest?: number | undefined;
}

// ============================================================
// AI Gateway Types (Platform-agnostic API contract)
// ============================================================

export interface GatewayRequest {
  appId: string;
  version: string;
  environment: Environment;
  feature: string;
  modelPreference?: string | undefined;
  payload: GatewayPayload;
  requestId: string;
}

export interface GatewayPayload {
  type: 'generate' | 'analyze_image' | 'embed';
  prompt?: string | undefined;
  imageData?: string | undefined; // base64
  messages?: ChatMessage[] | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
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
  imageUrl?: string | undefined;
  animationUrl?: string | undefined; // Lottie JSON URL
  layoutVariant: LayoutVariant;
  scheduleStart?: Timestamp | undefined;
  scheduleEnd?: Timestamp | undefined;
  priority: number; // Higher = shown first
  enabled: boolean;
  frequencyCap?: FrequencyCap | undefined;
  targetingRules?: TargetingRules | undefined;
  status: CampaignStatus;
  analytics?: CampaignAnalytics | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FrequencyCap {
  maxImpressions: number;
  periodHours: number; // Per device per period
}

export interface TargetingRules {
  minAppVersion?: string | undefined;
  maxAppVersion?: string | undefined;
  platforms?: Platform[] | undefined;
  environments?: Environment[] | undefined;
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
  enabled: true;
  campaignId: string;
  title: string;
  description: string;
  imageUrl?: string | undefined;
  animationUrl?: string | undefined;
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

export type PromotionDeliveryResponse = PromotionPayload | EmptyPromotionPayload;

export type PromotionEventType = 'impression' | 'click';

export interface PromotionEvent {
  id: string;
  eventType: PromotionEventType;
  campaignId: string;
  appId: string;
  deviceId?: string | undefined;
  timestamp: Timestamp;
  metadata?: Record<string, unknown> | undefined;
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
// Health / Monitoring Types (Phase 11)
// ============================================================

export type HealthStatusLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type ServiceCategory = 'api' | 'infrastructure' | 'ai_provider' | 'ai_server' | 'worker';

export interface HealthStatus {
  status: HealthStatusLevel;
  latencyMs?: number | undefined;
  lastCheckedAt: Timestamp;
  error?: string | undefined;
}

export interface ServiceHealth {
  serviceId: string;
  serviceName: string;
  status: HealthStatusLevel;
  latencyMs?: number | undefined;
  errorRate?: number | undefined;
  lastCheckedAt: Timestamp;
}

export interface DetailedServiceHealth {
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  status: HealthStatusLevel;
  latencyMs: number;
  errorRatePct: number;
  uptimePct30d: number;
  consecutiveFailures: number;
  lastCheckedAt: Timestamp;
  endpoint?: string | undefined;
  region?: string | undefined;
  details?: Record<string, unknown> | undefined;
  errorMessage?: string | undefined;
}

export interface AiServerMetrics {
  serverId: string;
  serverName: string;
  status: HealthStatusLevel;
  cpuUsagePct: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  gpuUsagePct: number;
  vramUsedMb: number;
  vramTotalMb: number;
  queueDepth: number;
  activeStreams: number;
  avgLatencyMs: number;
  temperatureC: number;
  modelLoaded: string;
  reportedAt: Timestamp;
}

export type InfrastructureAlertMetric =
  | 'latency_ms'
  | 'error_rate_pct'
  | 'consecutive_failures'
  | 'gpu_usage_pct'
  | 'vram_usage_pct'
  | 'queue_depth';

export type InfrastructureAlertSeverity = 'warning' | 'critical';

export interface InfrastructureAlertRule {
  id: string;
  name: string;
  targetServiceId: string; // 'all' or specific serviceId
  metric: InfrastructureAlertMetric;
  threshold: number;
  severity: InfrastructureAlertSeverity;
  enabled: boolean;
  notifyEmails: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InfrastructureAlertTrigger {
  id: string;
  ruleId: string;
  ruleName: string;
  targetServiceId: string;
  targetServiceName: string;
  severity: InfrastructureAlertSeverity;
  metric: InfrastructureAlertMetric;
  currentValue: number;
  threshold: number;
  message: string;
  triggeredAt: Timestamp;
}

export interface PlatformHealthOverview {
  overallStatus: HealthStatusLevel;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  totalServices: number;
  avgLatencyMs: number;
  maxErrorRatePct: number;
  activeAlertsCount: number;
  lastCheckedAt: Timestamp;
}

// ============================================================
// RBAC / Auth Types
// ============================================================

export type UserRole = 'viewer' | 'editor' | 'admin' | 'super_admin';
export type AdminRole = UserRole;

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
  | 'provider.delete'
  | 'policy.create'
  | 'policy.update'
  | 'policy.delete'
  | 'policy.toggle'
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
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  costEstimateUsd?: number | undefined;
  latencyMs: number;
  success: boolean;
  error?: string | undefined;
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

// ============================================================
// Cost & Quota Alerts Types
// ============================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertMetricType =
  'daily_cost_usd' | 'monthly_cost_usd' | 'daily_tokens' | 'monthly_tokens' | 'error_rate_pct';

export interface CostAlertRule {
  id: string;
  name: string;
  appId?: string | undefined; // Specific app, or undefined for global
  metric: AlertMetricType;
  threshold: number; // USD amount, token count, or percentage
  enabled: boolean;
  notifyEmails: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CostAlertTrigger {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: AlertMetricType;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  appId?: string | undefined;
  triggeredAt: Timestamp;
}

// ============================================================
// Data Retention Policy Types
// ============================================================

export interface DataRetentionPolicy {
  usageEventsTtlDays: number; // Default: 90 days
  promotionEventsTtlDays: number; // Default: 90 days
  auditLogsTtlDays: number; // Default: 365 days
  lastPrunedAt?: Timestamp | undefined;
  prunedCount?: number | undefined;
}

// ============================================================
// Analytics Aggregations & Performance Types
// ============================================================

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  promotedAppId: string;
  layoutVariant: LayoutVariant;
  impressions: number;
  clicks: number;
  ctr: number; // Percentage (e.g. 3.45%)
  status: CampaignStatus;
}

export interface DailyUsageTrend {
  date: string; // YYYY-MM-DD
  requests: number;
  tokens: number;
  costEstimateUsd: number;
}

export interface UsageAggregationSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostEstimateUsd: number;
  totalErrors: number;
  errorRatePct: number;
  avgLatencyMs: number;
  byProvider: Record<
    string,
    {
      requests: number;
      tokens: number;
      costEstimateUsd: number;
      errorCount: number;
      avgLatencyMs: number;
    }
  >;
  byApp: Record<
    string,
    {
      requests: number;
      tokens: number;
      costEstimateUsd: number;
    }
  >;
  byFeature: Record<
    string,
    {
      requests: number;
      tokens: number;
      costEstimateUsd: number;
    }
  >;
  dailyTrends: DailyUsageTrend[];
}
