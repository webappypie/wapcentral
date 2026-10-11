/**
 * Revenue Providers Adapter Layer
 *
 * Implements provider-specific reporting contracts.
 * STRIKE RULE: NEVER fabricate or hardcode fake production revenue.
 * If provider reporting API credentials are not yet connected, clearly report
 * isConnected: false and status: 'Not connected - awaiting provider reporting API'.
 */

export interface AdRevenueReport {
  revenue: number;
  ecpm: number;
  isConnected: boolean;
  currency: string;
  status: string;
  lastSyncedAt?: string | undefined;
}

export interface AdRevenueProvider {
  providerId: string;
  providerName: string;
  isConnected: boolean;
  status: string;
  fetchDailyRevenue(appId: string, date: string): Promise<AdRevenueReport>;
}

export class AdMobRevenueProvider implements AdRevenueProvider {
  providerId = 'admob';
  providerName = 'Google AdMob';
  isConnected = false;
  status = 'Not connected — Google AdMob Reporting API credentials not configured';

  async fetchDailyRevenue(_appId: string, _date: string): Promise<AdRevenueReport> {
    return {
      revenue: 0,
      ecpm: 0,
      isConnected: false,
      currency: 'USD',
      status: this.status,
    };
  }
}

export class MetaRevenueProvider implements AdRevenueProvider {
  providerId = 'meta';
  providerName = 'Meta Audience Network';
  isConnected = false;
  status = 'Not connected — Meta Audience Network Reporting API credentials not configured';

  async fetchDailyRevenue(_appId: string, _date: string): Promise<AdRevenueReport> {
    return {
      revenue: 0,
      ecpm: 0,
      isConnected: false,
      currency: 'USD',
      status: this.status,
    };
  }
}

export class AppLovinRevenueProvider implements AdRevenueProvider {
  providerId = 'applovin';
  providerName = 'AppLovin MAX';
  isConnected = false;
  status = 'Not connected — AppLovin MAX Report API key not configured';

  async fetchDailyRevenue(_appId: string, _date: string): Promise<AdRevenueReport> {
    return {
      revenue: 0,
      ecpm: 0,
      isConnected: false,
      currency: 'USD',
      status: this.status,
    };
  }
}

export class CustomAdsRevenueProvider implements AdRevenueProvider {
  providerId = 'custom_ads';
  providerName = 'WebAppyPie Custom Ads';
  isConnected = true;
  status = 'Connected (Internal Promotion — $0 cost/spend)';

  async fetchDailyRevenue(_appId: string, _date: string): Promise<AdRevenueReport> {
    return {
      revenue: 0,
      ecpm: 0,
      isConnected: true,
      currency: 'USD',
      status: this.status,
    };
  }
}

const providersRegistry: Record<string, AdRevenueProvider> = {
  admob: new AdMobRevenueProvider(),
  meta: new MetaRevenueProvider(),
  applovin: new AppLovinRevenueProvider(),
  custom_ads: new CustomAdsRevenueProvider(),
};

export function getRevenueProvider(providerId: string): AdRevenueProvider {
  return (
    providersRegistry[providerId.toLowerCase()] ?? {
      providerId,
      providerName: providerId,
      isConnected: false,
      status: 'Not connected — Provider reporting adapter not configured',
      fetchDailyRevenue: async () => ({
        revenue: 0,
        ecpm: 0,
        isConnected: false,
        currency: 'USD',
        status: 'Not connected',
      }),
    }
  );
}

export function getAllRevenueProviders(): AdRevenueProvider[] {
  return Object.values(providersRegistry);
}
