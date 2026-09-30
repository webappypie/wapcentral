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
