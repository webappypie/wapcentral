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
// RBAC
// ============================================================
export const ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  super_admin: 4,
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
