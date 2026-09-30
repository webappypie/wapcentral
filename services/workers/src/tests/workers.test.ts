import { describe, it, expect } from 'vitest';
import type { UsageEvent } from '@wapcentral/types';
import {
  aggregateUsageDaily,
  pruneExpiredEvents,
  processUsageBatch,
  aggregateUsageBreakdowns,
  evaluateCostAlerts,
  aggregateCampaignPerformance,
} from '../index.js';

describe('Usage Worker', () => {
  const sampleEvents: UsageEvent[] = [
    {
      id: 'e1',
      appId: 'app_01',
      providerId: 'gemini',
      modelId: 'gemini-1.5-flash',
      feature: 'chat_assistant',
      requestId: 'req-1',
      inputTokens: 100,
      outputTokens: 200,
      costEstimateUsd: 0.0005,
      latencyMs: 120,
      success: true,
      timestamp: '2026-09-30T10:00:00Z',
    },
    {
      id: 'e2',
      appId: 'app_01',
      providerId: 'gemini',
      modelId: 'gemini-1.5-flash',
      feature: 'chat_assistant',
      requestId: 'req-2',
      inputTokens: 300,
      outputTokens: 400,
      costEstimateUsd: 0.0015,
      latencyMs: 180,
      success: true,
      timestamp: '2026-09-30T11:00:00Z',
    },
    {
      id: 'e3',
      appId: 'app_01',
      providerId: 'gemini',
      modelId: 'gemini-1.5-flash',
      feature: 'chat_assistant',
      requestId: 'req-3',
      latencyMs: 300,
      success: false,
      error: 'Rate limit',
      timestamp: '2026-09-30T12:00:00Z',
    },
    {
      id: 'e4',
      appId: 'app_02',
      providerId: 'openai',
      modelId: 'gpt-4o',
      feature: 'image_analysis',
      requestId: 'req-4',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimateUsd: 0.0075,
      latencyMs: 400,
      success: true,
      timestamp: '2026-09-30T14:00:00Z',
    },
  ];

  describe('aggregateUsageDaily', () => {
    it('should aggregate events by appId, providerId, and date', () => {
      const daily = aggregateUsageDaily(sampleEvents);
      expect(daily.length).toBe(2);

      const geminiDay = daily.find((d) => d.providerId === 'gemini');
      expect(geminiDay).toBeDefined();
      expect(geminiDay?.appId).toBe('app_01');
      expect(geminiDay?.date).toBe('2026-09-30');
      expect(geminiDay?.requestCount).toBe(3);
      expect(geminiDay?.inputTokens).toBe(400); // 100 + 300
      expect(geminiDay?.outputTokens).toBe(600); // 200 + 400
      expect(geminiDay?.costEstimateUsd).toBe(0.002); // 0.0005 + 0.0015
      expect(geminiDay?.errorCount).toBe(1);
      // avg latency: (120 + 180 + 300) / 3 = 200
      expect(geminiDay?.avgLatencyMs).toBe(200);

      const openaiDay = daily.find((d) => d.providerId === 'openai');
      expect(openaiDay).toBeDefined();
      expect(openaiDay?.requestCount).toBe(1);
      expect(openaiDay?.costEstimateUsd).toBe(0.0075);
    });
  });

  describe('pruneExpiredEvents', () => {
    it('should retain events within retentionDays and prune older ones', () => {
      const referenceDate = new Date('2026-09-30T12:00:00Z');
      const eventsWithOld: UsageEvent[] = [
        ...sampleEvents,
        {
          id: 'old-1',
          appId: 'app_01',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          feature: 'chat',
          requestId: 'old-req-1',
          latencyMs: 100,
          success: true,
          // 100 days older than reference
          timestamp: '2026-06-20T10:00:00Z',
        },
      ];

      const { retained, prunedCount } = pruneExpiredEvents(eventsWithOld, 90, referenceDate);
      expect(retained.length).toBe(4);
      expect(prunedCount).toBe(1);
      expect(retained.some((e) => e.id === 'old-1')).toBe(false);
    });
  });

  describe('processUsageBatch', () => {
    it('should merge new events into existing daily rollups', () => {
      const initial = aggregateUsageDaily([sampleEvents[0]!]);
      expect(initial[0]?.requestCount).toBe(1);

      const { updatedDaily, processedCount } = processUsageBatch([sampleEvents[1]!], initial);
      expect(processedCount).toBe(1);
      expect(updatedDaily[0]?.requestCount).toBe(2);
      expect(updatedDaily[0]?.inputTokens).toBe(400);
      expect(updatedDaily[0]?.outputTokens).toBe(600);
    });
  });

  describe('aggregateUsageBreakdowns', () => {
    it('should calculate overall totals, provider shares, app breakdowns, and daily trends', () => {
      const summary = aggregateUsageBreakdowns(sampleEvents);

      expect(summary.totalRequests).toBe(4);
      expect(summary.totalInputTokens).toBe(1400); // 100 + 300 + 0 + 1000
      expect(summary.totalOutputTokens).toBe(1100); // 200 + 400 + 0 + 500
      expect(summary.totalTokens).toBe(2500);
      expect(summary.totalCostEstimateUsd).toBe(0.0095); // 0.0005 + 0.0015 + 0 + 0.0075
      expect(summary.totalErrors).toBe(1);
      expect(summary.errorRatePct).toBe(25); // 1 / 4 * 100

      // By Provider
      expect(summary.byProvider['gemini']).toBeDefined();
      expect(summary.byProvider['gemini']?.requests).toBe(3);
      expect(summary.byProvider['gemini']?.tokens).toBe(1000);
      expect(summary.byProvider['gemini']?.costEstimateUsd).toBe(0.002);
      expect(summary.byProvider['gemini']?.errorCount).toBe(1);

      expect(summary.byProvider['openai']).toBeDefined();
      expect(summary.byProvider['openai']?.requests).toBe(1);
      expect(summary.byProvider['openai']?.tokens).toBe(1500);
      expect(summary.byProvider['openai']?.costEstimateUsd).toBe(0.0075);

      // By App
      expect(summary.byApp['app_01']?.requests).toBe(3);
      expect(summary.byApp['app_02']?.requests).toBe(1);

      // By Feature
      expect(summary.byFeature['chat_assistant']?.requests).toBe(3);
      expect(summary.byFeature['image_analysis']?.requests).toBe(1);

      // Daily Trends
      expect(summary.dailyTrends.length).toBe(1);
      expect(summary.dailyTrends[0]?.date).toBe('2026-09-30');
      expect(summary.dailyTrends[0]?.requests).toBe(4);
    });

    it('should respect daysLookback filter', () => {
      const refDate = new Date('2026-09-30T23:59:59Z');
      const eventsWithPast: UsageEvent[] = [
        ...sampleEvents,
        {
          id: 'past-1',
          appId: 'app_01',
          providerId: 'gemini',
          modelId: 'gemini-flash',
          feature: 'chat',
          requestId: 'past-req',
          latencyMs: 100,
          success: true,
          timestamp: '2026-08-01T10:00:00Z', // 60 days ago
        },
      ];

      const summary7d = aggregateUsageBreakdowns(eventsWithPast, 7, refDate);
      expect(summary7d.totalRequests).toBe(4); // Excludes past-1
    });
  });

  describe('evaluateCostAlerts', () => {
    const refDate = new Date('2026-09-30T15:00:00Z');

    it('should trigger critical alert when threshold is exceeded (>= 100%)', () => {
      const rules = [
        {
          id: 'rule_daily_cost',
          name: 'Daily Cost Exceeded',
          metric: 'daily_cost_usd' as const,
          threshold: 0.008, // Actual is 0.0095
          enabled: true,
          notifyEmails: ['admin@webappypie.com'],
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ];

      const triggers = evaluateCostAlerts(sampleEvents, rules, refDate);
      expect(triggers.length).toBe(1);
      expect(triggers[0]?.severity).toBe('critical');
      expect(triggers[0]?.ruleId).toBe('rule_daily_cost');
      expect(triggers[0]?.currentValue).toBe(0.0095);
      expect(triggers[0]?.threshold).toBe(0.008);
    });

    it('should trigger warning alert when threshold is nearing (>= 80% and < 100%)', () => {
      const rules = [
        {
          id: 'rule_tokens_warning',
          name: 'Approaching Token Cap',
          metric: 'daily_tokens' as const,
          threshold: 3000, // Actual is 2500 -> 83.3%
          enabled: true,
          notifyEmails: ['admin@webappypie.com'],
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ];

      const triggers = evaluateCostAlerts(sampleEvents, rules, refDate);
      expect(triggers.length).toBe(1);
      expect(triggers[0]?.severity).toBe('warning');
      expect(triggers[0]?.currentValue).toBe(2500);
    });

    it('should not trigger alert when usage is below 80% threshold or rule is disabled', () => {
      const rules = [
        {
          id: 'rule_high_threshold',
          name: 'High Limit',
          metric: 'daily_cost_usd' as const,
          threshold: 100.0,
          enabled: true,
          notifyEmails: [],
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
        {
          id: 'rule_disabled',
          name: 'Disabled Rule',
          metric: 'daily_cost_usd' as const,
          threshold: 0.001,
          enabled: false,
          notifyEmails: [],
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ];

      const triggers = evaluateCostAlerts(sampleEvents, rules, refDate);
      expect(triggers.length).toBe(0);
    });

    it('should filter by appId when specified on rule', () => {
      const rules = [
        {
          id: 'rule_app_01',
          name: 'App 01 Token Limit',
          appId: 'app_01',
          metric: 'daily_tokens' as const,
          threshold: 1000, // app_01 has 1000 tokens -> exactly 100% -> critical
          enabled: true,
          notifyEmails: [],
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ];

      const triggers = evaluateCostAlerts(sampleEvents, rules, refDate);
      expect(triggers.length).toBe(1);
      expect(triggers[0]?.currentValue).toBe(1000);
      expect(triggers[0]?.severity).toBe('critical');
    });
  });

  describe('aggregateCampaignPerformance', () => {
    it('should count impressions, clicks, and compute CTR % accurately', () => {
      const mockCampaigns = [
        {
          id: 'camp_1',
          name: 'Install Reader Campaign',
          promotedAppId: 'app_01',
          targetAppIds: ['app_02'],
          title: 'Try Reader',
          description: 'Best reader',
          ctaText: 'Install',
          storeUrl: 'https://example.com',
          layoutVariant: 'banner' as const,
          priority: 50,
          enabled: true,
          status: 'published' as const,
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
        {
          id: 'camp_2',
          name: 'Zero Impression Campaign',
          promotedAppId: 'app_03',
          targetAppIds: ['app_01'],
          title: 'Try AI Notes',
          description: 'Notes AI',
          ctaText: 'Get it',
          storeUrl: 'https://example.com',
          layoutVariant: 'interstitial' as const,
          priority: 40,
          enabled: true,
          status: 'draft' as const,
          createdAt: '2026-09-30T00:00:00Z',
          updatedAt: '2026-09-30T00:00:00Z',
        },
      ];

      const mockEvents = [
        {
          id: 'pe1',
          eventType: 'impression' as const,
          campaignId: 'camp_1',
          appId: 'app_02',
          timestamp: '2026-09-30T10:00:00Z',
        },
        {
          id: 'pe2',
          eventType: 'impression' as const,
          campaignId: 'camp_1',
          appId: 'app_02',
          timestamp: '2026-09-30T10:05:00Z',
        },
        {
          id: 'pe3',
          eventType: 'click' as const,
          campaignId: 'camp_1',
          appId: 'app_02',
          timestamp: '2026-09-30T10:10:00Z',
        },
      ];

      const performance = aggregateCampaignPerformance(mockCampaigns, mockEvents);
      expect(performance.length).toBe(2);

      const camp1Perf = performance.find((p) => p.campaignId === 'camp_1');
      expect(camp1Perf?.impressions).toBe(2);
      expect(camp1Perf?.clicks).toBe(1);
      // CTR: 1 / 2 * 100 = 50%
      expect(camp1Perf?.ctr).toBe(50);

      const camp2Perf = performance.find((p) => p.campaignId === 'camp_2');
      expect(camp2Perf?.impressions).toBe(0);
      expect(camp2Perf?.clicks).toBe(0);
      expect(camp2Perf?.ctr).toBe(0);
    });
  });
});
