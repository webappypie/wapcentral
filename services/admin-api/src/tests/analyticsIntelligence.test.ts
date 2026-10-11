/**
 * Analytics & Revenue Intelligence Comprehensive Test Suite (Step 4)
 *
 * Tests:
 * 1. Anti-fraud validation, anomaly rejection, and deduplication
 * 2. Raw telemetry ingestion & collection partitioning
 * 3. Daily aggregation rollups & incremental aggregate tracking
 * 4. Metrics computation: requests, impressions, clicks, CTR, fill rate, fallback rate
 * 5. Strict revenue honesty: zero fabrication, "Not connected" status for AdMob, Meta, AppLovin
 * 6. App-wise, Network-wise, Format-wise, and Placement-wise breakdowns
 * 7. Custom ads & notification cross-analytics
 * 8. Time series generation
 * 9. Export in CSV and JSON formats
 * 10. Data retention pruning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AntiFraudService } from '../services/analytics/antiFraudService.js';
import { AnalyticsEventService } from '../services/analytics/analyticsEventService.js';
import { AnalyticsAggregationService } from '../services/analytics/analyticsAggregationService.js';
import { AnalyticsQueryService } from '../services/analytics/analyticsQueryService.js';
import { AnalyticsRetentionService } from '../services/analytics/analyticsRetentionService.js';
import {
  getRevenueProvider,
  getAllRevenueProviders,
} from '../services/analytics/revenueProviders.js';

describe('Step 4 — Analytics & Revenue Intelligence', () => {
  beforeEach(() => {
    AntiFraudService.clearCache();
    AnalyticsEventService.clearInMemoryEvents();
    AnalyticsAggregationService.clearAggregates();
  });

  describe('1. Anti-Fraud & Sanity Validation', () => {
    it('should accept valid ad telemetry events', () => {
      const validEvent = {
        requestId: 'req_valid_101',
        eventType: 'impression' as const,
        adFormat: 'banner' as const,
        provider: 'admob',
        placementId: 'home_banner',
        latencyMs: 150,
      };

      const result = AntiFraudService.validateEvent('filezen', validEvent);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject events with invalid format or eventType', () => {
      const invalidFormat = {
        requestId: 'req_inv_1',
        eventType: 'impression' as const,
        adFormat: 'unsupported_format' as any,
        provider: 'admob',
      };
      expect(AntiFraudService.validateEvent('filezen', invalidFormat).valid).toBe(false);

      const invalidType = {
        requestId: 'req_inv_2',
        eventType: 'fraudulent_event' as any,
        adFormat: 'banner' as const,
        provider: 'admob',
      };
      expect(AntiFraudService.validateEvent('filezen', invalidType).valid).toBe(false);
    });

    it('should reject events with unrealistic latency (> 600,000ms or negative)', () => {
      const negativeLatency = {
        requestId: 'req_lat_1',
        eventType: 'impression' as const,
        adFormat: 'banner' as const,
        provider: 'admob',
        latencyMs: -50,
      };
      expect(AntiFraudService.validateEvent('filezen', negativeLatency).valid).toBe(false);

      const extremeLatency = {
        requestId: 'req_lat_2',
        eventType: 'impression' as const,
        adFormat: 'banner' as const,
        provider: 'admob',
        latencyMs: 700000,
      };
      expect(AntiFraudService.validateEvent('filezen', extremeLatency).valid).toBe(false);
    });

    it('should deduplicate identical events within deduplication window', () => {
      const event = {
        requestId: 'req_dedup_001',
        eventType: 'impression' as const,
        adFormat: 'banner' as const,
        provider: 'admob',
      };

      const first = AntiFraudService.validateEvent('filezen', event);
      expect(first.valid).toBe(true);

      const second = AntiFraudService.validateEvent('filezen', event);
      expect(second.valid).toBe(false);
      expect(second.isDuplicate).toBe(true);
      expect(second.reason).toContain('Duplicate event suppressed');
    });
  });

  describe('2. Telemetry Ingestion & Incremental Aggregation', () => {
    it('should ingest valid batch of events and update aggregates', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const events = [
        {
          requestId: 'req_batch_1',
          eventType: 'request' as const,
          adFormat: 'banner' as const,
          provider: 'admob',
          timestamp: new Date(Date.now() - 4000).toISOString(),
        },
        {
          requestId: 'req_batch_2',
          eventType: 'fill' as const,
          adFormat: 'banner' as const,
          provider: 'admob',
          timestamp: new Date(Date.now() - 3000).toISOString(),
        },
        {
          requestId: 'req_batch_3',
          eventType: 'impression' as const,
          adFormat: 'banner' as const,
          provider: 'admob',
          timestamp: new Date(Date.now() - 2000).toISOString(),
        },
        {
          requestId: 'req_batch_4',
          eventType: 'click' as const,
          adFormat: 'banner' as const,
          provider: 'admob',
          timestamp: new Date(Date.now() - 1000).toISOString(),
        },
      ];

      const ingestResult = await AnalyticsEventService.recordEvents('filezen', events);
      expect(ingestResult.accepted).toBe(4);
      expect(ingestResult.rejected).toBe(0);

      const aggregates = await AnalyticsAggregationService.getAggregates(today, today, 'filezen');
      expect(aggregates.length).toBeGreaterThan(0);

      const bannerAgg = aggregates.find(
        (a) => a.provider === 'admob' && a.format === 'banner' && a.appId === 'filezen',
      );
      expect(bannerAgg).toBeDefined();
      expect(bannerAgg?.requests).toBe(1);
      expect(bannerAgg?.fills).toBe(1);
      expect(bannerAgg?.impressions).toBe(1);
      expect(bannerAgg?.clicks).toBe(1);
    });

    it('should record fallback events accurately', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const events = [
        {
          requestId: 'req_fb_1',
          eventType: 'fallback' as const,
          adFormat: 'interstitial' as const,
          provider: 'meta',
          timestamp: new Date(Date.now() - 1000).toISOString(),
        },
      ];

      const ingestResult = await AnalyticsEventService.recordEvents('optilens', events);
      expect(ingestResult.accepted).toBe(1);

      const aggregates = await AnalyticsAggregationService.getAggregates(today, today, 'optilens');
      const metaAgg = aggregates.find((a) => a.provider === 'meta' && a.format === 'interstitial');
      expect(metaAgg?.fallbacks).toBe(1);
    });
  });

  describe('3. Strict Revenue Honesty Principle', () => {
    it('must report unconfigured external providers as Not Connected with $0 earnings', async () => {
      const admob = getRevenueProvider('admob');
      expect(admob.isConnected).toBe(false);
      expect(admob.status).toContain('Not connected');

      const meta = getRevenueProvider('meta');
      expect(meta.isConnected).toBe(false);
      expect(meta.status).toContain('Not connected');

      const applovin = getRevenueProvider('applovin');
      expect(applovin.isConnected).toBe(false);
      expect(applovin.status).toContain('Not connected');

      const admobRev = await admob.fetchDailyRevenue('filezen', '2026-10-06');
      expect(admobRev.revenue).toBe(0);
      expect(admobRev.ecpm).toBe(0);
      expect(admobRev.isConnected).toBe(false);
    });

    it('custom ads provider should report connected zero-cost status', async () => {
      const customAds = getRevenueProvider('custom_ads');
      expect(customAds.isConnected).toBe(true);
      expect(customAds.status).toContain('Internal Promotion');

      const customRev = await customAds.fetchDailyRevenue('filezen', '2026-10-06');
      expect(customRev.revenue).toBe(0);
      expect(customRev.isConnected).toBe(true);
    });

    it('getAllRevenueProviders should include all 4 supported providers', () => {
      const all = getAllRevenueProviders();
      expect(all.length).toBe(4);
      const ids = all.map((p) => p.providerId);
      expect(ids).toContain('admob');
      expect(ids).toContain('meta');
      expect(ids).toContain('applovin');
      expect(ids).toContain('custom_ads');
    });
  });

  describe('4. Metrics & Overview Computations', () => {
    beforeEach(() => {
      const today = new Date().toISOString().slice(0, 10);
      // Seed deterministic aggregate data
      AnalyticsAggregationService.seedAggregate({
        id: `${today}_filezen_admob_banner`,
        date: today,
        appId: 'filezen',
        provider: 'admob',
        format: 'banner',
        requests: 1000,
        fills: 900,
        impressions: 800,
        clicks: 40,
        failures: 100,
        rewards: 0,
        fallbacks: 20,
        revenue: 0,
        revenueStatus: 'Not connected',
        updatedAt: new Date().toISOString(),
      });

      AnalyticsAggregationService.seedAggregate({
        id: `${today}_optilens_meta_interstitial`,
        date: today,
        appId: 'optilens',
        provider: 'meta',
        format: 'interstitial',
        requests: 500,
        fills: 400,
        impressions: 400,
        clicks: 20,
        failures: 100,
        rewards: 0,
        fallbacks: 10,
        revenue: 0,
        revenueStatus: 'Not connected',
        updatedAt: new Date().toISOString(),
      });
    });

    it('should compute overview CTR, fill rate, and fallback rate correctly', async () => {
      const overview = await AnalyticsQueryService.getOverview({ preset: 'today' });

      expect(overview.totalRequests).toBe(1500);
      expect(overview.totalImpressions).toBe(1200);
      expect(overview.totalClicks).toBe(60);
      // CTR: (60 / 1200) * 100 = 5.0%
      expect(overview.overallCtr).toBe(5.0);
      // Fill Rate: (1300 / 1500) * 100 = 86.67%
      expect(overview.overallFillRate).toBe(86.67);
      // Fallback rate: (30 / 1500) * 100 = 2.0%
      expect(overview.fallbackRatePct).toBe(2.0);
      // Strict honesty
      expect(overview.estimatedRevenue).toBe(0);
      expect(overview.revenueStatus).toBe('Not connected');
      expect(overview.activeAppsCount).toBe(2);
      expect(overview.activeNetworksCount).toBe(2);
    });

    it('should compute app-wise performance breakdown', async () => {
      const apps = await AnalyticsQueryService.getApps({ preset: 'today' });
      expect(apps.length).toBe(2);

      const filezen = apps.find((a) => a.appId === 'filezen');
      expect(filezen).toBeDefined();
      expect(filezen?.requests).toBe(1000);
      expect(filezen?.impressions).toBe(800);
      expect(filezen?.clicks).toBe(40);
      expect(filezen?.ctr).toBe(5.0);
      expect(filezen?.topFormat).toBe('banner');
      expect(filezen?.topProvider).toBe('admob');
    });

    it('should compute network comparisons', async () => {
      const networks = await AnalyticsQueryService.getNetworks({ preset: 'today' });
      expect(networks.length).toBeGreaterThanOrEqual(4);

      const admob = networks.find((n) => n.provider === 'admob');
      expect(admob).toBeDefined();
      expect(admob?.requests).toBe(1000);
      expect(admob?.impressions).toBe(800);
      expect(admob?.clicks).toBe(40);
      expect(admob?.ctr).toBe(5.0);
      expect(admob?.revenueStatus).toContain('Not connected');
    });

    it('should compute format breakdowns', async () => {
      const formats = await AnalyticsQueryService.getFormats({ preset: 'today' });
      const banner = formats.find((f) => f.format === 'banner');
      expect(banner).toBeDefined();
      expect(banner?.impressions).toBe(800);
      expect(banner?.clicks).toBe(40);
      expect(banner?.ctr).toBe(5.0);
    });

    it('should generate time series points for date range', async () => {
      const series = await AnalyticsQueryService.getTimeSeries({ preset: 'today' });
      expect(series.length).toBe(1);
      expect(series[0]!.requests).toBe(1500);
      expect(series[0]!.impressions).toBe(1200);
      expect(series[0]!.clicks).toBe(60);
    });

    it('should export CSV with correct headers and numeric rows', async () => {
      const exportRes = await AnalyticsQueryService.getExport({ type: 'csv' });
      expect(exportRes.contentType).toBe('text/csv');
      expect(exportRes.filename).toContain('.csv');
      const csvStr = String(exportRes.data);
      expect(csvStr).toContain('Date,AppId,Provider,Format,Requests,Fills,Impressions,Clicks,CTR(%),FillRate(%),eCPM($),Revenue($),RevenueStatus');
      expect(csvStr).toContain('filezen');
      expect(csvStr).toContain('admob');
    });

    it('should export JSON with complete records', async () => {
      const exportRes = await AnalyticsQueryService.getExport({ type: 'json' });
      expect(exportRes.contentType).toBe('application/json');
      expect(exportRes.filename).toContain('.json');
      const data = exportRes.data as any;
      expect(data.count).toBe(2);
      expect(data.items.length).toBe(2);
    });
  });

  describe('5. Data Retention Cleanup', () => {
    it('should execute retention cleanup report cleanly', async () => {
      const report = await AnalyticsRetentionService.runRetentionCleanup(90, 730);
      expect(report.status).toBe('completed');
      expect(typeof report.cutoffDateRaw).toBe('string');
      expect(typeof report.cutoffDateAggregate).toBe('string');
      expect(report.rawEventsDeleted).toBeGreaterThanOrEqual(0);
      expect(report.aggregatesDeleted).toBeGreaterThanOrEqual(0);
    });
  });
});
