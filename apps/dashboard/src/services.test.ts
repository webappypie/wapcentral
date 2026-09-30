import { describe, it, expect } from 'vitest';
import { createApp, updateApp, deleteApp, subscribeApps } from './services/appsService.js';
import {
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
  subscribeCampaigns,
} from './services/campaignsService.js';
import {
  upsertFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
  subscribeFeatureFlags,
} from './services/featureFlagsService.js';
import { recordAuditLog, subscribeAuditLogs } from './services/auditService.js';
import {
  subscribeUsageAnalytics,
  subscribeCampaignAnalytics,
  subscribeCostAlerts,
  createCostAlertRule,
  toggleCostAlertRule,
  deleteCostAlertRule,
  subscribeDataRetentionPolicy,
  updateDataRetentionPolicy,
  triggerManualRetentionPruning,
} from './services/analyticsService.js';
import {
  subscribePlatformHealth,
  subscribeAiServerMetrics,
  subscribeInfrastructureAlerts,
  triggerServiceHealthCheck,
  createInfrastructureAlertRule,
  toggleInfrastructureAlertRule,
  deleteInfrastructureAlertRule,
  simulateAiServerLoad,
} from './services/infrastructureService.js';

const mockActor = {
  uid: 'usr_test_admin',
  email: 'admin@webappypie.com',
};

describe('Core Dashboard Services & In-Memory Fallback', () => {
  describe('Apps Service', () => {
    it('should create an app with valid schema and query via subscription', async () => {
      const newApp = await createApp(
        {
          name: 'Test Calculator',
          packageId: 'com.webappypie.testcalc',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
          enabledModules: ['promotion', 'ads'],
        },
        mockActor,
      );

      expect(newApp.id).toBeDefined();
      expect(newApp.name).toBe('Test Calculator');
      expect(newApp.packageId).toBe('com.webappypie.testcalc');

      let currentApps: unknown[] = [];
      const unsub = subscribeApps((apps) => {
        currentApps = apps;
      });
      unsub();

      expect(currentApps.some((a: any) => a.id === newApp.id)).toBe(true);
    });

    it('should reject invalid packageId with Zod error', async () => {
      await expect(
        createApp(
          {
            name: 'Bad App',
            packageId: 'INVALID_PACKAGE!',
            platform: 'android',
            version: '1.0.0',
            environment: 'production',
            enabledModules: [],
          },
          mockActor,
        ),
      ).rejects.toThrow();
    });

    it('should update and delete an app', async () => {
      const app = await createApp(
        {
          name: 'App To Delete',
          packageId: 'com.webappypie.deleteme',
          platform: 'ios',
          version: '1.0.0',
          environment: 'staging',
          enabledModules: ['analytics'],
        },
        mockActor,
      );

      await updateApp(app.id, { name: 'App Renamed' }, mockActor);

      let currentApps: any[] = [];
      const unsub1 = subscribeApps((apps) => {
        currentApps = apps;
      });
      unsub1();

      const found = currentApps.find((a) => a.id === app.id);
      expect(found?.name).toBe('App Renamed');

      await deleteApp(app.id, mockActor);

      let afterDelete: any[] = [];
      const unsub2 = subscribeApps((apps) => {
        afterDelete = apps;
      });
      unsub2();

      expect(afterDelete.some((a) => a.id === app.id)).toBe(false);
    });

    it('should configure and update app adConfig with mediation waterfall and provider ad units', async () => {
      const app = await createApp(
        {
          name: 'Ad Test App',
          packageId: 'com.webappypie.adtest',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
          enabledModules: ['ads'],
          adConfig: {
            admob: {
              appId: 'ca-app-pub-123456789~987654',
              enabled: true,
              adUnits: [
                {
                  id: 'u1',
                  name: 'Banner 1',
                  type: 'banner',
                  platform: 'android',
                  adUnitId: 'ca-app-pub-123/banner',
                },
              ],
            },
            wapads: {
              appKey: 'wap_test_key',
              enabled: true,
            },
            mediationPriority: ['admob', 'wapads'],
          },
        },
        mockActor,
      );

      expect(app.adConfig).toBeDefined();
      expect(app.adConfig?.admob?.enabled).toBe(true);
      expect(app.adConfig?.mediationPriority).toEqual(['admob', 'wapads']);

      // Update mediation waterfall priority and add Meta placement
      await updateApp(
        app.id,
        {
          adConfig: {
            ...app.adConfig,
            meta: {
              appId: 'meta_app_999',
              enabled: true,
              placements: [
                {
                  id: 'p1',
                  name: 'Meta Interstitial',
                  type: 'interstitial',
                  placementId: 'meta_place_123',
                },
              ],
            },
            mediationPriority: ['meta', 'admob', 'wapads'],
          },
        },
        mockActor,
      );

      let loadedApps: any[] = [];
      const unsub = subscribeApps((apps) => {
        loadedApps = apps;
      });
      unsub();

      const updated = loadedApps.find((a) => a.id === app.id);
      expect(updated?.adConfig?.mediationPriority).toEqual(['meta', 'admob', 'wapads']);
      expect(updated?.adConfig?.meta?.placements).toHaveLength(1);
    });
  });

  describe('Campaigns Service', () => {
    it('should create a campaign with creative asset details and frequency capping', async () => {
      const camp = await createCampaign(
        {
          name: 'Test Promo Campaign',
          promotedAppId: 'app_01',
          targetAppIds: ['app_02'],
          layoutVariant: 'banner',
          title: 'Special Promotion',
          description: 'Try our advanced features for free today!',
          ctaText: 'Install',
          storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.test',
          priority: 80,
          frequencyCap: {
            maxImpressions: 5,
            periodHours: 24,
          },
        },
        mockActor,
      );

      expect(camp.id).toBeDefined();
      expect(camp.layoutVariant).toBe('banner');
      expect(camp.priority).toBe(80);
      expect(camp.status).toBe('draft');
      expect(camp.frequencyCap?.maxImpressions).toBe(5);
    });

    it('should change campaign status between published and paused', async () => {
      const camp = await createCampaign(
        {
          name: 'Status Test Campaign',
          promotedAppId: 'app_01',
          targetAppIds: ['app_02'],
          layoutVariant: 'interstitial',
          title: 'Interstitial Ad',
          description: 'Fullscreen takeover test',
          ctaText: 'Play Now',
          storeUrl: 'https://play.google.com/store/apps',
          priority: 50,
        },
        mockActor,
      );

      await setCampaignStatus(camp.id, 'published', mockActor);

      let currentCamps: any[] = [];
      const unsub1 = subscribeCampaigns((camps) => {
        currentCamps = camps;
      });
      unsub1();

      const publishedCamp = currentCamps.find((c) => c.id === camp.id);
      expect(publishedCamp?.status).toBe('published');
      expect(publishedCamp?.enabled).toBe(true);

      await setCampaignStatus(camp.id, 'paused', mockActor);

      let currentCamps2: any[] = [];
      const unsub2 = subscribeCampaigns((camps) => {
        currentCamps2 = camps;
      });
      unsub2();

      const pausedCamp = currentCamps2.find((c) => c.id === camp.id);
      expect(pausedCamp?.status).toBe('paused');
      expect(pausedCamp?.enabled).toBe(false);

      await deleteCampaign(camp.id, mockActor);
    });
  });

  describe('Feature Flags Service', () => {
    it('should upsert and toggle remote feature flags', async () => {
      const flag = await upsertFeatureFlag(
        null,
        {
          key: 'test_flag_banner_enabled',
          description: 'Controls test banner display',
          type: 'boolean',
          value: true,
          scope: 'global',
          enabled: true,
        },
        mockActor,
      );

      expect(flag.key).toBe('test_flag_banner_enabled');
      expect(flag.enabled).toBe(true);

      await toggleFeatureFlag(flag.id, false, mockActor);

      let flags: any[] = [];
      const unsub = subscribeFeatureFlags((loaded) => {
        flags = loaded;
      });
      unsub();

      const found = flags.find((f) => f.id === flag.id);
      expect(found?.enabled).toBe(false);

      await deleteFeatureFlag(flag.id, mockActor);
    });
  });

  describe('Audit Trail Service', () => {
    it('should record administrative audit events', async () => {
      await recordAuditLog({
        action: 'role.assign',
        actorUid: mockActor.uid,
        actorEmail: mockActor.email,
        resourceType: 'adminUser',
        resourceId: 'usr_new_editor',
        changes: {
          role: { before: 'viewer', after: 'editor' },
        },
      });

      let logs: any[] = [];
      const unsub = subscribeAuditLogs((loaded) => {
        logs = loaded;
      });
      unsub();

      expect(
        logs.some(
          (l) =>
            l.action === 'role.assign' &&
            l.resourceId === 'usr_new_editor' &&
            l.actorEmail === mockActor.email,
        ),
      ).toBe(true);
    });
  });

  describe('AI Management Service', () => {
    it('should list providers and perform health checks', async () => {
      const { fetchAiProviders, checkProviderHealth } = await import('./services/aiService.js');
      const providers = await fetchAiProviders();
      expect(providers.length).toBeGreaterThanOrEqual(2);
      expect(providers.some((p) => p.id === 'openai')).toBe(true);

      const health = await checkProviderHealth('openai');
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeGreaterThan(0);
    });

    it('should create and toggle routing policies', async () => {
      const { createAiPolicy, toggleAiPolicy, fetchAiPolicies } =
        await import('./services/aiService.js');
      const policy = await createAiPolicy(
        {
          appId: 'app_01',
          feature: 'service_test_feature',
          primaryProviderId: 'gemini',
          primaryModelId: 'gemini-1.5-flash',
          enabled: true,
        },
        mockActor,
      );

      expect(policy.id).toBeDefined();
      expect(policy.feature).toBe('service_test_feature');

      const toggled = await toggleAiPolicy(policy.id, mockActor);
      expect(toggled.enabled).toBe(false);

      const all = await fetchAiPolicies();
      expect(all.some((p) => p.id === policy.id)).toBe(true);
    });
  });

  describe('Analytics & Cost Management Service', () => {
    it('should subscribe to AI usage analytics and compute breakdowns and daily trends', async () => {
      let result: any = null;
      const unsub = subscribeUsageAnalytics(30, (summary) => {
        result = summary;
      });
      unsub();

      expect(result).toBeDefined();
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.totalCostEstimateUsd).toBeGreaterThan(0);
      expect(Object.keys(result.byProvider).length).toBeGreaterThan(0);
      expect(Object.keys(result.byApp).length).toBeGreaterThan(0);
      expect(Object.keys(result.byFeature).length).toBeGreaterThan(0);
      expect(result.dailyTrends.length).toBe(30);

      // Verify cost estimate structure
      const gemini = result.byProvider['gemini'];
      expect(gemini).toBeDefined();
      expect(gemini.costEstimateUsd).toBeGreaterThanOrEqual(0);
    });

    it('should subscribe to promotion campaign analytics and compute impressions, clicks, CTR', async () => {
      let result: any[] = [];
      const unsub = subscribeCampaignAnalytics((data) => {
        result = data;
      });
      unsub();

      expect(result.length).toBeGreaterThan(0);
      const campaign = result[0]!;
      expect(campaign.campaignId).toBeDefined();
      expect(campaign.impressions).toBeGreaterThanOrEqual(0);
      expect(campaign.clicks).toBeGreaterThanOrEqual(0);
      expect(campaign.ctr).toBeGreaterThanOrEqual(0);
    });

    it('should manage cost alert rules: create, toggle, evaluate, and delete', async () => {
      const rule = await createCostAlertRule(
        {
          name: 'High Daily Spend Alert',
          metric: 'daily_cost_usd',
          threshold: 50.0,
          enabled: true,
          notifyEmails: ['alert-lead@webappypie.com'],
        },
        mockActor,
      );

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('High Daily Spend Alert');
      expect(rule.threshold).toBe(50.0);

      let currentRules: any[] = [];
      let activeTriggers: any[] = [];
      const unsub = subscribeCostAlerts((rules, triggers) => {
        currentRules = rules;
        activeTriggers = triggers;
      });
      unsub();

      expect(currentRules.some((r) => r.id === rule.id)).toBe(true);
      expect(Array.isArray(activeTriggers)).toBe(true);

      await toggleCostAlertRule(rule.id, false, mockActor);

      let updatedRules: any[] = [];
      const unsub2 = subscribeCostAlerts((rules) => {
        updatedRules = rules;
      });
      unsub2();

      const found = updatedRules.find((r) => r.id === rule.id);
      expect(found?.enabled).toBe(false);

      await deleteCostAlertRule(rule.id, mockActor);

      let afterDelete: any[] = [];
      const unsub3 = subscribeCostAlerts((rules) => {
        afterDelete = rules;
      });
      unsub3();

      expect(afterDelete.some((r) => r.id === rule.id)).toBe(false);
    });

    it('should update retention policy and trigger manual pruning', async () => {
      let currentPolicy: any = null;
      const unsub = subscribeDataRetentionPolicy((policy) => {
        currentPolicy = policy;
      });
      unsub();

      expect(currentPolicy).toBeDefined();
      expect(currentPolicy.usageEventsTtlDays).toBeGreaterThan(0);

      await updateDataRetentionPolicy(
        {
          usageEventsTtlDays: 14,
          promotionEventsTtlDays: 30,
          auditLogsTtlDays: 180,
        },
        mockActor,
      );

      let updatedPolicy: any = null;
      const unsub2 = subscribeDataRetentionPolicy((policy) => {
        updatedPolicy = policy;
      });
      unsub2();

      expect(updatedPolicy.usageEventsTtlDays).toBe(14);
      expect(updatedPolicy.promotionEventsTtlDays).toBe(30);

      const pruneResult = await triggerManualRetentionPruning(mockActor);
      expect(pruneResult.prunedCount).toBeGreaterThanOrEqual(0);
      expect(typeof pruneResult.timestamp).toBe('string');
    });
  });

  describe('Infrastructure Health & Monitoring Service', () => {
    it('should subscribe to platform health and return service list and overview metrics', async () => {
      let loadedServices: any[] = [];
      let loadedOverview: any = null;

      const unsub = subscribePlatformHealth((services, overview) => {
        loadedServices = services;
        loadedOverview = overview;
      });
      unsub();

      expect(loadedServices.length).toBeGreaterThanOrEqual(11);
      expect(loadedOverview).toBeDefined();
      expect(loadedOverview.totalServices).toBeGreaterThanOrEqual(11);
      expect(loadedOverview.healthyCount).toBeGreaterThan(0);
      expect(loadedOverview.avgLatencyMs).toBeGreaterThan(0);

      const gateway = loadedServices.find((s) => s.serviceId === 'ai-gateway');
      expect(gateway).toBeDefined();
      expect(gateway.category).toBe('api');
      expect(gateway.latencyMs).toBeGreaterThan(0);
    });

    it('should trigger manual heartbeat probes for a specific service and all services', async () => {
      const singleProbeResult = await triggerServiceHealthCheck('ai-gateway');
      expect(singleProbeResult.length).toBeGreaterThanOrEqual(11);

      const allProbeResult = await triggerServiceHealthCheck();
      expect(allProbeResult.length).toBeGreaterThanOrEqual(11);
      expect(allProbeResult.every((s) => s.lastCheckedAt)).toBe(true);
    });

    it('should subscribe to self-hosted AI compute metrics and support load simulation', async () => {
      let metrics: any = null;
      const unsub = subscribeAiServerMetrics((data) => {
        metrics = data;
      });
      unsub();

      expect(metrics).toBeDefined();
      expect(metrics.serverId).toBe('self_hosted');
      expect(metrics.gpuUsagePct).toBeGreaterThan(0);
      expect(metrics.vramUsedMb).toBeGreaterThan(0);
      expect(metrics.vramTotalMb).toBe(81920);

      const simulated = simulateAiServerLoad({ gpuUsagePct: 89.0, queueDepth: 60 });
      expect(simulated.gpuUsagePct).toBe(89.0);
      expect(simulated.queueDepth).toBe(60);
      expect(simulated.status).toBe('degraded');
    });

    it('should manage infrastructure alert rules: create, evaluate triggers, toggle, and delete', async () => {
      const newRule = await createInfrastructureAlertRule(
        {
          name: 'Test Gateway High Latency',
          targetServiceId: 'ai-gateway',
          metric: 'latency_ms',
          threshold: 100,
          severity: 'warning',
          enabled: true,
          notifyEmails: ['ops-test@webappypie.com'],
        },
        mockActor,
      );

      expect(newRule.id).toBeDefined();
      expect(newRule.name).toBe('Test Gateway High Latency');
      expect(newRule.threshold).toBe(100);

      let currentRules: any[] = [];
      let activeTriggers: any[] = [];
      const unsub = subscribeInfrastructureAlerts((rules, triggers) => {
        currentRules = rules;
        activeTriggers = triggers;
      });
      unsub();

      expect(currentRules.some((r) => r.id === newRule.id)).toBe(true);
      expect(Array.isArray(activeTriggers)).toBe(true);

      await toggleInfrastructureAlertRule(newRule.id, false, mockActor);

      let afterToggleRules: any[] = [];
      const unsub2 = subscribeInfrastructureAlerts((rules) => {
        afterToggleRules = rules;
      });
      unsub2();

      const toggled = afterToggleRules.find((r) => r.id === newRule.id);
      expect(toggled?.enabled).toBe(false);

      await deleteInfrastructureAlertRule(newRule.id, mockActor);

      let afterDeleteRules: any[] = [];
      const unsub3 = subscribeInfrastructureAlerts((rules) => {
        afterDeleteRules = rules;
      });
      unsub3();

      expect(afterDeleteRules.some((r) => r.id === newRule.id)).toBe(false);
    });
  });
});
