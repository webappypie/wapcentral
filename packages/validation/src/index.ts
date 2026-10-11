/**
 * @wapcentral/validation
 *
 * Shared Zod schemas for runtime validation of all WAPCentral data types.
 * Used by backend services to validate incoming requests and Firestore data.
 */

import { z } from 'zod';

// ============================================================
// Common / Utility Schemas
// ============================================================

export const PlatformSchema = z.enum(['android', 'ios', 'web']);
export const EnvironmentSchema = z.enum(['development', 'staging', 'production']);
export const StatusSchema = z.enum(['active', 'inactive', 'archived']);
export const TimestampSchema = z.string().datetime({ offset: true });
export const UserRoleSchema = z.enum(['viewer', 'editor', 'admin', 'super_admin']);
export const AdUnitTypeSchema = z.enum([
  'banner',
  'interstitial',
  'rewarded',
  'native',
  'rewarded_interstitial',
  'app_open',
]);
export const AdFormatSchema = z.enum([
  'banner',
  'native',
  'interstitial',
  'rewarded',
  'app_open',
  'rewarded_interstitial',
]);
export const LayoutVariantSchema = z.enum(['banner', 'interstitial', 'native']);
export const CampaignStatusSchema = z.enum(['draft', 'published', 'paused', 'ended']);
export const AiProviderTypeSchema = z.enum(['openai', 'gemini', 'anthropic', 'self_hosted']);

// ============================================================
// App Registry Schemas
// ============================================================

export const AdUnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AdUnitTypeSchema,
  platform: PlatformSchema,
  adUnitId: z.string().min(1),
});

export const AdPlacementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AdUnitTypeSchema,
  placementId: z.string().min(1),
});

export const AdMobConfigSchema = z.object({
  appId: z.string().min(1),
  adUnits: z.array(AdUnitSchema),
  enabled: z.boolean(),
});

export const MetaAdConfigSchema = z.object({
  appId: z.string().min(1),
  placements: z.array(AdPlacementSchema),
  enabled: z.boolean(),
});

export const AppLovinConfigSchema = z.object({
  sdkKey: z.string().min(1),
  adUnits: z.array(AdUnitSchema),
  enabled: z.boolean(),
});

export const WapAdsConfigSchema = z.object({
  appKey: z.string().min(1),
  enabled: z.boolean(),
});

export const AdNetworkTypeSchema = z.enum(['admob', 'meta', 'applovin', 'wapads']);

export const AppAdConfigSchema = z.object({
  admob: AdMobConfigSchema.optional(),
  meta: MetaAdConfigSchema.optional(),
  applovin: AppLovinConfigSchema.optional(),
  wapads: WapAdsConfigSchema.optional(),
  mediationPriority: z.array(AdNetworkTypeSchema).optional(),
});

export const PlatformServiceTypeSchema = z.enum([
  'ai',
  'image',
  'ocr',
  'files',
  'promotion',
  'ads',
]);

export const ServiceQuotaConfigSchema = z.object({
  dailyRequests: z.number().int().nonnegative().optional(),
  monthlyRequests: z.number().int().nonnegative().optional(),
  rateLimitRpm: z.number().int().nonnegative().optional(),
});

export const AppModuleSchema = z.enum([
  'ai',
  'ads',
  'promotion',
  'analytics',
  'health',
  'ocr',
  'image_intelligence',
  'file_intelligence',
  'notifications',
]);

export const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  packageId: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Must be a valid package ID'),
  bundleId: z.string().nullable().optional(),
  platform: PlatformSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Must be semantic version'),
  environment: EnvironmentSchema,
  firebaseProjectId: z.string().nullable().optional(),
  firebaseAndroidAppId: z.string().nullable().optional(),
  firebaseIosAppId: z.string().nullable().optional(),
  fcmSenderId: z.string().nullable().optional(),
  storeUrl: z
    .object({
      android: z.string().url().nullable().optional(),
      ios: z.string().url().nullable().optional(),
    })
    .nullable()
    .optional(),
  adConfig: AppAdConfigSchema.optional(),
  enabledModules: z.array(AppModuleSchema).default([]),
  allowedServices: z.array(PlatformServiceTypeSchema).optional(),
  appKey: z.string().nullable().optional(),
  sdkVersion: z.string().nullable().optional(),
  serviceQuotas: z.record(ServiceQuotaConfigSchema).nullable().optional(),
  killSwitch: z.boolean().nullable().optional(),
});

export const UpdateAppSchema = CreateAppSchema.partial().extend({
  status: StatusSchema.optional(),
});

// ============================================================
// Simplified Per-App Ads Config Schemas
// ============================================================

export const AppAdsFormatConfigSchema = z.object({
  banner: z.boolean().default(true),
  native: z.boolean().default(true),
  interstitial: z.boolean().default(true),
  rewarded: z.boolean().default(true),
  appOpen: z.boolean().default(true),
  rewardedInterstitial: z.boolean().default(false),
});

export const AppAdsNetworkConfigSchema = z.object({
  enabled: z.boolean().default(true),
  admob: z
    .object({
      appId: z.string().optional(),
      bannerId: z.string().optional(),
      nativeId: z.string().optional(),
      interstitialId: z.string().optional(),
      rewardedId: z.string().optional(),
      appOpenId: z.string().optional(),
      rewardedInterstitialId: z.string().optional(),
    })
    .optional(),
  meta: z
    .object({
      placementIds: z.record(z.string()).optional(),
    })
    .optional(),
  applovin: z
    .object({
      sdkKey: z.string().optional(),
      appId: z.string().optional(),
      placementIds: z.record(z.string()).optional(),
    })
    .optional(),
  inmobi: z
    .object({
      accountId: z.string().optional(),
      placementIds: z.record(z.string()).optional(),
    })
    .optional(),
  unity: z
    .object({
      gameId: z.string().optional(),
      placementIds: z.record(z.string()).optional(),
    })
    .optional(),
  wapCustomAds: z
    .object({
      campaignEnabled: z.boolean().optional(),
    })
    .optional(),
});

export const AppSimpleAdsConfigSchema = z.object({
  adsEnabled: z.boolean().default(false),
  environment: z.enum(['testing', 'production']).default('testing'),
  strategy: z.enum(['automatic', 'single_source']).default('automatic').optional(),
  singleSourceNetwork: z
    .enum(['applovin', 'admob', 'meta', 'inmobi', 'unity', 'wapCustomAds'])
    .optional(),
  bundledAdapters: z
    .object({
      applovin: z.boolean().optional(),
      admob: z.boolean().optional(),
      meta: z.boolean().optional(),
      inmobi: z.boolean().optional(),
      unity: z.boolean().optional(),
      wapCustomAds: z.boolean().optional(),
    })
    .optional(),
  enabledFormats: AppAdsFormatConfigSchema,
  networks: z.object({
    applovin: z.boolean().default(false),
    admob: z.boolean().default(false),
    meta: z.boolean().default(false),
    inmobi: z.boolean().default(false).optional(),
    unity: z.boolean().default(false).optional(),
    wapCustomAds: z.boolean().default(false),
  }),
  networkConfig: AppAdsNetworkConfigSchema.optional(),
});

export type AppSimpleAdsConfigInput = z.infer<typeof AppSimpleAdsConfigSchema>;

// ============================================================
// Campaign / Promotion Schemas
// ============================================================


export const FrequencyCapSchema = z.object({
  maxImpressions: z.number().int().positive(),
  periodHours: z.number().int().positive(),
});

export const TargetingRulesSchema = z.object({
  minAppVersion: z.string().optional(),
  maxAppVersion: z.string().optional(),
  platforms: z.array(PlatformSchema).optional(),
  environments: z.array(EnvironmentSchema).optional(),
});

export const HttpUrlSchema = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), {
    message: 'Must be a valid HTTP or HTTPS URL',
  });

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  promotedAppId: z.string().min(1),
  targetAppIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  ctaText: z.string().min(1).max(30),
  storeUrl: HttpUrlSchema,
  imageUrl: HttpUrlSchema.optional(),
  animationUrl: HttpUrlSchema.optional(),
  layoutVariant: LayoutVariantSchema,
  scheduleStart: TimestampSchema.optional(),
  scheduleEnd: TimestampSchema.optional(),
  priority: z.number().int().min(0).max(100).default(50),
  frequencyCap: FrequencyCapSchema.optional(),
  targetingRules: TargetingRulesSchema.optional(),
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  status: CampaignStatusSchema.optional(),
  enabled: z.boolean().optional(),
});

/**
 * Schema for validating promotion-api delivery payloads on the mobile SDK side.
 * Platform-agnostic: same contract used by Flutter SDK and any future native SDK.
 */
export const PromotionPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  campaignId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  animationUrl: z.string().url().optional(),
  ctaText: z.string().optional(),
  storeUrl: z.string().url().optional(),
  layoutVariant: LayoutVariantSchema.optional(),
  expiresAt: TimestampSchema.optional(),
  cacheTtlSeconds: z.number().int().positive(),
  signature: z.string().min(1),
});

/**
 * Query parameters for the promotion-api delivery endpoint.
 * GET /v1/promotion?appId=X&version=Y&env=Z
 */
export const PromotionQuerySchema = z.object({
  appId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  env: EnvironmentSchema.default('production'),
  platform: PlatformSchema.optional(),
});

export const PromotionEventTypeSchema = z.enum(['impression', 'click']);

export const PromotionEventSchema = z.object({
  eventType: PromotionEventTypeSchema,
  campaignId: z.string().min(1),
  appId: z.string().min(1),
  deviceId: z.string().optional(),
  timestamp: TimestampSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================
// AI Provider / Gateway Schemas
// ============================================================

export const AiModelSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  inputCostPer1kTokens: z.number().nonnegative().optional(),
  outputCostPer1kTokens: z.number().nonnegative().optional(),
  maxInputTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
});

export const CreateAiProviderSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Must contain lowercase letters, numbers, hyphens or underscores'),
  name: z.string().min(1).max(100),
  type: AiProviderTypeSchema,
  enabled: z.boolean().default(true),
  baseUrl: HttpUrlSchema.optional(),
  description: z.string().max(500).optional(),
  models: z.array(AiModelSchema).default([]),
  apiKey: z.string().min(1).optional(),
  secretName: z.string().optional(),
  useExistingSecret: z.boolean().optional(),
});

export const UpdateAiProviderSchema = CreateAiProviderSchema.partial().omit({ id: true });

export const FallbackEntrySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  priority: z.number().int().min(1).max(100),
});

export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().min(1).max(100).default(3),
  timeoutMs: z.number().int().min(500).max(120000).default(10000),
  recoveryTimeMs: z.number().int().min(1000).max(600000).default(30000),
});

export const QuotaConfigSchema = z.object({
  dailyRequestLimit: z.number().int().positive().optional(),
  monthlyRequestLimit: z.number().int().positive().optional(),
  dailyTokenLimit: z.number().int().positive().optional(),
  monthlyTokenLimit: z.number().int().positive().optional(),
  rateLimitRpm: z.number().int().positive().optional(),
  perUserDailyRequestLimit: z.number().int().positive().optional(),
  maxInputTokensPerRequest: z.number().int().positive().optional(),
  maxOutputTokensPerRequest: z.number().int().positive().optional(),
});

export const CreateAiPolicySchema = z.object({
  appId: z.string().min(1),
  feature: z.string().min(1).max(100),
  primaryProviderId: z.string().min(1),
  primaryModelId: z.string().min(1),
  fallbackChain: z.array(FallbackEntrySchema).default([]),
  quotas: QuotaConfigSchema.default({}),
  circuitBreaker: CircuitBreakerConfigSchema.optional(),
  priority: z.number().int().min(1).max(100).default(50),
  enabled: z.boolean().default(true),
});

export const UpdateAiPolicySchema = CreateAiPolicySchema.partial();

export const GatewayRequestSchema = z.object({
  appId: z.string().min(1),
  version: z.string().min(1),
  environment: EnvironmentSchema,
  feature: z.string().min(1).max(50),
  modelPreference: z.string().optional(),
  payload: z.object({
    type: z.enum(['generate', 'analyze_image', 'embed']),
    prompt: z.string().max(32000).optional(),
    imageData: z.string().optional(), // base64
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string().max(32000),
        }),
      )
      .optional(),
    maxTokens: z.number().int().positive().max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  requestId: z.string().uuid(),
});

export const AiPlaygroundRequestSchema = z.object({
  providerId: z.string().min(1, 'Provider is required'),
  modelId: z.string().min(1, 'Model is required'),
  prompt: z.string().min(1, 'User prompt is required').max(32000),
  systemPrompt: z.string().max(32000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32768).optional(),
});

// ============================================================
// Feature Flag Schemas
// ============================================================

export const FeatureFlagValueSchema = z.union([z.boolean(), z.string(), z.number()]);

export const UpsertFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case'),
  description: z.string().min(1).max(500),
  value: FeatureFlagValueSchema,
  type: z.enum(['boolean', 'string', 'number']),
  scope: z.enum(['global', 'per_app', 'per_environment']),
  appId: z.string().optional(),
  environment: EnvironmentSchema.optional(),
  enabled: z.boolean().default(true),
});

// ============================================================
// Type inference helpers
// ============================================================

export type CreateAppInput = z.infer<typeof CreateAppSchema>;
export type UpdateAppInput = z.infer<typeof UpdateAppSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type GatewayRequestInput = z.infer<typeof GatewayRequestSchema>;
export type PromotionQuery = z.infer<typeof PromotionQuerySchema>;
export type PromotionEventInput = z.infer<typeof PromotionEventSchema>;
export type UpsertFeatureFlagInput = z.infer<typeof UpsertFeatureFlagSchema>;
export type CreateAiProviderInput = z.input<typeof CreateAiProviderSchema>;
export type UpdateAiProviderInput = z.input<typeof UpdateAiProviderSchema>;
export type CreateAiPolicyInput = z.input<typeof CreateAiPolicySchema>;
export type UpdateAiPolicyInput = z.input<typeof UpdateAiPolicySchema>;
export type AiModelInput = z.infer<typeof AiModelSchema>;
export type AiPlaygroundRequestInput = z.infer<typeof AiPlaygroundRequestSchema>;
export type CircuitBreakerConfigInput = z.infer<typeof CircuitBreakerConfigSchema>;

// ============================================================
// Cost Alert & Retention Schemas
// ============================================================

export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const AlertMetricTypeSchema = z.enum([
  'daily_cost_usd',
  'monthly_cost_usd',
  'daily_tokens',
  'monthly_tokens',
  'error_rate_pct',
]);

export const CreateCostAlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  appId: z.string().optional(),
  metric: AlertMetricTypeSchema,
  threshold: z.number().positive(),
  enabled: z.boolean().default(true),
  notifyEmails: z.array(z.string().email()).default([]),
});

export const CostAlertRuleSchema = CreateCostAlertRuleSchema.extend({
  id: z.string().min(1),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DataRetentionPolicySchema = z.object({
  usageEventsTtlDays: z.number().int().min(1).max(3650).default(90),
  promotionEventsTtlDays: z.number().int().min(1).max(3650).default(90),
  auditLogsTtlDays: z.number().int().min(1).max(3650).default(365),
  lastPrunedAt: TimestampSchema.optional(),
  prunedCount: z.number().int().nonnegative().optional(),
});

export type CreateCostAlertRuleInput = z.input<typeof CreateCostAlertRuleSchema>;
export type DataRetentionPolicyInput = z.input<typeof DataRetentionPolicySchema>;

// ============================================================
// Infrastructure Health & Alerts Schemas (Phase 11)
// ============================================================

export const HealthStatusLevelSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);

export const ServiceCategorySchema = z.enum([
  'api',
  'infrastructure',
  'ai_provider',
  'ai_server',
  'worker',
]);

export const InfrastructureAlertMetricSchema = z.enum([
  'latency_ms',
  'error_rate_pct',
  'consecutive_failures',
  'gpu_usage_pct',
  'vram_usage_pct',
  'queue_depth',
]);

export const InfrastructureAlertSeveritySchema = z.enum(['warning', 'critical']);

export const CreateInfrastructureAlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  targetServiceId: z.string().min(1),
  metric: InfrastructureAlertMetricSchema,
  threshold: z.number().positive(),
  severity: InfrastructureAlertSeveritySchema,
  enabled: z.boolean().default(true),
  notifyEmails: z.array(z.string().email()).default([]),
});

export const InfrastructureAlertRuleSchema = CreateInfrastructureAlertRuleSchema.extend({
  id: z.string().min(1),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DetailedServiceHealthSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  category: ServiceCategorySchema,
  status: HealthStatusLevelSchema,
  latencyMs: z.number().nonnegative(),
  errorRatePct: z.number().min(0).max(100),
  uptimePct30d: z.number().min(0).max(100),
  consecutiveFailures: z.number().int().nonnegative(),
  lastCheckedAt: TimestampSchema,
  endpoint: z.string().optional(),
  region: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
});

export const AiServerMetricsSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1),
  status: HealthStatusLevelSchema,
  cpuUsagePct: z.number().min(0).max(100),
  memoryUsedMb: z.number().nonnegative(),
  memoryTotalMb: z.number().positive(),
  gpuUsagePct: z.number().min(0).max(100),
  vramUsedMb: z.number().nonnegative(),
  vramTotalMb: z.number().positive(),
  queueDepth: z.number().int().nonnegative(),
  activeStreams: z.number().int().nonnegative(),
  avgLatencyMs: z.number().nonnegative(),
  temperatureC: z.number().nonnegative(),
  modelLoaded: z.string().min(1),
  reportedAt: TimestampSchema,
});

export type CreateInfrastructureAlertRuleInput = z.input<
  typeof CreateInfrastructureAlertRuleSchema
>;
export type InfrastructureAlertRuleInput = z.infer<typeof InfrastructureAlertRuleSchema>;
export type DetailedServiceHealthInput = z.infer<typeof DetailedServiceHealthSchema>;
export type AiServerMetricsInput = z.infer<typeof AiServerMetricsSchema>;

// ============================================================
// Platform Services Validation Schemas (/api/platform/v1/*)
// ============================================================

export const PlatformExecutionSourceSchema = z.enum([
  'on_device',
  'wap_engine',
  'external_provider',
]);

// ------------------------------------------------------------
// A. AI Services Schemas
// ------------------------------------------------------------

export const PlatformChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(32000),
});

export const PlatformAiGenerateRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  prompt: z.string().max(32000).optional(),
  messages: z.array(PlatformChatMessageSchema).optional(),
  systemPrompt: z.string().max(32000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32768).optional(),
  modelPreference: z.string().optional(),
});

export const PlatformAiVisionRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  prompt: z.string().max(10000).default('Analyze this image and describe its key elements.'),
  imageData: z.string().min(1, 'imageData (base64 or URL) is required'),
  maxTokens: z.number().int().positive().max(8192).optional(),
});

export const PlatformAiClassifyRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  text: z.string().min(1).max(32000),
  candidateLabels: z.array(z.string().min(1)).min(2),
  multiLabel: z.boolean().default(false),
});

export const PlatformAiSummarizeRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  text: z.string().min(1).max(64000),
  maxLength: z.number().int().positive().optional(),
  format: z.enum(['paragraph', 'bullet_points', 'key_takeaways']).default('paragraph'),
});

export const PlatformAiTranslateRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  text: z.string().min(1).max(32000),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().min(2).max(10),
});

export const PlatformAiExtractRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  text: z.string().min(1).max(64000),
  targetFields: z.array(z.string().min(1)).min(1),
  schemaDefinition: z.record(z.string()).optional(),
});

// ------------------------------------------------------------
// B. Image Intelligence Schemas
// ------------------------------------------------------------

export const ImageOperationSchema = z.enum([
  'enhance',
  'super_resolution',
  'upscale',
  'denoise',
  'sharpen',
  'deblur',
  'hdr',
  'low_light',
  'color_correct',
  'face_enhance',
  'restore',
  'compress',
  'quality_analysis',
]);

export const PlatformImageEnhanceRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  operation: ImageOperationSchema,
  imageData: z.string().min(1, 'imageData is required'),
  scaleFactor: z.union([z.literal(2), z.literal(4)]).optional(),
  qualityPreset: z.enum(['fast', 'balanced', 'high_quality']).default('balanced'),
  preferLocal: z.boolean().default(true),
  options: z
    .object({
      denoiseStrength: z.number().min(0).max(1).optional(),
      sharpenAmount: z.number().min(0).max(1).optional(),
      hdrIntensity: z.number().min(0).max(1).optional(),
      targetFormat: z.enum(['jpeg', 'png', 'webp']).optional(),
      maxDimension: z.number().int().positive().optional(),
    })
    .optional(),
});

export const PlatformImageAnalyzeRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  imageData: z.string().min(1, 'imageData is required'),
  checks: z
    .array(
      z.enum(['quality_score', 'blur_detection', 'resolution_check', 'face_detection']),
    )
    .optional(),
});

// ------------------------------------------------------------
// C. OCR / Document Intelligence Schemas
// ------------------------------------------------------------

export const DocumentTypeSchema = z.enum([
  'general',
  'receipt',
  'invoice',
  'id_card',
  'document',
  'form',
]);

export const PlatformOcrExtractRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  imageData: z.string().optional(),
  pdfData: z.string().optional(),
  documentType: DocumentTypeSchema.default('general'),
  languages: z.array(z.string().min(2)).default(['en']),
  structuredExtract: z.boolean().default(false),
  preferLocal: z.boolean().default(true),
}).refine((data) => data.imageData || data.pdfData, {
  message: 'Either imageData or pdfData must be provided',
});

// ------------------------------------------------------------
// D. File Intelligence Schemas
// ------------------------------------------------------------

export const FileCandidateMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  extension: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  dateCreated: z.string().optional(),
  dateModified: z.string().optional(),
  extractedSnippet: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const PlatformFileSearchRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  query: z.string().min(1).max(500),
  localCandidates: z.array(FileCandidateMetadataSchema).max(500).optional(),
  limit: z.number().int().positive().max(100).default(20),
  targetCategory: z.string().optional(),
});

export const ClassifiedFileInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  extension: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional(),
  sampleText: z.string().max(2000).optional(),
});

export const PlatformFileClassifyRequestSchema = z.object({
  appId: z.string().min(1),
  requestId: z.string().optional(),
  files: z.array(ClassifiedFileInputSchema).min(1).max(100),
});

// ------------------------------------------------------------
// E. Platform Kill Switches & Health Schemas
// ------------------------------------------------------------

export const PlatformKillSwitchConfigSchema = z.object({
  global: z.boolean().default(false),
  services: z.record(PlatformServiceTypeSchema, z.boolean()).default({}),
  apps: z.record(z.string(), z.boolean()).default({}),
  providers: z.record(z.string(), z.boolean()).default({}),
});

// Type inference exports
export type PlatformAiGenerateRequestInput = z.infer<typeof PlatformAiGenerateRequestSchema>;
export type PlatformAiVisionRequestInput = z.infer<typeof PlatformAiVisionRequestSchema>;
export type PlatformAiClassifyRequestInput = z.infer<typeof PlatformAiClassifyRequestSchema>;
export type PlatformAiSummarizeRequestInput = z.infer<typeof PlatformAiSummarizeRequestSchema>;
export type PlatformAiTranslateRequestInput = z.infer<typeof PlatformAiTranslateRequestSchema>;
export type PlatformAiExtractRequestInput = z.infer<typeof PlatformAiExtractRequestSchema>;
export type PlatformImageEnhanceRequestInput = z.infer<typeof PlatformImageEnhanceRequestSchema>;
export type PlatformImageAnalyzeRequestInput = z.infer<typeof PlatformImageAnalyzeRequestSchema>;
export type PlatformOcrExtractRequestInput = z.infer<typeof PlatformOcrExtractRequestSchema>;
export type PlatformFileSearchRequestInput = z.infer<typeof PlatformFileSearchRequestSchema>;
export type PlatformFileClassifyRequestInput = z.infer<typeof PlatformFileClassifyRequestSchema>;
export type PlatformKillSwitchConfigInput = z.infer<typeof PlatformKillSwitchConfigSchema>;

// ============================================================
// Ads & Monetization Control Center Schemas
// ============================================================

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  lastCheckedAt: z.string().optional(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

export const AdNetworkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  environmentMode: z.enum(['test', 'production']),
  secretReferenceName: z.string().optional(),
  configured: z.boolean().default(false),
  supportedFormats: z.array(AdFormatSchema),
  priority: z.number().int().min(1).max(100),
  healthStatus: HealthStatusSchema.default({ status: 'unknown' }),
  notes: z.string().optional(),
  allowedAppIds: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreateAdNetworkSchema = AdNetworkSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  configured: z.boolean().default(false).optional(),
  healthStatus: HealthStatusSchema.default({ status: 'unknown' }).optional(),
});

export const UpdateAdNetworkSchema = AdNetworkSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const FormatToggleConfigSchema = z.object({
  enabled: z.boolean(),
  testMode: z.boolean().optional(),
  refreshIntervalSeconds: z.number().int().min(30).default(60).optional(),
  cooldownSeconds: z.number().int().nonnegative().optional(),
  sessionCap: z.number().int().nonnegative().optional(),
  dailyCap: z.number().int().nonnegative().optional(),
});

export const AdAppConfigSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  appName: z.string().optional(),
  masterEnabled: z.boolean(),
  formats: z.record(AdFormatSchema, FormatToggleConfigSchema),
  networkSettings: z
    .record(
      z.string(),
      z.object({
        enabled: z.boolean(),
        appIdOrSdkKey: z.string().optional(),
      }),
    )
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const UpdateAdAppConfigSchema = AdAppConfigSchema.partial().omit({
  id: true,
  appId: true,
  createdAt: true,
});

export const AdUnitDocSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  networkId: z.string().min(1),
  format: AdFormatSchema,
  platform: z.enum(['android', 'ios', 'all']),
  name: z.string().min(1),
  adUnitId: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreateAdUnitDocSchema = AdUnitDocSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().min(1).optional(),
});

export const UpdateAdUnitDocSchema = AdUnitDocSchema.partial().omit({
  id: true,
  appId: true,
  createdAt: true,
});

export const AdPlacementDocSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  placementKey: z.string().min(1),
  name: z.string().min(1),
  format: AdFormatSchema,
  enabled: z.boolean(),
  cooldownSeconds: z.number().int().nonnegative().optional(),
  sessionCap: z.number().int().nonnegative().optional(),
  dailyCap: z.number().int().nonnegative().optional(),
  foregroundRule: z
    .enum(['always', 'after_background_30s', 'cold_start_only'])
    .optional(),
  screenLocation: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreateAdPlacementDocSchema = AdPlacementDocSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().min(1).optional(),
});

export const UpdateAdPlacementDocSchema = AdPlacementDocSchema.partial().omit({
  id: true,
  appId: true,
  createdAt: true,
});

export const AdMediationTierSchema = z.object({
  networkId: z.string().min(1),
  priority: z.number().int().min(1).max(100),
  enabled: z.boolean(),
  weight: z.number().min(0).max(100).optional(),
  timeoutMs: z.number().int().min(500).max(30000).optional(),
});

export const AdRotationPolicySchema = z.object({
  id: z.string().min(1).optional(),
  appId: z.string().min(1),
  format: AdFormatSchema,
  tiers: z.array(AdMediationTierSchema),
  fallbackToCustomAds: z.boolean().default(true),
  bannerRefreshIntervalSeconds: z.number().int().min(30).default(60),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const UpdateAdRotationPolicySchema = AdRotationPolicySchema.partial().omit({
  id: true,
  appId: true,
  format: true,
  createdAt: true,
});

export const AdFormatFrequencySchema = z.object({
  minIntervalSeconds: z.number().int().nonnegative().default(0),
  cooldownSeconds: z.number().int().nonnegative().default(0),
  sessionCap: z.number().int().nonnegative().default(0),
  dailyCap: z.number().int().nonnegative().default(0),
  perUserCap: z.number().int().nonnegative().optional(),
  appForegroundRule: z
    .enum(['always', 'min_background_30s', 'disabled'])
    .optional(),
});

export const AdFrequencyPolicySchema = z.object({
  id: z.string().min(1).optional(),
  appId: z.string().min(1),
  formats: z.record(AdFormatSchema, AdFormatFrequencySchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const UpdateAdFrequencyPolicySchema = AdFrequencyPolicySchema.partial().omit({
  id: true,
  appId: true,
  createdAt: true,
});

export const AdSafetyPolicySchema = z.object({
  id: z.string().min(1).optional(),
  appId: z.string().min(1),
  blockedCategories: z.array(z.string()),
  maxAdRating: z.enum(['G', 'PG', 'T', 'MA']),
  blockSensitiveCategories: z.boolean().default(true),
  childDirectedApp: z.boolean().default(false),
  customBlockedKeywords: z.array(z.string()).optional(),
  disclaimer: z.string().default(
    'WAPCentral applies category blocklists and safety restrictions to network requests where supported. Third-party network ad-serving cannot be 100% controlled client-side; emergency kill switches are available.',
  ),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const UpdateAdSafetyPolicySchema = AdSafetyPolicySchema.partial().omit({
  id: true,
  appId: true,
  createdAt: true,
});

export const AdKillSwitchesSchema = z.object({
  id: z.string().default('current'),
  globalAdsDisabled: z.boolean().default(false),
  networks: z.record(z.string(), z.boolean()).default({}),
  apps: z.record(z.string(), z.boolean()).default({}),
  formats: z.record(AdFormatSchema, z.boolean()).default({
    banner: false,
    native: false,
    interstitial: false,
    rewarded: false,
    app_open: false,
    rewarded_interstitial: false,
  }),
  placements: z.record(z.string(), z.boolean()).default({}),
  customAdsDisabled: z.boolean().default(false),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  reason: z.string().optional(),
});

export const UpdateAdKillSwitchesSchema = AdKillSwitchesSchema.partial().omit({
  id: true,
});

export const CreativeTypeSchema = z.enum([
  'image',
  'video',
  'animated',
  'native_card',
  'carousel',
]);

export const CarouselItemSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  ctaText: z.string().optional(),
  destinationUrl: z.string().optional(),
});

export const CustomAdCreativeSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  format: z.enum(['banner', 'native', 'video', 'interstitial']),
  creativeType: CreativeTypeSchema.optional(),
  title: z.string().optional(),
  headline: z.string().optional(),
  bodyText: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  animationUrl: z.string().optional(),
  animationType: z.enum(['gif', 'lottie']).optional(),
  iconUrl: z.string().optional(),
  callToAction: z.string().optional(),
  destinationUrl: z.string().optional(),
  aspectRatio: z.string().optional(),
  storagePath: z.string().optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  carouselItems: z.array(CarouselItemSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CustomAdCampaignSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  ctaText: z.string().min(1),
  destinationUrl: z.string().min(1),
  targetApps: z.array(z.string()).min(1),
  targetAppId: z.string().optional(),
  creativeType: CreativeTypeSchema.default('image').optional(),
  placements: z.array(AdFormatSchema).optional(),
  startDate: z.string(),
  endDate: z.string(),
  priority: z.number().int().min(1).max(100).default(50),
  enabled: z.boolean().default(true),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('active'),
  impressionsCount: z.number().int().nonnegative().default(0),
  clicksCount: z.number().int().nonnegative().default(0),
  creatives: z.array(CustomAdCreativeSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const CreateCustomAdCampaignSchema = CustomAdCampaignSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().min(1).optional(),
  description: z.string().default(''),
  endDate: z.string().optional(),
  enabled: z.boolean().default(true).optional(),
  impressionsCount: z.number().int().nonnegative().default(0).optional(),
  clicksCount: z.number().int().nonnegative().default(0).optional(),
});

export const UpdateCustomAdCampaignSchema = CustomAdCampaignSchema.partial().omit({
  id: true,
  createdAt: true,
});

export const PlatformAdTrackRequestSchema = z.object({
  appId: z.string().min(1),
  campaignId: z.string().min(1),
  creativeId: z.string().optional(),
  type: z.enum(['impression', 'click']),
  format: AdFormatSchema.optional(),
  placementKey: z.string().optional(),
});

// Infer input types
export type CreateAdNetworkInput = z.infer<typeof CreateAdNetworkSchema>;
export type UpdateAdNetworkInput = z.infer<typeof UpdateAdNetworkSchema>;
export type AdAppConfigInput = z.infer<typeof AdAppConfigSchema>;
export type UpdateAdAppConfigInput = z.infer<typeof UpdateAdAppConfigSchema>;
export type CreateAdUnitDocInput = z.infer<typeof CreateAdUnitDocSchema>;
export type UpdateAdUnitDocInput = z.infer<typeof UpdateAdUnitDocSchema>;
export type CreateAdPlacementDocInput = z.infer<typeof CreateAdPlacementDocSchema>;
export type UpdateAdPlacementDocInput = z.infer<typeof UpdateAdPlacementDocSchema>;
export type AdRotationPolicyInput = z.infer<typeof AdRotationPolicySchema>;
export type UpdateAdRotationPolicyInput = z.infer<typeof UpdateAdRotationPolicySchema>;
export type AdFrequencyPolicyInput = z.infer<typeof AdFrequencyPolicySchema>;
export type UpdateAdFrequencyPolicyInput = z.infer<typeof UpdateAdFrequencyPolicySchema>;
export type AdSafetyPolicyInput = z.infer<typeof AdSafetyPolicySchema>;
export type UpdateAdSafetyPolicyInput = z.infer<typeof UpdateAdSafetyPolicySchema>;
export type UpdateAdKillSwitchesInput = z.infer<typeof UpdateAdKillSwitchesSchema>;
export type CreateCustomAdCampaignInput = z.infer<typeof CreateCustomAdCampaignSchema>;
export type UpdateCustomAdCampaignInput = z.infer<typeof UpdateCustomAdCampaignSchema>;
export type PlatformAdTrackRequestInput = z.infer<typeof PlatformAdTrackRequestSchema>;

// ============================================================
// Notification System Schemas (Step 3)
// ============================================================

export const NotificationTypeSchema = z.enum([
  'global',
  'app_specific',
  'system',
  'important',
  'announcement',
  'maintenance',
  'update',
  'promotion',
  'custom',
]);

export const NotificationCategorySchema = z.enum([
  'SYSTEM',
  'IMPORTANT',
  'SECURITY',
  'UPDATE',
  'FEATURE',
  'PROMOTION',
  'MAINTENANCE',
  'CUSTOM',
]);

export const NotificationPrioritySchema = z.enum(['normal', 'high', 'urgent']);

export const NotificationStatusSchema = z.enum([
  'draft',
  'scheduled',
  'queued',
  'sent',
  'partially_delivered',
  'delivered',
  'failed',
  'cancelled',
  'expired',
]);

export const NotificationDeliveryStatusSchema = z.enum([
  'queued',
  'sent',
  'delivered',
  'opened',
  'failed',
  'expired',
]);

export const NotificationTargetTypeSchema = z.enum([
  'all_apps',
  'specific_app',
  'multiple_apps',
  'device_token',
]);

export const CreateNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  category: NotificationCategorySchema.default('SYSTEM'),
  type: NotificationTypeSchema.default('system'),
  priority: NotificationPrioritySchema.default('normal'),
  targetType: NotificationTargetTypeSchema.default('all_apps'),
  targetAppIds: z.array(z.string().min(1)).default([]),
  targetAppId: z.string().optional(),
  targetDeviceTokens: z.array(z.string().min(1)).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  icon: z.string().optional(),
  deepLink: z.string().optional(),
  externalUrl: z.string().url().optional().or(z.literal('')),
  sound: z.string().optional(),
  badge: z.number().int().nonnegative().optional(),
  dataPayload: z.record(z.string()).optional(),
  campaignId: z.string().optional(),
  templateId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  isMandatory: z.boolean().default(false),
  schedule: z.string().optional(),
  scheduledAt: z.string().optional(),
  expiry: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
});

export const UpdateNotificationSchema = CreateNotificationSchema.partial().extend({
  status: NotificationStatusSchema.optional(),
});

export const CreateNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  category: NotificationCategorySchema.default('SYSTEM'),
  type: NotificationTypeSchema.default('system'),
  priority: NotificationPrioritySchema.default('normal'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  icon: z.string().optional(),
  deepLink: z.string().optional(),
  sound: z.string().optional(),
  badge: z.number().int().nonnegative().optional(),
  dataPayload: z.record(z.string()).optional(),
  variables: z.array(z.string()).default([]),
});

export const UpdateNotificationTemplateSchema = CreateNotificationTemplateSchema.partial();

export const RegisterNotificationDeviceSchema = z.object({
  appId: z.string().min(1),
  deviceId: z.string().min(1),
  fcmToken: z.string().min(1),
  platform: PlatformSchema.default('android'),
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
});

export const UnregisterNotificationDeviceSchema = z.object({
  appId: z.string().min(1),
  deviceId: z.string().min(1),
  fcmToken: z.string().optional(),
});

export const UpdateNotificationPreferencesSchema = z.object({
  appId: z.string().min(1),
  deviceId: z.string().min(1),
  notificationsEnabled: z.boolean().default(true),
  promotionalEnabled: z.boolean().default(true),
  categories: z.record(z.boolean()).default({}),
});

export const UpdateNotificationSettingsSchema = z.object({
  globalNotificationsOff: z.boolean().optional(),
  appKillSwitches: z.record(z.boolean()).optional(),
  categoryKillSwitches: z.record(z.boolean()).optional(),
  campaignKillSwitches: z.record(z.boolean()).optional(),
});

export const PlatformNotificationEventRequestSchema = z.object({
  appId: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  category: NotificationCategorySchema.default('SYSTEM'),
  priority: NotificationPrioritySchema.default('high'),
  deepLink: z.string().optional(),
  dataPayload: z.record(z.string()).optional(),
  targetDeviceTokens: z.array(z.string().min(1)).optional(),
});

export const TrackNotificationEventSchema = z.object({
  appId: z.string().min(1),
  notificationId: z.string().min(1),
  deviceId: z.string().min(1),
  event: z.enum(['delivered', 'opened']),
});

export type CreateNotificationInput = z.input<typeof CreateNotificationSchema>;
export type UpdateNotificationInput = z.input<typeof UpdateNotificationSchema>;
export type CreateNotificationTemplateInput = z.input<typeof CreateNotificationTemplateSchema>;
export type UpdateNotificationTemplateInput = z.input<typeof UpdateNotificationTemplateSchema>;
export type RegisterNotificationDeviceInput = z.input<typeof RegisterNotificationDeviceSchema>;
export type UnregisterNotificationDeviceInput = z.input<typeof UnregisterNotificationDeviceSchema>;
export type UpdateNotificationPreferencesInput = z.input<typeof UpdateNotificationPreferencesSchema>;
export type UpdateNotificationSettingsInput = z.input<typeof UpdateNotificationSettingsSchema>;
export type PlatformNotificationEventRequestInput = z.input<typeof PlatformNotificationEventRequestSchema>;
export type TrackNotificationEventInput = z.input<typeof TrackNotificationEventSchema>;

// ============================================================
// Analytics & Revenue Intelligence Schemas (Step 4)
// ============================================================

export const AdEventTypeSchema = z.enum([
  'request',
  'fill',
  'impression',
  'click',
  'failure',
  'reward',
  'provider_selection',
  'fallback',
]);

export const AdTelemetryEventInputSchema = z.object({
  requestId: z.string().min(1).max(128),
  eventType: AdEventTypeSchema,
  adFormat: AdFormatSchema,
  provider: z.string().min(1).max(64),
  placementId: z.string().max(128).optional(),
  adUnitId: z.string().max(128).optional(),
  campaignId: z.string().max(128).optional(),
  creativeId: z.string().max(128).optional(),
  rewardType: z.string().max(64).optional(),
  rewardAmount: z.number().nonnegative().optional(),
  failureReason: z.string().max(1000).optional(),
  errorCode: z.string().max(100).optional(),
  latencyMs: z.number().nonnegative().optional(),
  environment: z.enum(['development', 'staging', 'production']).default('production').optional(),
  platform: PlatformSchema.optional(),
  appVersion: z.string().max(50).optional(),
  sdkVersion: z.string().max(50).optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const BatchAdTelemetryEventSchema = z.object({
  events: z.array(AdTelemetryEventInputSchema).min(1).max(100),
});

export const AnalyticsDateRangeQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD').optional(),
  appId: z.string().optional(),
  provider: z.string().optional(),
  format: AdFormatSchema.optional(),
  preset: z.enum(['today', 'yesterday', '7d', '30d', 'all']).optional(),
});

export const AnalyticsExportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  appId: z.string().optional(),
  provider: z.string().optional(),
  format: z.string().optional(),
  type: z.enum(['csv', 'json']).default('json'),
});

export const AnalyticsAggregationTriggerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().default(false).optional(),
});

export type AdTelemetryEventInput = z.input<typeof AdTelemetryEventInputSchema>;
export type BatchAdTelemetryEventInput = z.input<typeof BatchAdTelemetryEventSchema>;
export type AnalyticsDateRangeQueryInput = z.input<typeof AnalyticsDateRangeQuerySchema>;
export type AnalyticsExportQueryInput = z.input<typeof AnalyticsExportQuerySchema>;
export type AnalyticsAggregationTriggerInput = z.input<typeof AnalyticsAggregationTriggerSchema>;



