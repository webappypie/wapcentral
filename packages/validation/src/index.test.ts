/**
 * @wapcentral/validation — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  CreateAppSchema,
  CreateCampaignSchema,
  PromotionPayloadSchema,
  PromotionQuerySchema,
  GatewayRequestSchema,
  UpsertFeatureFlagSchema,
  PlatformAiGenerateRequestSchema,
  PlatformImageEnhanceRequestSchema,
  PlatformOcrExtractRequestSchema,
  PlatformFileSearchRequestSchema,
  PlatformFileClassifyRequestSchema,
} from './index.js';

describe('CreateAppSchema', () => {
  it('should accept a valid app', () => {
    const result = CreateAppSchema.safeParse({
      name: 'My App',
      packageId: 'com.webappypie.myapp',
      platform: 'android',
      version: '1.0.0',
      environment: 'development',
      enabledModules: ['promotion'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid packageId', () => {
    const result = CreateAppSchema.safeParse({
      name: 'My App',
      packageId: 'InvalidPackage',
      platform: 'android',
      version: '1.0.0',
      environment: 'development',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid platform', () => {
    const result = CreateAppSchema.safeParse({
      name: 'My App',
      packageId: 'com.webappypie.myapp',
      platform: 'windows', // invalid
      version: '1.0.0',
      environment: 'development',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateCampaignSchema', () => {
  const validCampaign = {
    name: 'Test Campaign',
    promotedAppId: 'app-001',
    targetAppIds: ['app-002'],
    title: 'Try our app!',
    description: 'Download now.',
    ctaText: 'Install',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.test',
    layoutVariant: 'banner',
  };

  it('should accept a valid campaign', () => {
    const result = CreateCampaignSchema.safeParse(validCampaign);
    expect(result.success).toBe(true);
  });

  it('should reject empty targetAppIds', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, targetAppIds: [] });
    expect(result.success).toBe(false);
  });

  it('should reject invalid storeUrl', () => {
    const result = CreateCampaignSchema.safeParse({ ...validCampaign, storeUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should apply default priority of 50', () => {
    const result = CreateCampaignSchema.safeParse(validCampaign);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(50);
    }
  });
});

describe('PromotionPayloadSchema', () => {
  it('should accept a valid promotion payload', () => {
    const result = PromotionPayloadSchema.safeParse({
      schemaVersion: 1,
      enabled: true,
      campaignId: 'campaign-001',
      title: 'Try App X',
      description: 'Check it out!',
      ctaText: 'Install',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.appx',
      layoutVariant: 'banner',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      cacheTtlSeconds: 21600,
      signature: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept disabled payload (no campaign fields required)', () => {
    const result = PromotionPayloadSchema.safeParse({
      schemaVersion: 1,
      enabled: false,
      cacheTtlSeconds: 3600,
      signature: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong schemaVersion', () => {
    const result = PromotionPayloadSchema.safeParse({
      schemaVersion: 2,
      enabled: false,
      cacheTtlSeconds: 3600,
      signature: 'abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('PromotionQuerySchema', () => {
  it('should accept valid query params', () => {
    const result = PromotionQuerySchema.safeParse({
      appId: 'app-001',
      version: '1.0.0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env).toBe('production'); // default
    }
  });

  it('should reject missing appId', () => {
    const result = PromotionQuerySchema.safeParse({ version: '1.0.0' });
    expect(result.success).toBe(false);
  });
});

describe('GatewayRequestSchema', () => {
  it('should accept a valid gateway request', () => {
    const result = GatewayRequestSchema.safeParse({
      appId: 'app-001',
      version: '1.0.0',
      environment: 'production',
      feature: 'chat',
      payload: {
        type: 'generate',
        prompt: 'Hello, world!',
        maxTokens: 500,
      },
      requestId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID requestId', () => {
    const result = GatewayRequestSchema.safeParse({
      appId: 'app-001',
      version: '1.0.0',
      environment: 'production',
      feature: 'chat',
      payload: { type: 'generate', prompt: 'Hello' },
      requestId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpsertFeatureFlagSchema', () => {
  it('should accept valid snake_case key', () => {
    const result = UpsertFeatureFlagSchema.safeParse({
      key: 'promotion_enabled',
      description: 'Enable promotion system',
      value: true,
      type: 'boolean',
      scope: 'global',
    });
    expect(result.success).toBe(true);
  });

  it('should reject camelCase key', () => {
    const result = UpsertFeatureFlagSchema.safeParse({
      key: 'promotionEnabled',
      description: 'Enable promotion system',
      value: true,
      type: 'boolean',
      scope: 'global',
    });
    expect(result.success).toBe(false);
  });
});

describe('Platform Services Schemas', () => {
  it('should accept valid PlatformAiGenerateRequest', () => {
    const result = PlatformAiGenerateRequestSchema.safeParse({
      appId: 'filezen',
      prompt: 'Summarize this file content',
      temperature: 0.5,
      maxTokens: 500,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid PlatformImageEnhanceRequest', () => {
    const result = PlatformImageEnhanceRequestSchema.safeParse({
      appId: 'optilens',
      operation: 'enhance',
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      scaleFactor: 2,
      preferLocal: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid PlatformOcrExtractRequest with base64 data', () => {
    const result = PlatformOcrExtractRequestSchema.safeParse({
      appId: 'filezen',
      imageData: 'base64_img_data',
      documentType: 'receipt',
      languages: ['en', 'hi'],
      structuredExtract: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject PlatformOcrExtractRequest without image or pdf data', () => {
    const result = PlatformOcrExtractRequestSchema.safeParse({
      appId: 'filezen',
      documentType: 'receipt',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid PlatformFileSearchRequest with local candidates', () => {
    const result = PlatformFileSearchRequestSchema.safeParse({
      appId: 'filezen',
      query: '2025 ka electricity bill dhundo',
      localCandidates: [
        {
          id: 'doc_1',
          name: 'Jan_2025_Electricity_Bill.pdf',
          extension: 'pdf',
          tags: ['bill', 'electricity'],
        },
      ],
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid PlatformFileClassifyRequest', () => {
    const result = PlatformFileClassifyRequestSchema.safeParse({
      appId: 'filezen',
      files: [
        {
          id: 'file_1',
          name: 'salary_slip_march.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10240,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Ads & Monetization Control Center Schemas', () => {
  it('should validate AdNetworkSchema with valid fields', async () => {
    const { AdNetworkSchema } = await import('./index.js');
    const result = AdNetworkSchema.safeParse({
      id: 'admob',
      name: 'Google AdMob',
      enabled: true,
      environmentMode: 'production',
      secretReferenceName: 'ADMOB_REPORTING_CREDENTIALS',
      configured: true,
      supportedFormats: ['banner', 'interstitial', 'rewarded', 'native', 'app_open', 'rewarded_interstitial'],
      priority: 1,
      healthStatus: { status: 'healthy', latencyMs: 120 },
      allowedAppIds: ['filezen', 'optilens'],
    });
    expect(result.success).toBe(true);
  });

  it('should validate AdAppConfig with all 6 format controls', async () => {
    const { AdAppConfigSchema } = await import('./index.js');
    const result = AdAppConfigSchema.safeParse({
      id: 'filezen',
      appId: 'filezen',
      masterEnabled: true,
      formats: {
        banner: { enabled: true, refreshIntervalSeconds: 60 },
        native: { enabled: true },
        interstitial: { enabled: true, cooldownSeconds: 45, sessionCap: 3 },
        rewarded: { enabled: true, dailyCap: 10 },
        app_open: { enabled: false },
        rewarded_interstitial: { enabled: false },
      },
      networkSettings: {
        admob: { enabled: true, appIdOrSdkKey: 'ca-app-pub-3940256099942544~3347511713' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject banner refresh interval less than 30s policy minimum in rotation policy', async () => {
    const { AdRotationPolicySchema } = await import('./index.js');
    const result = AdRotationPolicySchema.safeParse({
      id: 'filezen_banner',
      appId: 'filezen',
      format: 'banner',
      tiers: [{ networkId: 'admob', priority: 1, enabled: true }],
      fallbackToCustomAds: true,
      bannerRefreshIntervalSeconds: 15, // Violates policy minimum of 30s
    });
    expect(result.success).toBe(false);
  });

  it('should validate AdSafetyPolicy with default blocked categories', async () => {
    const { AdSafetyPolicySchema } = await import('./index.js');
    const result = AdSafetyPolicySchema.safeParse({
      id: 'global_safety',
      appId: 'global',
      blockedCategories: ['violence', 'weapons', 'adult_sexual', 'gambling', 'drugs'],
      maxAdRating: 'PG',
      blockSensitiveCategories: true,
      childDirectedApp: false,
    });
    expect(result.success).toBe(true);
  });

  it('should validate AdKillSwitches schema', async () => {
    const { AdKillSwitchesSchema } = await import('./index.js');
    const result = AdKillSwitchesSchema.safeParse({
      id: 'current',
      globalAdsDisabled: false,
      networks: { admob: false, meta: false },
      apps: { filezen: false },
      formats: {
        banner: false,
        native: false,
        interstitial: false,
        rewarded: false,
        app_open: false,
        rewarded_interstitial: false,
      },
      placements: { home_banner: false },
      customAdsDisabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('should validate CustomAdCampaign schema', async () => {
    const { CustomAdCampaignSchema } = await import('./index.js');
    const result = CustomAdCampaignSchema.safeParse({
      id: 'camp_optilens_promo',
      title: 'Try OptiLens AI Camera',
      description: 'AI powered photo enhancement on your device',
      ctaText: 'Install Free',
      destinationUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.optilens',
      targetApps: ['filezen'],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 864000000).toISOString(),
      priority: 50,
      enabled: true,
      status: 'active',
      impressionsCount: 0,
      clicksCount: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('Analytics & Revenue Intelligence Schemas', () => {
  it('should validate AdTelemetryEventInputSchema for a valid impression event', async () => {
    const { AdTelemetryEventInputSchema } = await import('./index.js');
    const result = AdTelemetryEventInputSchema.safeParse({
      requestId: 'req_123456',
      eventType: 'impression',
      adFormat: 'banner',
      provider: 'admob',
      placementId: 'home_banner',
      adUnitId: 'ca-app-pub-3940256099942544/6300978111',
      latencyMs: 150,
      environment: 'production',
      platform: 'android',
      appVersion: '1.2.0',
      sdkVersion: '1.0.0',
    });
    expect(result.success).toBe(true);
  });

  it('should reject AdTelemetryEventInputSchema with invalid eventType', async () => {
    const { AdTelemetryEventInputSchema } = await import('./index.js');
    const result = AdTelemetryEventInputSchema.safeParse({
      requestId: 'req_123',
      eventType: 'unknown_event',
      adFormat: 'banner',
      provider: 'admob',
    });
    expect(result.success).toBe(false);
  });

  it('should validate BatchAdTelemetryEventSchema with multiple events', async () => {
    const { BatchAdTelemetryEventSchema } = await import('./index.js');
    const result = BatchAdTelemetryEventSchema.safeParse({
      events: [
        {
          requestId: 'req_1',
          eventType: 'request',
          adFormat: 'interstitial',
          provider: 'meta',
        },
        {
          requestId: 'req_2',
          eventType: 'fill',
          adFormat: 'interstitial',
          provider: 'meta',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should validate AnalyticsDateRangeQuerySchema', async () => {
    const { AnalyticsDateRangeQuerySchema } = await import('./index.js');
    const result = AnalyticsDateRangeQuerySchema.safeParse({
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      preset: '7d',
      appId: 'filezen',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format in AnalyticsDateRangeQuerySchema', async () => {
    const { AnalyticsDateRangeQuerySchema } = await import('./index.js');
    const result = AnalyticsDateRangeQuerySchema.safeParse({
      startDate: '10/01/2026',
    });
    expect(result.success).toBe(false);
  });
});

