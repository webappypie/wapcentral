/**
 * @wapcentral/config
 *
 * Shared constants and configuration for WAPCentral services and dashboard.
 */

// ============================================================
// Firestore Collection Names (single source of truth)
// ============================================================
export const COLLECTIONS = {
  APPS: 'apps',
  ENVIRONMENTS: 'environments',
  PROVIDERS: 'providers',
  MODELS: 'models',
  AI_POLICIES: 'aiPolicies',
  CAMPAIGNS: 'campaigns',
  CAMPAIGN_ASSETS: 'campaignAssets',
  FEATURE_FLAGS: 'featureFlags',
  USAGE_DAILY: 'usageDaily',
  USAGE_EVENTS: 'usageEvents',
  HEALTH_CHECKS: 'healthChecks',
  AUDIT_LOGS: 'auditLogs',
  ROLES: 'roles',
  PROMOTION_EVENTS: 'promotionEvents',
  COST_ALERTS: 'costAlerts',
  DATA_RETENTION: 'dataRetention',
  INFRASTRUCTURE_ALERTS: 'infrastructureAlerts',
  AI_SERVER_METRICS: 'aiServerMetrics',
  PLATFORM_SERVICES: 'platformServices',
  PLATFORM_KILL_SWITCHES: 'platformKillSwitches',
  AD_NETWORKS: 'adNetworks',
  AD_APPS: 'adApps',
  AD_UNITS: 'adUnits',
  AD_PLACEMENTS: 'adPlacements',
  AD_ROTATION_POLICIES: 'adRotationPolicies',
  AD_FREQUENCY_POLICIES: 'adFrequencyPolicies',
  AD_SAFETY_POLICIES: 'adSafetyPolicies',
  CUSTOM_AD_CAMPAIGNS: 'customAdCampaigns',
  CUSTOM_AD_CREATIVES: 'customAdCreatives',
  AD_KILL_SWITCHES: 'adKillSwitches',
  AD_AUDIT_LOGS: 'adAuditLogs',
  NOTIFICATION_TEMPLATES: 'notificationTemplates',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_RECIPIENTS: 'notificationRecipients',
  NOTIFICATION_DEVICES: 'notificationDevices',
  NOTIFICATION_PREFERENCES: 'notificationPreferences',
  NOTIFICATION_CATEGORIES: 'notificationCategories',
  NOTIFICATION_DELIVERY_LOGS: 'notificationDeliveryLogs',
  NOTIFICATION_AUDIT_LOGS: 'notificationAuditLogs',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  AD_IMPRESSION_EVENTS: 'adImpressionEvents',
  AD_CLICK_EVENTS: 'adClickEvents',
  AD_REQUEST_EVENTS: 'adRequestEvents',
  AD_FILL_EVENTS: 'adFillEvents',
  AD_FAILURE_EVENTS: 'adFailureEvents',
  AD_REWARD_EVENTS: 'adRewardEvents',
  AD_PROVIDER_EVENTS: 'adProviderEvents',
  CUSTOM_AD_ANALYTICS: 'customAdAnalytics',
  NOTIFICATION_ANALYTICS: 'notificationAnalytics',
  ANALYTICS_DAILY_AGGREGATES: 'analyticsDailyAggregates',
} as const;

// ============================================================
// Analytics & Revenue Intelligence Constants (Step 4)
// ============================================================
export const ANALYTICS_CONFIG = {
  DEFAULT_RAW_EVENT_RETENTION_DAYS: 90,
  DEFAULT_AGGREGATE_RETENTION_DAYS: 730,
  MAX_BATCH_INGESTION_SIZE: 100,
  DEDUPLICATION_WINDOW_MS: 5000,
  SUPPORTED_PROVIDERS: ['admob', 'meta', 'applovin', 'custom_ads'] as const,
  REVENUE_STATUS: {
    NOT_CONNECTED: 'Not connected',
    AWAITING_PROVIDER: 'Awaiting provider data',
    ESTIMATED_UNAVAILABLE: 'Estimated / unavailable',
  } as const,
} as const;

// ============================================================
// Notification System Constants (Step 3)
// ============================================================
export const NOTIFICATIONS_CONFIG = {
  CATEGORIES: [
    'SYSTEM',
    'IMPORTANT',
    'SECURITY',
    'UPDATE',
    'FEATURE',
    'PROMOTION',
    'MAINTENANCE',
    'CUSTOM',
  ] as const,
  MANDATORY_CATEGORIES: ['SYSTEM', 'SECURITY', 'MAINTENANCE'] as const,
  DEFAULT_TTL_SECONDS: 86400 * 7, // 7 days
} as const;

// ============================================================
// Ads & Monetization System Constants
// ============================================================
export const ADS_CONFIG = {
  DEFAULT_BANNER_REFRESH_INTERVAL_SECONDS: 60,
  MIN_BANNER_REFRESH_INTERVAL_SECONDS: 30,
  DEFAULT_MEDIATION_TIMEOUT_MS: 5000,
  DEFAULT_BLOCKED_CATEGORIES: [
    'violence',
    'weapons',
    'adult_sexual',
    'gambling',
    'drugs',
    'hate_extremism',
    'malware_scams',
    'age_restricted',
  ] as const,
  SUPPORTED_NETWORKS: ['admob', 'meta', 'applovin', 'custom_ads'] as const,
  SUPPORTED_FORMATS: [
    'banner',
    'native',
    'interstitial',
    'rewarded',
    'app_open',
    'rewarded_interstitial',
  ] as const,
} as const;

// ============================================================
// Promotion System
// ============================================================
export const PROMOTION = {
  SCHEMA_VERSION: 1,
  DEFAULT_CACHE_TTL_SECONDS: 21600, // 6 hours
  MAX_CACHE_TTL_SECONDS: 86400, // 24 hours
  MIN_CACHE_TTL_SECONDS: 300, // 5 minutes
  REQUEST_TIMEOUT_MS: 5000, // 5 seconds
  PAYLOAD_MAX_SIZE_BYTES: 8192, // 8 KB
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
  DEFAULT_PRIORITY: 50,
  MAX_PRIORITY: 100,
  MIN_PRIORITY: 0,
} as const;

// ============================================================
// AI Gateway
// ============================================================
export const AI_GATEWAY = {
  DEFAULT_TIMEOUT_MS: 30000, // 30 seconds
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  MAX_INPUT_TOKENS_DEFAULT: 4096,
  MAX_OUTPUT_TOKENS_DEFAULT: 2048,
  COST_ESTIMATE_LABEL: 'ESTIMATE', // Always label cost estimates
} as const;

// ============================================================
// RBAC — Single Super Admin Architecture (V1 Production)
// ============================================================
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
} as const;

export const ALLOWED_ROLES = ['super_admin'] as const;

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 4,
  // Extensible role mappings for future expansion
  admin: 3,
  editor: 2,
  viewer: 1,
};

// ============================================================
// Feature Flags — Dual-Layer System
// ============================================================
export const FEATURE_FLAGS = {
  // Firestore flag keys (primary source of truth)
  PROMOTION_ENABLED: 'promotion_enabled',
  AI_ENABLED: 'ai_enabled',
  ADS_ENABLED: 'ads_enabled',
  MAINTENANCE_MODE: 'maintenance_mode',
  // Remote Config keys (mobile runtime delivery)
  RC_PROMOTION_ENABLED: 'promotion_enabled',
  RC_AI_ENABLED: 'ai_enabled',
  RC_MIN_APP_VERSION: 'min_app_version',
} as const;

// ============================================================
// API Routes (promotion-api)
// ============================================================
export const PROMOTION_API_ROUTES = {
  PROMOTION: '/v1/promotion',
  HEALTH: '/v1/health',
  ANALYTICS_IMPRESSION: '/v1/analytics/impression',
  ANALYTICS_CLICK: '/v1/analytics/click',
} as const;

// ============================================================
// API Routes (ai-gateway)
// ============================================================
export const AI_GATEWAY_ROUTES = {
  GENERATE: '/v1/ai/generate',
  ANALYZE: '/v1/ai/analyze',
  EMBED: '/v1/ai/embed',
  HEALTH: '/v1/health',
} as const;

// ============================================================
// API Routes (Platform API Gateway: /api/platform/v1/*)
// ============================================================
export const PLATFORM_API_ROUTES = {
  BASE: '/api/platform/v1',
  HEALTH: '/api/platform/v1/health',
  APPLICATIONS: '/api/platform/v1/apps',
  AI_GENERATE: '/api/platform/v1/ai/generate',
  AI_VISION: '/api/platform/v1/ai/vision',
  AI_CLASSIFY: '/api/platform/v1/ai/classify',
  AI_SUMMARIZE: '/api/platform/v1/ai/summarize',
  AI_TRANSLATE: '/api/platform/v1/ai/translate',
  AI_EXTRACT: '/api/platform/v1/ai/extract',
  IMAGE_ENHANCE: '/api/platform/v1/image/enhance',
  IMAGE_ANALYZE: '/api/platform/v1/image/analyze',
  OCR_EXTRACT: '/api/platform/v1/ocr/extract',
  FILES_SEARCH: '/api/platform/v1/files/search',
  FILES_CLASSIFY: '/api/platform/v1/files/classify',
  KILL_SWITCH: '/api/platform/v1/kill-switch',
  ADS_CONFIG: '/api/platform/v1/ads/config',
  ADS_CUSTOM_TRACK: '/api/platform/v1/ads/custom/track',
  ADS_ANALYTICS_EVENTS: '/api/platform/v1/ads/analytics/events',
} as const;

// ============================================================
// API Routes (Analytics & Revenue Intelligence Admin: /v1/analytics/*)
// ============================================================
export const ANALYTICS_API_ROUTES = {
  BASE: '/v1/analytics',
  OVERVIEW: '/v1/analytics/overview',
  APPS: '/v1/analytics/apps',
  NETWORKS: '/v1/analytics/networks',
  FORMATS: '/v1/analytics/formats',
  PLACEMENTS: '/v1/analytics/placements',
  REVENUE: '/v1/analytics/revenue',
  CUSTOM_ADS: '/v1/analytics/custom-ads',
  NOTIFICATIONS: '/v1/analytics/notifications',
  TIMESERIES: '/v1/analytics/timeseries',
  EVENTS: '/v1/analytics/events',
  EXPORT: '/v1/analytics/export',
  AGGREGATE: '/v1/analytics/aggregate',
  COST_INTELLIGENCE: '/v1/analytics/cost-intelligence',
} as const;

// ============================================================
// API Routes (Ads & Monetization Admin: /v1/ads/* and /api/admin/v1/ads/*)
// ============================================================
export const ADS_API_ROUTES = {
  BASE: '/v1/ads',
  OVERVIEW: '/v1/ads/overview',
  NETWORKS: '/v1/ads/networks',
  APPS: '/v1/ads/apps',
  UNITS: '/v1/ads/units',
  PLACEMENTS: '/v1/ads/placements',
  ROTATION: '/v1/ads/rotation',
  FREQUENCY: '/v1/ads/frequency',
  SAFETY: '/v1/ads/safety',
  CUSTOM_CAMPAIGNS: '/v1/ads/custom-campaigns',
  KILL_SWITCHES: '/v1/ads/kill-switches',
  AUDIT_LOGS: '/v1/ads/audit-logs',
} as const;

// ============================================================
// Environments
// ============================================================
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const;

// ============================================================
// Audit
// ============================================================
export const AUDIT_RETENTION_DAYS = 365; // Keep audit logs for 1 year
export const USAGE_RETENTION_DAYS = 90; // Keep raw usage events for 90 days

// ============================================================
// Infrastructure Health & Heartbeats (Phase 11)
// ============================================================
export const HEALTH_MONITORING = {
  DEFAULT_HEARTBEAT_INTERVAL_MS: 30000, // 30 seconds
  DEFAULT_PROBE_TIMEOUT_MS: 5000, // 5 seconds
  LATENCY_WARNING_THRESHOLD_MS: 300,
  LATENCY_CRITICAL_THRESHOLD_MS: 800,
  ERROR_RATE_WARNING_THRESHOLD_PCT: 5.0,
  ERROR_RATE_CRITICAL_THRESHOLD_PCT: 20.0,
  CONSECUTIVE_FAILURES_CRITICAL_THRESHOLD: 3,
  GPU_USAGE_WARNING_THRESHOLD_PCT: 85.0,
  VRAM_USAGE_WARNING_THRESHOLD_PCT: 90.0,
  QUEUE_DEPTH_WARNING_THRESHOLD: 50,
} as const;

// ============================================================
// Release Metadata & Version
// ============================================================
export * from './version.js';
export * from './adTestCatalog.js';

