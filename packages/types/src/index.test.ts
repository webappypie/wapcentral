/**
 * @wapcentral/types — Unit Tests
 * Phase 0: Basic type export validation
 */

import { describe, it, expect } from 'vitest';
import type {
  App,
  Campaign,
  PromotionPayload,
  AiProvider,
  FeatureFlag,
  AdminUser,
  AuditLog,
} from './index.js';

describe('@wapcentral/types', () => {
  it('should compile and export App type with correct shape', () => {
    const app: App = {
      id: 'app-001',
      name: 'Test App',
      packageId: 'com.webappypie.test',
      platform: 'android',
      version: '1.0.0',
      environment: 'development',
      enabledModules: ['promotion', 'ads'],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(app.id).toBe('app-001');
    expect(app.platform).toBe('android');
    expect(app.enabledModules).toContain('promotion');
  });

  it('should compile and export Campaign type with correct shape', () => {
    const campaign: Campaign = {
      id: 'campaign-001',
      name: 'Test Campaign',
      promotedAppId: 'app-002',
      targetAppIds: ['app-001'],
      title: 'Try Our New App!',
      description: 'Download now and get started.',
      ctaText: 'Install',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.test',
      layoutVariant: 'banner',
      priority: 1,
      enabled: true,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(campaign.status).toBe('draft');
    expect(campaign.targetAppIds).toHaveLength(1);
  });

  it('should compile PromotionPayload with schemaVersion 1', () => {
    const payload: PromotionPayload = {
      schemaVersion: 1,
      enabled: true,
      campaignId: 'campaign-001',
      title: 'Try App X',
      description: 'Check it out!',
      ctaText: 'Install',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.appx',
      layoutVariant: 'banner',
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      cacheTtlSeconds: 21600,
      signature: 'hmac-sha256-placeholder',
    };
    expect(payload.schemaVersion).toBe(1);
    expect(payload.cacheTtlSeconds).toBe(21600);
  });

  it('should compile AiProvider type correctly', () => {
    const provider: AiProvider = {
      id: 'provider-openai',
      name: 'OpenAI',
      type: 'openai',
      enabled: true,
      models: [
        {
          id: 'model-gpt4o',
          providerId: 'provider-openai',
          modelId: 'gpt-4o',
          name: 'GPT-4o',
          enabled: true,
          inputCostPer1kTokens: 0.005,
          outputCostPer1kTokens: 0.015,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(provider.type).toBe('openai');
    expect(provider.models).toHaveLength(1);
  });

  it('should compile FeatureFlag type correctly', () => {
    const flag: FeatureFlag = {
      id: 'flag-001',
      key: 'promotion_enabled',
      description: 'Enable self-promotion campaigns',
      value: true,
      type: 'boolean',
      scope: 'global',
      enabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin@webappypie.com',
    };
    expect(flag.key).toBe('promotion_enabled');
    expect(flag.type).toBe('boolean');
  });

  it('should compile AdminUser with RBAC roles', () => {
    const roles: AdminUser['role'][] = ['viewer', 'editor', 'admin', 'super_admin'];
    roles.forEach((role) => {
      const user: AdminUser = {
        uid: 'uid-001',
        email: 'test@webappypie.com',
        role,
        mfaEnabled: role === 'admin' || role === 'super_admin',
        createdAt: new Date().toISOString(),
      };
      expect(user.role).toBe(role);
    });
  });

  it('should compile AuditLog with valid action types', () => {
    const log: AuditLog = {
      id: 'log-001',
      action: 'campaign.publish',
      actorUid: 'uid-001',
      actorEmail: 'admin@webappypie.com',
      resourceType: 'campaign',
      resourceId: 'campaign-001',
      timestamp: new Date().toISOString(),
    };
    expect(log.action).toBe('campaign.publish');
  });
});
