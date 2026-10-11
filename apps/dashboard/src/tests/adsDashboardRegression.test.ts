import { describe, it, expect } from 'vitest';
import {
  fetchAdsOverview,
  subscribeAdNetworks,
  createAdNetwork,
  updateAdNetwork,
  deleteAdNetwork,
  subscribeAdApps,
  updateAdAppConfig,
  subscribeAdUnits,
  createAdUnit,
  updateAdUnit,
  deleteAdUnit,
  subscribeAdPlacements,
  createAdPlacement,
  updateAdPlacement,
  deleteAdPlacement,
  subscribeAdRotationPolicies,
  updateAdRotationPolicy,
  subscribeAdFrequencyPolicies,
  updateAdFrequencyPolicy,
  subscribeAdSafetyPolicies,
  updateAdSafetyPolicy,
  subscribeCustomAdCampaigns,
  createCustomAdCampaign,
  updateCustomAdCampaign,
  deleteCustomAdCampaign,
  subscribeAdKillSwitches,
  updateAdKillSwitches,
  fetchEffectiveAdConfig,
} from '../services/adsService.js';

describe('Ads & Monetization Dashboard Service Regression', () => {
  const actor = {
    uid: 'usr_test_admin',
    email: 'admin@webappypie.com',
  };

  it('1. fetchAdsOverview returns valid dashboard metrics structure with zero-fabrication', async () => {
    const overview = await fetchAdsOverview();
    expect(overview).toBeDefined();
    expect(overview.totalApps).toBeGreaterThanOrEqual(1);
    expect(overview.activeAdNetworks).toBeGreaterThanOrEqual(1);
    // Strict zero-fabrication enforcement
    expect(overview.estimatedRevenueDailyUsd).toBe(0.0);
    expect(overview.revenueStatus).toBe('Not connected');
    expect(overview.isRevenueConnected).toBe(false);
    expect(overview.estimatedRevenueDailyUsd).not.toBe(78.3);
    expect(overview.estimatedImpressionsDaily).not.toBe(34980);
  });

  it('2. subscribeAdNetworks provides default supported ad networks', async () => {
    let receivedNetworks: any[] = [];
    const unsub = subscribeAdNetworks((networks) => {
      receivedNetworks = networks;
    });

    expect(receivedNetworks.length).toBeGreaterThanOrEqual(4);
    const networkIds = receivedNetworks.map((n) => n.id);
    expect(networkIds).toContain('admob');
    expect(networkIds).toContain('meta');
    expect(networkIds).toContain('applovin');
    expect(networkIds).toContain('custom_ads');

    unsub();
  });

  it('3. creates, updates, and deletes ad networks with Secret Manager references', async () => {
    const testNetId = 'unity_ads_' + Date.now();
    await createAdNetwork(
      {
        id: testNetId,
        name: 'Unity Ads',
        enabled: true,
        environmentMode: 'production',
        secretReferenceName: 'UNITY_ADS_API_KEY',
        priority: 5,
        supportedFormats: ['rewarded', 'interstitial'],
        allowedAppIds: ['*'],
        configured: true,
        healthStatus: { status: 'healthy' },
      },
      actor,
    );

    let currentNetworks: any[] = [];
    const unsub = subscribeAdNetworks((nets) => {
      currentNetworks = nets;
    });
    expect(currentNetworks.find((n) => n.id === testNetId)).toBeDefined();

    // Update
    await updateAdNetwork(testNetId, { priority: 6, enabled: false }, actor);
    const updated = currentNetworks.find((n) => n.id === testNetId);
    expect(updated?.priority).toBe(6);
    expect(updated?.enabled).toBe(false);

    // Delete
    await deleteAdNetwork(testNetId, actor);
    expect(currentNetworks.find((n) => n.id === testNetId)).toBeUndefined();

    unsub();
  });

  it('4. updateAdAppConfig updates format toggles and enforces safe banner refresh', async () => {
    await updateAdAppConfig(
      'filezen',
      {
        masterEnabled: true,
        formats: {
          banner: { enabled: true, refreshIntervalSeconds: 60 },
          interstitial: { enabled: true, cooldownSeconds: 30, sessionCap: 5, dailyCap: 15 },
        },
      },
      actor,
    );

    let apps: any[] = [];
    const unsub = subscribeAdApps((loaded) => {
      apps = loaded;
    });
    const filezen = apps.find((a) => a.appId === 'filezen');
    expect(filezen).toBeDefined();
    expect(filezen.formats.banner.refreshIntervalSeconds).toBe(60);
    expect(filezen.formats.interstitial.cooldownSeconds).toBe(30);

    // Enforce validation: refresh interval < 30 seconds must fail schema
    await expect(
      updateAdAppConfig(
        'filezen',
        {
          formats: {
            banner: { enabled: true, refreshIntervalSeconds: 15 }, // Violates 30s policy minimum
          },
        },
        actor,
      ),
    ).rejects.toThrow();

    unsub();
  });

  it('5. manages Ad Units CRUD and maintains format mapping', async () => {
    const unit = await createAdUnit(
      {
        appId: 'filezen',
        networkId: 'admob',
        format: 'banner',
        platform: 'android',
        name: 'Test FileZen Banner',
        adUnitId: 'ca-app-pub-3940256099942544/6300978111',
        enabled: true,
      },
      actor,
    );
    expect(unit.id).toBeDefined();

    let unitsList: any[] = [];
    const unsub = subscribeAdUnits((units) => {
      unitsList = units;
    });
    expect(unitsList.find((u) => u.id === unit.id)).toBeDefined();

    // Toggle unit
    await updateAdUnit(unit.id, { enabled: false }, actor);
    expect(unitsList.find((u) => u.id === unit.id)?.enabled).toBe(false);

    // Delete
    await deleteAdUnit(unit.id, actor);
    expect(unitsList.find((u) => u.id === unit.id)).toBeUndefined();

    unsub();
  });

  it('6. manages Ad Placements registry', async () => {
    const placement = await createAdPlacement(
      {
        appId: 'optilens',
        placementKey: 'camera_capture_reward',
        name: 'Camera Capture Rewarded Perk',
        format: 'rewarded',
        screenLocation: 'CameraCaptureView',
        enabled: true,
      },
      actor,
    );

    let placementsList: any[] = [];
    const unsub = subscribeAdPlacements((places) => {
      placementsList = places;
    });
    expect(placementsList.find((p) => p.id === placement.id)).toBeDefined();

    await updateAdPlacement(placement.id, { enabled: false }, actor);
    expect(placementsList.find((p) => p.id === placement.id)?.enabled).toBe(false);

    await deleteAdPlacement(placement.id, actor);
    expect(placementsList.find((p) => p.id === placement.id)).toBeUndefined();

    unsub();
  });

  it('7. updates Ad Rotation & Mediation Waterfall policies', async () => {
    await updateAdRotationPolicy(
      {
        appId: 'filezen',
        format: 'banner',
        tiers: [
          { networkId: 'admob', priority: 1, timeoutMs: 4000, enabled: true },
          { networkId: 'meta', priority: 2, timeoutMs: 5000, enabled: true },
          { networkId: 'custom_ads', priority: 3, timeoutMs: 2000, enabled: true },
        ],
        fallbackToCustomAds: true,
        bannerRefreshIntervalSeconds: 60,
      },
      actor,
    );

    let policies: any[] = [];
    const unsub = subscribeAdRotationPolicies((p) => {
      policies = p;
    });
    const policy = policies.find((p) => p.appId === 'filezen' && p.format === 'banner');
    expect(policy).toBeDefined();
    expect(policy.tiers).toHaveLength(3);
    expect(policy.tiers[0].networkId).toBe('admob');
    expect(policy.fallbackToCustomAds).toBe(true);

    unsub();
  });

  it('8. updates Frequency Policies for interstitials, rewarded, and app open', async () => {
    await updateAdFrequencyPolicy(
      'filezen',
      {
        formats: {
          banner: { minIntervalSeconds: 30, cooldownSeconds: 0, sessionCap: 0, dailyCap: 150 },
          interstitial: { minIntervalSeconds: 40, cooldownSeconds: 60, sessionCap: 3, dailyCap: 10 },
          rewarded: { minIntervalSeconds: 0, cooldownSeconds: 20, sessionCap: 0, dailyCap: 20 },
          app_open: { minIntervalSeconds: 0, cooldownSeconds: 180, sessionCap: 0, dailyCap: 4, appForegroundRule: 'min_background_30s' },
        },
      },
      actor,
    );

    let frequencyList: any[] = [];
    const unsub = subscribeAdFrequencyPolicies((p) => {
      frequencyList = p;
    });
    const freq = frequencyList.find((p) => p.appId === 'filezen');
    expect(freq).toBeDefined();
    expect(freq.formats.interstitial.sessionCap).toBe(3);
    expect(freq.formats.app_open.appForegroundRule).toBe('min_background_30s');

    unsub();
  });

  it('9. updates Content Safety policies and prohibited category blocklists', async () => {
    await updateAdSafetyPolicy(
      'filezen',
      {
        maxAdRating: 'PG',
        childDirectedApp: false,
        blockedCategories: ['violence', 'weapons', 'adult', 'gambling', 'drugs'],
      },
      actor,
    );

    let safetyList: any[] = [];
    const unsub = subscribeAdSafetyPolicies((s) => {
      safetyList = s;
    });
    const safety = safetyList.find((s) => s.appId === 'filezen');
    expect(safety).toBeDefined();
    expect(safety.maxAdRating).toBe('PG');
    expect(safety.blockedCategories).toContain('gambling');
    expect(safety.blockedCategories).toContain('weapons');

    unsub();
  });

  it('10. manages WebAppyPie In-House Custom Ad campaigns', async () => {
    const campaign = await createCustomAdCampaign(
      {
        title: 'OptiLens Banner Promo',
        targetApps: ['filezen'],
        description: 'Enhance photos with artificial intelligence',
        ctaText: 'Install',
        destinationUrl: 'https://webappypie.com/apps/optilens',
        status: 'active',
        priority: 1,
        enabled: true,
        impressionsCount: 0,
        clicksCount: 0,
        startDate: new Date().toISOString(),
      },
      actor,
    );

    let campaigns: any[] = [];
    const unsub = subscribeCustomAdCampaigns((c) => {
      campaigns = c;
    });
    expect(campaigns.find((c) => c.id === campaign.id)).toBeDefined();

    await updateCustomAdCampaign(campaign.id, { status: 'paused', priority: 2 }, actor);
    const updated = campaigns.find((c) => c.id === campaign.id);
    expect(updated?.status).toBe('paused');
    expect(updated?.priority).toBe(2);

    await deleteCustomAdCampaign(campaign.id, actor);
    expect(campaigns.find((c) => c.id === campaign.id)).toBeUndefined();

    unsub();
  });

  it('11. manages Kill Switches and cascades them to effective ad config', async () => {
    // 1. Initial normal state
    await updateAdKillSwitches({ globalAdsDisabled: false, networks: {}, apps: {} }, actor);
    let effective = await fetchEffectiveAdConfig('filezen');
    expect(effective.enabled).toBe(true);

    // 2. Engage Global Kill Switch
    await updateAdKillSwitches(
      { globalAdsDisabled: true, reason: 'Emergency incident test' },
      actor,
    );

    let currentSwitches: any = null;
    const unsub = subscribeAdKillSwitches((sw) => {
      currentSwitches = sw;
    });
    expect(currentSwitches.globalAdsDisabled).toBe(true);

    // Simulator check: must suppress all ads
    effective = await fetchEffectiveAdConfig('filezen');
    expect(effective.enabled).toBe(false);
    expect(effective.formats.banner.enabled).toBe(false);
    expect(effective.formats.interstitial.enabled).toBe(false);

    // 3. Reset Global Kill Switch and test App Kill Switch
    await updateAdKillSwitches({ globalAdsDisabled: false, apps: { filezen: true } }, actor);
    effective = await fetchEffectiveAdConfig('filezen');
    expect(effective.enabled).toBe(false);

    // 4. Restore filezen
    await updateAdKillSwitches({ apps: { filezen: false } }, actor);
    effective = await fetchEffectiveAdConfig('filezen');
    expect(effective.enabled).toBe(true);

    // 5. Verify effective config NEVER exposes provider secrets
    const payloadStr = JSON.stringify(effective);
    expect(payloadStr).not.toContain('secret');
    expect(payloadStr).not.toContain('API_KEY');
    expect(payloadStr).not.toContain('SERVICE_ACCOUNT');

    unsub();
  });
});
