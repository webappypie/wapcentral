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

export type PlatformServiceType =
  | 'ai'
  | 'image'
  | 'ocr'
  | 'files'
  | 'promotion'
  | 'ads'
  | 'notifications';

export interface ServiceQuotaConfig {
  dailyRequests?: number;
  monthlyRequests?: number;
  rateLimitRpm?: number;
}

export interface App {
  id: string;
  name: string;
  packageId: string; // e.g. "com.webappypie.appname"
  bundleId?: string; // iOS bundle ID
  platform: Platform;
  version: string;
  environment: Environment;
  firebaseProjectId?: string;
  firebaseAndroidAppId?: string; // Firebase Android App ID (e.g. 1:123456789:android:abc)
  firebaseIosAppId?: string; // Firebase iOS App ID (e.g. 1:123456789:ios:abc)
  fcmSenderId?: string; // FCM Sender ID (project number)
  storeUrl?: {
    android?: string;
    ios?: string;
  };
  adConfig?: AppAdConfig;
  simpleAdsConfig?: AppSimpleAdsConfig;
  enabledModules: AppModule[];
  allowedServices?: PlatformServiceType[];
  appKey?: string;
  sdkVersion?: string;
  serviceQuotas?: Partial<Record<PlatformServiceType, ServiceQuotaConfig>>;
  killSwitch?: boolean;
  status: Status;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AppModule =
  | 'ai'
  | 'ads'
  | 'promotion'
  | 'analytics'
  | 'health'
  | 'ocr'
  | 'image_intelligence'
  | 'file_intelligence'
  | 'notifications';

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
  | 'banner'
  | 'interstitial'
  | 'rewarded'
  | 'native'
  | 'rewarded_interstitial'
  | 'app_open';

export type AdFormat =
  | 'banner'
  | 'native'
  | 'interstitial'
  | 'rewarded'
  | 'app_open'
  | 'rewarded_interstitial';

export type AdEnvironment = 'testing' | 'production';

export type AdStrategy = 'automatic' | 'single_source';

export type DemandSourceId =
  | 'applovin'
  | 'admob'
  | 'meta'
  | 'inmobi'
  | 'unity'
  | 'wapCustomAds';

export type DemandSourceStatus =
  | 'configured'
  | 'not_configured'
  | 'approval_required'
  | 'requires_app_update';

export type AdNetworkId =
  | 'applovin'
  | 'admob'
  | 'meta'
  | 'inmobi'
  | 'unity'
  | 'custom_ads'
  | 'wapCustomAds'
  | (string & {});

// ============================================================
// Simplified Per-App Ads Configuration (stored in apps collection)
// ============================================================

export interface AppAdsNetworkConfig {
  enabled: boolean;
  // Production IDs (only used when environment = 'production')
  admob?: {
    appId?: string;
    bannerId?: string;
    nativeId?: string;
    interstitialId?: string;
    rewardedId?: string;
    appOpenId?: string;
    rewardedInterstitialId?: string;
  };
  meta?: {
    placementIds?: Record<string, string>; // format -> placementId
  };
  applovin?: {
    sdkKey?: string;
    appId?: string;
    placementIds?: Record<string, string>; // format -> placementId
  };
  inmobi?: {
    accountId?: string;
    placementIds?: Record<string, string>; // format -> placementId
  };
  unity?: {
    gameId?: string;
    placementIds?: Record<string, string>; // format -> placementId
  };
  wapCustomAds?: {
    campaignEnabled?: boolean;
  };
}

export interface AppAdsFormatConfig {
  banner: boolean;
  native: boolean;
  interstitial: boolean;
  rewarded: boolean;
  appOpen: boolean;
  rewardedInterstitial: boolean;
}

export interface AppSimpleAdsConfig {
  adsEnabled: boolean;
  environment: AdEnvironment; // 'testing' | 'production'
  strategy?: AdStrategy; // 'automatic' (AppLovin MAX mediation) | 'single_source' (one source via MAX)
  singleSourceNetwork?: DemandSourceId;
  bundledAdapters?: {
    applovin?: boolean; // AppLovin MAX core SDK
    admob?: boolean; // Google AdMob MAX adapter
    meta?: boolean; // Meta Audience Network MAX adapter
    inmobi?: boolean; // InMobi MAX adapter
    unity?: boolean; // Unity Ads MAX adapter
    wapCustomAds?: boolean; // WebAppyPie custom ads engine
  };
  enabledFormats: AppAdsFormatConfig;
  networks: {
    applovin: boolean;
    admob: boolean;
    meta: boolean;
    inmobi?: boolean;
    unity?: boolean;
    wapCustomAds: boolean;
  };
  networkConfig?: AppAdsNetworkConfig;
}



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
  secretName?: string | undefined;
  configured?: boolean | undefined;
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

export interface VerifiedModelSpec {
  modelId: string;
  name: string;
  providerType: AiProviderType;
  inputCostPer1M: number | null; // USD per 1M tokens, null = Not available
  outputCostPer1M: number | null; // USD per 1M tokens, null = Not available
  contextWindow: number | null; // Max input context tokens, null = Not available
  maxOutputTokens: number | null; // Max output generation tokens, null = Not available
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsEmbeddings: boolean;
  source: string; // Official provider documentation citation
  lastVerifiedDate: string; // YYYY-MM-DD
  isRetired?: boolean | undefined;
}

export interface ModelCatalogItem {
  id: string; // Unique identifier (e.g. providerId_modelId or modelId)
  modelId: string;
  name: string;
  providerType: AiProviderType;
  providerId?: string | undefined;
  providerName?: string | undefined;
  providerEnabled?: boolean | undefined;
  modelEnabled?: boolean | undefined;
  inputCostPer1M: number | null;
  outputCostPer1M: number | null;
  inputCostPer1k: number | null;
  outputCostPer1k: number | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsEmbeddings: boolean;
  source: string;
  lastVerifiedDate: string;
  isConfiguredInRuntime: boolean;
  status: 'available' | 'disabled' | 'unconfigured' | 'deprecated';
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // consecutive failures before tripping open (e.g. 3)
  timeoutMs: number; // timeout per provider attempt in ms (e.g. 10000)
  recoveryTimeMs: number; // cooldown before testing recovery in half-open state (e.g. 30000)
}

export type CircuitBreakerStatus = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerSnapshot {
  status: CircuitBreakerStatus;
  failureCount: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Timestamp | undefined;
  lastFailureReason?: string | undefined;
  openedAt?: Timestamp | undefined;
}

export interface PolicyUsageTelemetry {
  policyId: string;
  appId: string;
  feature: string;
  todayDate: string; // YYYY-MM-DD
  currentMonth: string; // YYYY-MM
  dailyRequests: number;
  dailyTokens: number;
  monthlyRequests: number;
  monthlyTokens: number;
  remainingDailyRequests?: number | undefined;
  remainingDailyTokens?: number | undefined;
  remainingMonthlyRequests?: number | undefined;
  remainingMonthlyTokens?: number | undefined;
  circuitBreaker?: CircuitBreakerSnapshot | undefined;
  lastUsedAt?: Timestamp | undefined;
}

export interface AiPolicy {
  id: string;
  appId: string;
  feature: string;
  primaryProviderId: string;
  primaryModelId: string;
  fallbackChain: FallbackEntry[];
  quotas: QuotaConfig;
  circuitBreaker?: CircuitBreakerConfig | undefined;
  priority?: number | undefined; // 1-100, higher = evaluated first (default 50)
  enabled: boolean;
  usageStats?: PolicyUsageTelemetry | undefined;
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
  rateLimitRpm?: number | undefined; // Requests per minute rate limit
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

export interface AiPlaygroundRequest {
  providerId: string;
  modelId: string;
  prompt: string;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}

export interface AiPlaygroundResponse {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  usage: TokenUsage;
  costEstimate: CostEstimate;
  latencyMs: number;
  raw?: Record<string, unknown> | undefined;
}

// ============================================================
// Promotion / Campaign Types (Platform-agnostic API contract)
// ============================================================

export type CampaignStatus = 'draft' | 'published' | 'paused' | 'ended';
export type LayoutVariant = 'banner' | 'interstitial' | 'native' | 'sponsored';

export interface Campaign {
  id: string;
  name: string;
  promotedAppId: string;
  targetAppIds: string[];
  title: string;
  description: string;
  ctaText: string;
  storeUrl: string;
  sponsorLabel?: string | undefined;
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
  sponsorLabel?: string | undefined;
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

export interface CloudRunServiceHealth {
  serviceId: string;
  name: string;
  region: string;
  status: HealthStatusLevel;
  latestRevision: string;
  url: string;
  trafficPercent: number;
  ingress: string;
  maxScale?: number | undefined;
  activeConditions: string[];
  lastTransitionTime?: string | undefined;
  creator?: string | undefined;
}

export interface SecretManagerItemStatus {
  name: string;
  configured: boolean;
  state: 'ENABLED' | 'DISABLED' | 'NOT_FOUND' | 'UNKNOWN';
  createTime: string | null;
  replication: string;
  version: number | null;
  lastUpdated: string | null;
}

export interface CloudSchedulerJobStatus {
  jobId: string;
  name: string;
  schedule: string;
  timeZone: string;
  state: string;
  lastAttemptTime?: string | undefined;
}

export interface ProcessMetricDetails {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  cpuUserMicroseconds?: number | undefined;
  cpuSystemMicroseconds?: number | undefined;
}

export interface InfrastructureOverviewReport {
  overallStatus: HealthStatusLevel;
  summary: {
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    totalServices: number;
    avgLatencyMs: number;
    maxErrorRatePct: number;
    activeAlertsCount: number;
  };
  services: DetailedServiceHealth[];
  cloudRun: CloudRunServiceHealth[];
  firestore: {
    status: HealthStatusLevel;
    latencyMs: number;
    projectId: string;
    database: string;
    accessible: boolean;
    lastCheckedAt: string;
  };
  secretManager: {
    status: HealthStatusLevel;
    totalConfigured: number;
    totalTracked: number;
    secrets: SecretManagerItemStatus[];
    lastCheckedAt: string;
  };
  cloudScheduler: {
    status: HealthStatusLevel;
    totalJobs: number;
    jobs: CloudSchedulerJobStatus[];
    note: string;
    lastCheckedAt: string;
  };
  systemProcess: ProcessMetricDetails;
  aiNode: {
    status: 'offline' | 'unconfigured' | 'healthy' | 'degraded';
    configured: boolean;
    engine: string | null;
    model: string | null;
    gpuAvailable: boolean;
    gpuUsagePct: number | null; // null if Not available
    vramUsedMb: number | null; // null if Not available
    vramTotalMb: number | null; // null if Not available
    temperatureC: number | null; // null if Not available
    queueDepth: number | null;
    activeStreams: number | null;
    avgLatencyMs: number | null;
    note: string;
  };
  alerts: {
    rules: InfrastructureAlertRule[];
    triggers: InfrastructureAlertTrigger[];
  };
  generatedAt: string;
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
  | 'app.regenerate_key'
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
  | 'gateway.kill_switch'
  | 'ai.playground_infer'
  | 'ads.network_create'
  | 'ads.network_update'
  | 'ads.network_delete'
  | 'ads.app_config_update'
  | 'ads.unit_create'
  | 'ads.unit_update'
  | 'ads.unit_delete'
  | 'ads.placement_create'
  | 'ads.placement_update'
  | 'ads.placement_delete'
  | 'ads.rotation_update'
  | 'ads.frequency_update'
  | 'ads.safety_update'
  | 'ads.custom_campaign_create'
  | 'ads.custom_campaign_update'
  | 'ads.custom_campaign_delete'
  | 'ads.kill_switch_update'
  | 'notifications.create'
  | 'notifications.update'
  | 'notifications.delete'
  | 'notifications.send'
  | 'notifications.template_create'
  | 'notifications.template_update'
  | 'notifications.template_delete'
  | 'notifications.kill_switch_update';

export interface AuditLog {
  id: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  resourceType: string;
  resourceId: string;
  module?: string | undefined;
  appId?: string | undefined;
  requestId?: string | undefined;
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
  errorCount?: number | undefined;
  avgLatencyMs?: number | undefined;
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
      errorCount?: number;
      avgLatencyMs?: number;
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
  byModel?: Record<
    string,
    {
      providerId: string;
      requests: number;
      tokens: number;
      costEstimateUsd: number;
      errorCount: number;
      avgLatencyMs: number;
    }
  >;
  dailyTrends: DailyUsageTrend[];
  recentEvents?: UsageEvent[];
}

// ============================================================
// Platform Services API Contracts (/api/platform/v1/*)
// ============================================================

export type PlatformExecutionSource = 'on_device' | 'wap_engine' | 'external_provider';

export interface PlatformResponse<T = unknown> {
  success: boolean;
  requestId: string;
  appId: string;
  service: PlatformServiceType;
  version: string;
  data?: T | undefined;
  executionSource: PlatformExecutionSource;
  usage?:
    | {
        requests?: number | undefined;
        inputTokens?: number | undefined;
        outputTokens?: number | undefined;
        totalTokens?: number | undefined;
        latencyMs?: number | undefined;
        processingVolumeBytes?: number | undefined;
      }
    | undefined;
  costEstimate?: CostEstimate | undefined;
  error?: ApiError | undefined;
  timestamp: Timestamp;
}

// ------------------------------------------------------------
// A. AI Services Contracts
// ------------------------------------------------------------

export interface PlatformAiGenerateRequest {
  appId: string;
  requestId?: string | undefined;
  prompt?: string | undefined;
  messages?: ChatMessage[] | undefined;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  modelPreference?: string | undefined;
}

export interface PlatformAiGenerateResponse {
  text: string;
  modelId: string;
  providerId: string;
  finishReason?: string | undefined;
}

export interface PlatformAiVisionRequest {
  appId: string;
  requestId?: string | undefined;
  prompt: string;
  imageData: string; // base64 or URL
  maxTokens?: number | undefined;
}

export interface PlatformAiVisionResponse {
  description: string;
  detectedObjects?: string[] | undefined;
  modelId: string;
  providerId: string;
}

export interface PlatformAiClassifyRequest {
  appId: string;
  requestId?: string | undefined;
  text: string;
  candidateLabels: string[];
  multiLabel?: boolean | undefined;
}

export interface PlatformAiClassifyResponse {
  text: string;
  predictedLabel: string;
  confidence: number;
  labels: Array<{ label: string; score: number }>;
}

export interface PlatformAiSummarizeRequest {
  appId: string;
  requestId?: string | undefined;
  text: string;
  maxLength?: number | undefined;
  format?: 'paragraph' | 'bullet_points' | 'key_takeaways' | undefined;
}

export interface PlatformAiSummarizeResponse {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
}

export interface PlatformAiTranslateRequest {
  appId: string;
  requestId?: string | undefined;
  text: string;
  sourceLanguage?: string | undefined;
  targetLanguage: string;
}

export interface PlatformAiTranslateResponse {
  translatedText: string;
  detectedSourceLanguage?: string | undefined;
  targetLanguage: string;
}

export interface PlatformAiExtractRequest {
  appId: string;
  requestId?: string | undefined;
  text: string;
  targetFields: string[];
  schemaDefinition?: Record<string, string> | undefined;
}

export interface PlatformAiExtractResponse {
  extractedData: Record<string, unknown>;
  confidence?: number | undefined;
}

// ------------------------------------------------------------
// B. Image Intelligence Contracts
// ------------------------------------------------------------

export type ImageOperation =
  | 'enhance'
  | 'super_resolution'
  | 'upscale'
  | 'denoise'
  | 'sharpen'
  | 'deblur'
  | 'hdr'
  | 'low_light'
  | 'color_correct'
  | 'face_enhance'
  | 'restore'
  | 'compress'
  | 'quality_analysis';

export interface PlatformImageEnhanceRequest {
  appId: string;
  requestId?: string | undefined;
  operation: ImageOperation;
  imageData: string; // base64 or URL
  scaleFactor?: 2 | 4 | undefined;
  qualityPreset?: 'fast' | 'balanced' | 'high_quality' | undefined;
  preferLocal?: boolean | undefined;
  options?:
    | {
        denoiseStrength?: number | undefined; // 0.0 - 1.0
        sharpenAmount?: number | undefined;   // 0.0 - 1.0
        hdrIntensity?: number | undefined;    // 0.0 - 1.0
        targetFormat?: 'jpeg' | 'png' | 'webp' | undefined;
        maxDimension?: number | undefined;
      }
    | undefined;
}

export interface PlatformImageEnhanceResponse {
  operation: ImageOperation;
  outputImageData?: string | undefined; // base64 or URL (if processed on server)
  directive?: 'process_locally' | 'use_lite_model' | 'completed_server_side' | undefined;
  recommendedModel?: string | undefined;
  appliedSettings: Record<string, unknown>;
  originalDimensions?: { width: number; height: number } | undefined;
  enhancedDimensions?: { width: number; height: number } | undefined;
  compressionSavedBytes?: number | undefined;
}

export interface PlatformImageAnalyzeRequest {
  appId: string;
  requestId?: string | undefined;
  imageData: string; // base64 or URL
  checks?: Array<'quality_score' | 'blur_detection' | 'resolution_check' | 'face_detection'> | undefined;
}

export interface PlatformImageAnalyzeResponse {
  qualityScore: number; // 0 - 100
  isBlurry: boolean;
  blurScore: number;
  estimatedResolution: { width: number; height: number };
  hasFaces?: boolean | undefined;
  facesCount?: number | undefined;
  recommendations: string[];
}

// ------------------------------------------------------------
// C. OCR / Document Intelligence Contracts
// ------------------------------------------------------------

export type DocumentType = 'general' | 'receipt' | 'invoice' | 'id_card' | 'document' | 'form';

export interface PlatformOcrExtractRequest {
  appId: string;
  requestId?: string | undefined;
  imageData?: string | undefined; // base64 or URL
  pdfData?: string | undefined;   // base64
  documentType?: DocumentType | undefined;
  languages?: string[] | undefined; // e.g. ['en', 'hi', 'es']
  structuredExtract?: boolean | undefined;
  preferLocal?: boolean | undefined;
}

export interface ExtractedField {
  fieldName: string;
  fieldValue: string | number | boolean;
  confidence: number;
  boundingBox?: [number, number, number, number] | undefined;
}

export interface PlatformOcrExtractResponse {
  fullText: string;
  detectedLanguage?: string | undefined;
  confidence: number;
  lineCount: number;
  structuredData?: Record<string, unknown> | undefined;
  fields?: ExtractedField[] | undefined;
  documentType: DocumentType;
  searchableText: string;
}

// ------------------------------------------------------------
// D. File Intelligence Contracts
// ------------------------------------------------------------

export interface FileCandidateMetadata {
  id: string;
  name: string;
  extension?: string | undefined;
  mimeType?: string | undefined;
  sizeBytes?: number | undefined;
  dateCreated?: string | undefined;
  dateModified?: string | undefined;
  extractedSnippet?: string | undefined;
  tags?: string[] | undefined;
}

export interface PlatformFileSearchRequest {
  appId: string;
  requestId?: string | undefined;
  query: string; // Natural language query e.g. "2025 ka electricity bill dhundo"
  localCandidates?: FileCandidateMetadata[] | undefined;
  limit?: number | undefined;
  targetCategory?: string | undefined;
}

export interface FileMatchResult {
  fileId?: string | undefined;
  fileName?: string | undefined;
  relevanceScore: number; // 0 - 100
  matchedSnippet?: string | undefined;
  categoryMatched?: string | undefined;
  reasons: string[];
}

export interface PlatformFileSearchResponse {
  query: string;
  parsedIntent: {
    category?: string | undefined;
    targetYear?: number | undefined;
    targetMonth?: string | undefined;
    documentType?: string | undefined;
    keywords: string[];
  };
  matchedFiles: FileMatchResult[];
  recommendedLocalFilters?:
    | {
        extensionIn?: string[] | undefined;
        dateAfter?: string | undefined;
        dateBefore?: string | undefined;
        regexPattern?: string | undefined;
      }
    | undefined;
}

export interface PlatformFileClassifyRequest {
  appId: string;
  requestId?: string | undefined;
  files: Array<{
    id: string;
    name: string;
    extension?: string | undefined;
    mimeType?: string | undefined;
    sizeBytes?: number | undefined;
    sampleText?: string | undefined;
  }>;
}

export interface ClassifiedFileItem {
  id: string;
  name: string;
  category: 'financial' | 'bills_receipts' | 'legal' | 'personal' | 'medical' | 'work' | 'media' | 'other';
  suggestedTags: string[];
  confidence: number;
  isDuplicateCandidate?: boolean | undefined;
  duplicateOfId?: string | undefined;
}

export interface PlatformFileClassifyResponse {
  results: ClassifiedFileItem[];
  totalClassified: number;
}

// ------------------------------------------------------------
// E. Platform Kill Switches & Health
// ------------------------------------------------------------

export interface PlatformKillSwitchConfig {
  global: boolean;
  services: Partial<Record<PlatformServiceType, boolean>>;
  apps: Record<string, boolean>;
  providers: Record<string, boolean>;
}

export interface PlatformServiceEndpointInfo {
  service: PlatformServiceType;
  path: string;
  method: 'GET' | 'POST';
  description: string;
  requiredPermission: string;
  status: 'active' | 'disabled';
}

// ============================================================
// Ads & Monetization Control Center Types
// ============================================================

export interface AdNetwork {
  id: string; // 'admob' | 'meta' | 'applovin' | 'custom_ads' | string
  name: string;
  enabled: boolean;
  environmentMode: 'test' | 'production';
  secretReferenceName?: string | undefined; // Reference in Secret Manager
  configured: boolean;
  supportedFormats: AdFormat[];
  priority: number;
  healthStatus: HealthStatus;
  notes?: string | undefined;
  allowedAppIds?: string[] | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FormatToggleConfig {
  enabled: boolean;
  testMode?: boolean | undefined;
  refreshIntervalSeconds?: number | undefined; // For banner, default 60
  cooldownSeconds?: number | undefined;
  sessionCap?: number | undefined;
  dailyCap?: number | undefined;
}

export interface AdAppConfig {
  id: string; // App ID
  appId: string;
  appName?: string | undefined;
  masterEnabled: boolean;
  formats: Record<AdFormat, FormatToggleConfig>;
  networkSettings?: Record<string, {
    enabled: boolean;
    appIdOrSdkKey?: string | undefined;
  }> | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdUnitDoc {
  id: string;
  appId: string;
  networkId: string;
  format: AdFormat;
  platform: Platform | 'all';
  name: string;
  adUnitId: string;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdPlacementDoc {
  id: string;
  appId: string;
  placementKey: string;
  name: string;
  format: AdFormat;
  enabled: boolean;
  screenLocation?: string | undefined;
  cooldownSeconds?: number | undefined;
  sessionCap?: number | undefined;
  dailyCap?: number | undefined;
  foregroundRule?: 'always' | 'after_background_30s' | 'cold_start_only' | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdMediationTier {
  networkId: string;
  priority: number;
  enabled: boolean;
  weight?: number | undefined;
  timeoutMs?: number | undefined;
}

export interface AdRotationPolicy {
  id: string;
  appId: string;
  format: AdFormat;
  tiers: AdMediationTier[];
  fallbackToCustomAds: boolean;
  bannerRefreshIntervalSeconds: number; // Safe default 60, min 30
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdFormatFrequency {
  minIntervalSeconds: number;
  cooldownSeconds: number;
  sessionCap: number;
  dailyCap: number;
  perUserCap?: number | undefined;
  appForegroundRule?: 'always' | 'min_background_30s' | 'disabled' | undefined;
}

export interface AdFrequencyPolicy {
  id: string;
  appId: string;
  formats: Record<AdFormat, AdFormatFrequency>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdSafetyPolicy {
  id: string;
  appId: string;
  blockedCategories: string[];
  maxAdRating: 'G' | 'PG' | 'T' | 'MA';
  blockSensitiveCategories: boolean;
  childDirectedApp: boolean;
  customBlockedKeywords?: string[] | undefined;
  disclaimer: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdKillSwitches {
  id: string;
  globalAdsDisabled: boolean;
  networks: Record<string, boolean>;
  apps: Record<string, boolean>;
  formats: Record<AdFormat, boolean>;
  placements: Record<string, boolean>;
  customAdsDisabled: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
  reason?: string | undefined;
}

export type CreativeType =
  | 'image'
  | 'video'
  | 'animated'
  | 'native_card'
  | 'carousel';

export interface CarouselItem {
  id: string;
  imageUrl: string;
  title?: string | undefined;
  description?: string | undefined;
  ctaText?: string | undefined;
  destinationUrl?: string | undefined;
}

export interface CreativeAssetMetadata {
  storagePath?: string | undefined;
  mimeType?: string | undefined;
  fileSizeBytes?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  durationSeconds?: number | undefined;
}

export interface CustomAdCreative extends CreativeAssetMetadata {
  id: string;
  campaignId: string;
  format: 'banner' | 'native' | 'video' | 'interstitial';
  creativeType?: CreativeType | undefined;
  title?: string | undefined;
  headline?: string | undefined;
  bodyText?: string | undefined;
  imageUrl?: string | undefined;
  videoUrl?: string | undefined;
  thumbnailUrl?: string | undefined;
  animationUrl?: string | undefined;
  animationType?: 'gif' | 'lottie' | undefined;
  iconUrl?: string | undefined;
  callToAction?: string | undefined;
  destinationUrl?: string | undefined;
  aspectRatio?: string | undefined;
  carouselItems?: CarouselItem[] | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomAdCampaign {
  id: string;
  title: string;
  description: string;
  ctaText: string;
  destinationUrl: string;
  targetApps: string[];
  targetAppId?: string | undefined;
  creativeType?: CreativeType | undefined;
  placements?: AdFormat[] | undefined;
  startDate: string;
  endDate: string;
  priority: number;
  enabled: boolean;
  status: 'draft' | 'active' | 'paused' | 'completed';
  impressionsCount: number;
  clicksCount: number;
  creatives?: CustomAdCreative[] | undefined;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EffectiveAdFormatConfig {
  enabled: boolean;
  format: AdFormat;
  refreshIntervalSeconds?: number | undefined;
  frequency: {
    minIntervalSeconds: number;
    cooldownSeconds: number;
    sessionCap: number;
    dailyCap: number;
  };
  mediationChain: Array<{
    networkId: string;
    priority: number;
    adUnitId: string;
    timeoutMs: number;
  }>;
  customAdFallback?: {
    campaignId: string;
    title: string;
    description: string;
    ctaText: string;
    destinationUrl: string;
    imageUrl?: string | undefined;
    videoUrl?: string | undefined;
    thumbnailUrl?: string | undefined;
    animationUrl?: string | undefined;
    creativeType?: CreativeType | undefined;
    carouselItems?: CarouselItem[] | undefined;
  } | null | undefined;
}

export interface EffectiveAdConfigResponse {
  appId: string;
  enabled: boolean;
  testMode: boolean;
  version: string;
  safety: {
    maxAdRating: 'G' | 'PG' | 'T' | 'MA';
    blockedCategories: string[];
  };
  formats: Record<AdFormat, EffectiveAdFormatConfig>;
  placements: Record<string, {
    placementKey: string;
    format: AdFormat;
    enabled: boolean;
    cooldownSeconds?: number | undefined;
    sessionCap?: number | undefined;
    dailyCap?: number | undefined;
    foregroundRule?: string | undefined;
  }>;
  disclaimer: string;
  timestamp: string;
}

export interface AdsOverviewMetrics {
  totalApps: number;
  activeAdNetworks: number;
  activeAdPlacements: number;
  adsMasterEnabled: boolean;
  estimatedImpressionsDaily: number;
  estimatedRevenueDailyUsd: number;
  fillRatePct: number;
  revenueStatus?: string;
  isRevenueConnected?: boolean;
  networkBreakdown: Record<string, {
    impressions: number;
    revenueUsd: number;
    fillRatePct: number;
    status: HealthStatus;
    revenueStatus?: string;
  }>;
  recentAuditLogs: AuditLog[];
}

// ============================================================
// Notification System Types (Step 3)
// ============================================================

export type NotificationType =
  | 'global'
  | 'app_specific'
  | 'system'
  | 'important'
  | 'announcement'
  | 'maintenance'
  | 'update'
  | 'promotion'
  | 'custom';

export type NotificationCategory =
  | 'SYSTEM'
  | 'IMPORTANT'
  | 'SECURITY'
  | 'UPDATE'
  | 'FEATURE'
  | 'PROMOTION'
  | 'MAINTENANCE'
  | 'CUSTOM';

export type NotificationPriority = 'normal' | 'high' | 'urgent';

export type NotificationStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'sent'
  | 'partially_delivered'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type NotificationDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'expired';

export type NotificationTargetType =
  | 'all_apps'
  | 'specific_app'
  | 'multiple_apps'
  | 'device_token';

export interface NotificationDoc {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  targetType: NotificationTargetType;
  targetAppIds: string[];
  targetAppId?: string | undefined;
  targetDeviceTokens?: string[] | undefined;
  imageUrl?: string | undefined;
  icon?: string | undefined;
  deepLink?: string | undefined;
  externalUrl?: string | undefined;
  sound?: string | undefined;
  badge?: number | undefined;
  dataPayload?: Record<string, string> | undefined;
  campaignId?: string | undefined;
  templateId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  isMandatory?: boolean | undefined;
  status: NotificationStatus;
  schedule?: string | undefined;
  scheduledAt?: string | undefined;
  sentAt?: string | undefined;
  expiry?: string | undefined;
  ttlSeconds?: number | undefined;
  stats: {
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
  };
  createdBy?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplateDoc {
  id: string;
  name: string;
  title: string;
  body: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  imageUrl?: string | undefined;
  icon?: string | undefined;
  deepLink?: string | undefined;
  sound?: string | undefined;
  badge?: number | undefined;
  dataPayload?: Record<string, string> | undefined;
  variables?: string[] | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecipientDoc {
  id: string;
  notificationId: string;
  appId: string;
  deviceId: string;
  deviceToken: string;
  status: NotificationDeliveryStatus;
  read: boolean;
  readAt?: string | undefined;
  openedAt?: string | undefined;
  deliveredAt?: string | undefined;
  failureReason?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDeviceDoc {
  id: string;
  appId: string;
  deviceId: string;
  fcmToken: string;
  platform: Platform;
  appVersion?: string | undefined;
  osVersion?: string | undefined;
  active: boolean;
  lastSeenAt: string;
  registeredAt: string;
  unregisteredAt?: string | undefined;
}

export interface NotificationPreferencesDoc {
  id: string;
  appId: string;
  deviceId: string;
  notificationsEnabled: boolean;
  promotionalEnabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  updatedAt: string;
}

export interface NotificationCategoryDoc {
  id: NotificationCategory;
  name: string;
  description: string;
  isMandatory: boolean;
  defaultEnabled: boolean;
  appOverrides?: Record<string, { enabled: boolean }> | undefined;
}

export interface NotificationDeliveryLogDoc {
  id: string;
  requestId: string;
  notificationId: string;
  appId: string;
  deviceId?: string | undefined;
  deviceIdentifier: string;
  timestamp: string;
  status: NotificationDeliveryStatus;
  failureReason?: string | undefined;
  provider: 'fcm';
  attemptCount?: number | undefined;
  messageId?: string | undefined;
}

export interface NotificationAuditLogDoc {
  id: string;
  actor: {
    id: string;
    email?: string | undefined;
    role?: string | undefined;
  };
  timestamp: string;
  action: string;
  appId?: string | undefined;
  notificationId?: string | undefined;
  campaignId?: string | undefined;
  requestId: string;
  before?: Record<string, unknown> | undefined;
  after?: Record<string, unknown> | undefined;
}

export interface NotificationSettingsDoc {
  id: 'global';
  globalNotificationsOff: boolean;
  appKillSwitches: Record<string, boolean>;
  categoryKillSwitches: Record<NotificationCategory, boolean>;
  campaignKillSwitches: Record<string, boolean>;
  updatedAt: string;
  updatedBy?: string | undefined;
}

export interface NotificationOverviewMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
  openRatePct: number;
  activeDevicesCount: number;
  unreadCountEstimate: number;
  categoryDistribution: Record<NotificationCategory, number>;
  appDistribution: Record<string, number>;
  recentLogs: NotificationDeliveryLogDoc[];
  killSwitchState: {
    globalNotificationsOff: boolean;
    appKillSwitches: Record<string, boolean>;
  };
}

export interface PlatformNotificationConfigResponse {
  appId: string;
  notificationsEnabled: boolean;
  globalNotificationsOff: boolean;
  appKillSwitchActive: boolean;
  activeCategories: Array<{
    id: NotificationCategory;
    name: string;
    isMandatory: boolean;
    enabled: boolean;
  }>;
  preferences?: {
    notificationsEnabled: boolean;
    promotionalEnabled: boolean;
    categories: Record<NotificationCategory, boolean>;
  } | undefined;
  version: string;
  timestamp: string;
}

// ============================================================
// Analytics & Revenue Intelligence Types (Step 4)
// ============================================================

export type AdEventType =
  | 'request'
  | 'fill'
  | 'impression'
  | 'click'
  | 'failure'
  | 'reward'
  | 'provider_selection'
  | 'fallback';

export interface AdTelemetryEventDoc {
  id: string;
  requestId: string;
  appId: string;
  eventType: AdEventType;
  adFormat: AdFormat;
  provider: string; // 'admob' | 'meta' | 'applovin' | 'custom_ads' | string
  placementId?: string | undefined;
  adUnitId?: string | undefined;
  campaignId?: string | undefined;
  creativeId?: string | undefined;
  rewardType?: string | undefined;
  rewardAmount?: number | undefined;
  failureReason?: string | undefined;
  errorCode?: string | undefined;
  latencyMs?: number | undefined;
  environment: 'development' | 'staging' | 'production';
  platform?: Platform | undefined;
  appVersion?: string | undefined;
  sdkVersion?: string | undefined;
  timestamp: string; // ISO 8601
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface CustomAdAnalyticsDoc {
  id: string;
  campaignId: string;
  appId: string;
  creativeId?: string | undefined;
  eventType: 'impression' | 'click' | 'dismiss';
  placementId?: string | undefined;
  timestamp: string;
  environment: string;
}

export interface NotificationAnalyticsDoc {
  id: string;
  notificationId: string;
  appId: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'dismissed';
  category: NotificationCategory;
  timestamp: string;
}

export interface AnalyticsDailyAggregateDoc {
  id: string; // {date}_{appId}_{provider}_{format}
  date: string; // YYYY-MM-DD
  appId: string;
  provider: string;
  format: AdFormat;
  placementId?: string | undefined;
  requests: number;
  fills: number;
  impressions: number;
  clicks: number;
  failures: number;
  rewards: number;
  fallbacks: number;
  revenue: number;
  revenueStatus: 'Not connected' | 'Awaiting provider data' | 'Estimated / unavailable' | 'Connected';
  updatedAt: string;
}

export interface AnalyticsOverviewMetrics {
  totalRequests: number;
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  overallFillRate: number;
  averageEcpm: number;
  estimatedRevenue: number;
  revenueStatus: 'Not connected' | 'Awaiting provider data' | 'Estimated / unavailable';
  totalFailures: number;
  totalRewards: number;
  fallbackCount: number;
  fallbackRatePct: number;
  activeAppsCount: number;
  activeNetworksCount: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface AppAnalyticsMetrics {
  appId: string;
  appName?: string | undefined;
  requests: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fillRate: number;
  ecpm: number;
  revenue: number;
  revenueStatus: string;
  failures: number;
  topFormat: string;
  topProvider: string;
}

export interface NetworkComparisonItem {
  provider: string;
  name: string;
  requests: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fillRate: number;
  ecpm: number;
  revenue: number;
  revenueStatus: string;
  failureRate: number;
  status: HealthStatus;
}

export interface FormatAnalyticsItem {
  format: AdFormat;
  requests: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fillRate: number;
  ecpm: number;
  revenue: number;
  revenueStatus: string;
}

export interface PlacementAnalyticsItem {
  placementId: string;
  appId: string;
  format: AdFormat;
  impressions: number;
  clicks: number;
  ctr: number;
  fillRate: number;
}

export interface CustomAdsAnalyticsMetrics {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  topCampaigns: Array<{
    campaignId: string;
    title: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
}

export interface NotificationAnalyticsSummary {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
  openRate: number;
  categoryBreakdown: Record<string, number>;
  appBreakdown: Record<string, number>;
}

export interface TimeSeriesDataPoint {
  date: string;
  requests: number;
  impressions: number;
  clicks: number;
  ctr: number;
  fillRate: number;
  ecpm: number;
  revenue: number;
  failures: number;
}

export interface CostIntelligenceMetrics {
  providerCostEstimates: Record<string, number>;
  infraCostStatus: 'Not available' | 'Available';
  netRevenueEstimate: number;
  notes: string;
}

export interface AdTelemetryIngestPayload {
  events: Array<{
    requestId: string;
    eventType: AdEventType;
    adFormat: AdFormat;
    provider: string;
    placementId?: string | undefined;
    adUnitId?: string | undefined;
    campaignId?: string | undefined;
    creativeId?: string | undefined;
    rewardType?: string | undefined;
    rewardAmount?: number | undefined;
    failureReason?: string | undefined;
    errorCode?: string | undefined;
    latencyMs?: number | undefined;
    environment?: 'development' | 'staging' | 'production' | undefined;
    platform?: Platform | undefined;
    appVersion?: string | undefined;
    sdkVersion?: string | undefined;
    timestamp?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }>;
}

export interface AdTelemetryIngestResult {
  accepted: number;
  rejected: number;
  errors?: string[] | undefined;
}

