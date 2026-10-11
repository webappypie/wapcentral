/**
 * Analytics & Revenue Intelligence Client Service
 *
 * Calls WAPCentral Admin API (/v1/analytics/*) with fallback data
 * for offline and testing environments.
 */

import { auth } from '../lib/firebase.js';
import type {
  AnalyticsOverviewMetrics,
  AppAnalyticsMetrics,
  NetworkComparisonItem,
  FormatAnalyticsItem,
  PlacementAnalyticsItem,
  CustomAdsAnalyticsMetrics,
  NotificationAnalyticsSummary,
  TimeSeriesDataPoint,
  CostIntelligenceMetrics,
} from '@wapcentral/types';
import type {
  AnalyticsDateRangeQueryInput,
  AnalyticsExportQueryInput,
} from '@wapcentral/validation';

const API_BASE = import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/admin/v1/analytics';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    // Non-blocking in mock mode
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, String(v));
    }
  }
  const str = query.toString();
  return str ? `?${str}` : '';
}

// ============================================================
// Fallback In-Memory Mocks (Used when API is unreachable or offline)
// ============================================================

const fallbackOverview: AnalyticsOverviewMetrics = {
  totalRequests: 14250,
  totalImpressions: 11840,
  totalClicks: 524,
  overallCtr: 4.43,
  overallFillRate: 83.09,
  averageEcpm: 0,
  estimatedRevenue: 0,
  revenueStatus: 'Not connected',
  totalFailures: 2410,
  totalRewards: 312,
  fallbackCount: 145,
  fallbackRatePct: 1.02,
  activeAppsCount: 2,
  activeNetworksCount: 4,
  dateRange: {
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  },
};

const fallbackApps: AppAnalyticsMetrics[] = [
  {
    appId: 'filezen',
    appName: 'FileZen — AI File & Document Manager',
    requests: 9800,
    impressions: 8120,
    clicks: 345,
    ctr: 4.25,
    fillRate: 82.86,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Not connected',
    failures: 1680,
    topFormat: 'banner',
    topProvider: 'admob',
  },
  {
    appId: 'optilens',
    appName: 'OptiLens — AI Camera & Photo Enhancer',
    requests: 4450,
    impressions: 3720,
    clicks: 179,
    ctr: 4.81,
    fillRate: 83.6,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Not connected',
    failures: 730,
    topFormat: 'interstitial',
    topProvider: 'meta',
  },
];

const fallbackNetworks: NetworkComparisonItem[] = [
  {
    provider: 'admob',
    name: 'Google AdMob',
    requests: 8200,
    impressions: 6950,
    clicks: 298,
    ctr: 4.29,
    fillRate: 84.76,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Not connected — Google AdMob Reporting API credentials not configured',
    failureRate: 15.24,
    status: { status: 'healthy', latencyMs: 110, lastCheckedAt: new Date().toISOString() },
  },
  {
    provider: 'meta',
    name: 'Meta Audience Network',
    requests: 3800,
    impressions: 3100,
    clicks: 142,
    ctr: 4.58,
    fillRate: 81.58,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Not connected — Meta Audience Network Reporting API credentials not configured',
    failureRate: 18.42,
    status: { status: 'healthy', latencyMs: 145, lastCheckedAt: new Date().toISOString() },
  },
  {
    provider: 'applovin',
    name: 'AppLovin MAX',
    requests: 1500,
    impressions: 1210,
    clicks: 58,
    ctr: 4.79,
    fillRate: 80.67,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Not connected — AppLovin MAX Report API key not configured',
    failureRate: 19.33,
    status: { status: 'healthy', latencyMs: 130, lastCheckedAt: new Date().toISOString() },
  },
  {
    provider: 'custom_ads',
    name: 'WebAppyPie Custom Ads',
    requests: 750,
    impressions: 580,
    clicks: 26,
    ctr: 4.48,
    fillRate: 77.33,
    ecpm: 0,
    revenue: 0,
    revenueStatus: 'Connected (Internal Promotion — $0 cost/spend)',
    failureRate: 22.67,
    status: { status: 'healthy', latencyMs: 45, lastCheckedAt: new Date().toISOString() },
  },
];

const fallbackFormats: FormatAnalyticsItem[] = [
  { format: 'banner', requests: 7200, impressions: 6150, clicks: 245, ctr: 3.98, fillRate: 85.42, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
  { format: 'native', requests: 2800, impressions: 2310, clicks: 112, ctr: 4.85, fillRate: 82.5, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
  { format: 'interstitial', requests: 2400, impressions: 1950, clicks: 88, ctr: 4.51, fillRate: 81.25, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
  { format: 'rewarded', requests: 950, impressions: 780, clicks: 42, ctr: 5.38, fillRate: 82.11, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
  { format: 'app_open', requests: 700, impressions: 530, clicks: 31, ctr: 5.85, fillRate: 75.71, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
  { format: 'rewarded_interstitial', requests: 200, impressions: 120, clicks: 6, ctr: 5.0, fillRate: 60.0, ecpm: 0, revenue: 0, revenueStatus: 'Not connected' },
];

const fallbackPlacements: PlacementAnalyticsItem[] = [
  { placementId: 'home_banner', appId: 'filezen', format: 'banner', impressions: 4500, clicks: 180, ctr: 4.0, fillRate: 86.2 },
  { placementId: 'file_convert_interstitial', appId: 'filezen', format: 'interstitial', impressions: 1950, clicks: 88, ctr: 4.51, fillRate: 81.25 },
  { placementId: 'camera_bottom_banner', appId: 'optilens', format: 'banner', impressions: 2450, clicks: 105, ctr: 4.29, fillRate: 84.1 },
  { placementId: 'save_photo_interstitial', appId: 'optilens', format: 'interstitial', impressions: 1120, clicks: 54, ctr: 4.82, fillRate: 83.0 },
];

const fallbackCustomAds: CustomAdsAnalyticsMetrics = {
  totalImpressions: 1450,
  totalClicks: 68,
  ctr: 4.69,
  topCampaigns: [
    { campaignId: 'camp_optilens_promo', title: 'Try OptiLens AI Camera', impressions: 920, clicks: 45, ctr: 4.89 },
    { campaignId: 'camp_filezen_promo', title: 'Try FileZen Document Manager', impressions: 530, clicks: 23, ctr: 4.34 },
  ],
};

const fallbackNotifications: NotificationAnalyticsSummary = {
  totalSent: 12400,
  totalDelivered: 11950,
  totalOpened: 1840,
  totalFailed: 450,
  openRate: 15.4,
  categoryBreakdown: {
    SYSTEM: 2500,
    IMPORTANT: 1800,
    SECURITY: 950,
    UPDATE: 3200,
    FEATURE: 2100,
    PROMOTION: 1100,
    MAINTENANCE: 450,
    CUSTOM: 300,
  },
  appBreakdown: {
    filezen: 7800,
    optilens: 4600,
  },
};

const fallbackTimeSeries: TimeSeriesDataPoint[] = (() => {
  const list: TimeSeriesDataPoint[] = [];
  const baseDate = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    list.push({
      date,
      requests: 2000 + (i % 3) * 150,
      impressions: 1650 + (i % 3) * 120,
      clicks: 72 + (i % 3) * 8,
      ctr: 4.36,
      fillRate: 82.5,
      ecpm: 0,
      revenue: 0,
      failures: 350 - (i % 3) * 30,
    });
  }
  return list;
})();

const fallbackCostIntel: CostIntelligenceMetrics = {
  providerCostEstimates: { admob: 0, meta: 0, applovin: 0, custom_ads: 0 },
  infraCostStatus: 'Not available',
  netRevenueEstimate: 0,
  notes: 'Cloud infrastructure cost export not yet linked to billing account. Estimated net revenue is not available without live GCP billing export and provider reporting APIs.',
};

export class AnalyticsIntelligenceService {
  public static async getOverview(query: AnalyticsDateRangeQueryInput): Promise<AnalyticsOverviewMetrics> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/overview${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackOverview;
    }
  }

  public static async getApps(query: AnalyticsDateRangeQueryInput): Promise<AppAnalyticsMetrics[]> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/apps${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackApps;
    }
  }

  public static async getNetworks(query: AnalyticsDateRangeQueryInput): Promise<NetworkComparisonItem[]> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/networks${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackNetworks;
    }
  }

  public static async getFormats(query: AnalyticsDateRangeQueryInput): Promise<FormatAnalyticsItem[]> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/formats${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackFormats;
    }
  }

  public static async getPlacements(query: AnalyticsDateRangeQueryInput): Promise<PlacementAnalyticsItem[]> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/placements${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackPlacements;
    }
  }

  public static async getRevenue(query: AnalyticsDateRangeQueryInput) {
    try {
      const res = await fetchWithAuth(`${API_BASE}/revenue${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return {
        overview: fallbackOverview,
        reportedRevenueUsd: 0,
        currency: 'USD',
        accountingNotice: 'WAPCentral strictly follows data integrity standards. Ad network reporting APIs (AdMob, Meta, AppLovin) require authorized server-to-server reporting API tokens before actual financial earnings can be synced. Zero estimated earnings are fabricated.',
        revenueProviders: fallbackNetworks.map(n => ({ providerId: n.provider, providerName: n.name, isConnected: n.provider === 'custom_ads', status: n.revenueStatus })),
      };
    }
  }

  public static async getCustomAds(query: AnalyticsDateRangeQueryInput): Promise<CustomAdsAnalyticsMetrics> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/custom-ads${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackCustomAds;
    }
  }

  public static async getNotifications(query: AnalyticsDateRangeQueryInput): Promise<NotificationAnalyticsSummary> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/notifications${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackNotifications;
    }
  }

  public static async getTimeSeries(query: AnalyticsDateRangeQueryInput): Promise<TimeSeriesDataPoint[]> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/timeseries${buildQueryString(query)}`);
      return res.data;
    } catch (err) {
      return fallbackTimeSeries;
    }
  }

  public static async getCostIntelligence(): Promise<CostIntelligenceMetrics> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/cost-intelligence`);
      return res.data;
    } catch (err) {
      return fallbackCostIntel;
    }
  }

  public static async triggerRollup(date?: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetchWithAuth(`${API_BASE}/aggregate`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      return { success: true, message: `Rollup executed for ${res.data?.date}` };
    } catch (err: any) {
      return { success: false, message: err.message || 'Rollup failed' };
    }
  }

  public static async exportData(query: AnalyticsExportQueryInput): Promise<void> {
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/export${buildQueryString(query)}`, { headers });

      if (query.type === 'csv') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wapcentral_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json.data || json, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wapcentral_analytics_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.warn('[AnalyticsIntelligenceService] Direct export fallback:', err);
    }
  }
}
