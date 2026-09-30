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

export const AppAdConfigSchema = z.object({
  admob: AdMobConfigSchema.optional(),
  meta: MetaAdConfigSchema.optional(),
  applovin: AppLovinConfigSchema.optional(),
  wapads: WapAdsConfigSchema.optional(),
});

export const AppModuleSchema = z.enum(['ai', 'ads', 'promotion', 'analytics', 'health']);

export const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  packageId: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Must be a valid package ID'),
  bundleId: z.string().optional(),
  platform: PlatformSchema,
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+/, 'Must be semantic version'),
  environment: EnvironmentSchema,
  firebaseProjectId: z.string().optional(),
  storeUrl: z
    .object({
      android: z.string().url().optional(),
      ios: z.string().url().optional(),
    })
    .optional(),
  adConfig: AppAdConfigSchema.optional(),
  enabledModules: z.array(AppModuleSchema).default([]),
});

export const UpdateAppSchema = CreateAppSchema.partial().extend({
  status: StatusSchema.optional(),
});

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

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  promotedAppId: z.string().min(1),
  targetAppIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  ctaText: z.string().min(1).max(30),
  storeUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  animationUrl: z.string().url().optional(),
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

// ============================================================
// AI Provider / Gateway Schemas
// ============================================================

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
export type UpsertFeatureFlagInput = z.infer<typeof UpsertFeatureFlagSchema>;
