import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchUsageAnalytics,
  subscribeUsageAnalytics,
  fetchCampaignAnalytics,
  subscribeCampaignAnalytics,
  fetchCostAlerts,
  subscribeCostAlerts,
  createCostAlertRule,
  toggleCostAlertRule,
  deleteCostAlertRule,
  fetchDataRetentionPolicy,
  subscribeDataRetentionPolicy,
  updateDataRetentionPolicy,
  triggerManualRetentionPruning,
  resetTestAnalyticsData,
} from '../services/analyticsService.js';
import type { UsageEvent } from '@wapcentral/types';

describe('Usage Analytics Production-Grade Test Suite', () => {
  const mockActor = {
    uid: 'usr_test_admin',
    email: 'admin@webappypie.com',
  };

  const sampleEvents: UsageEvent[] = [
    {
      id: 'evt_1',
      appId: 'wapcentral_admin',
      providerId: 'gemini-production',
      modelId: 'gemini-3.8-flash',
      feature: 'ai_playground',
      requestId: 'req_1',
      inputTokens: 150,
      outputTokens: 250,
      costEstimateUsd: 0.0002,
      latencyMs: 380,
      success: true,
      timestamp: '2026-09-30T10:00:00Z',
    },
    {
      id: 'evt_2',
      appId: 'wapcentral_admin',
      providerId: 'openai-production',
      modelId: 'gpt-4o',
      feature: 'ai_playground',
      requestId: 'req_2',
      inputTokens: 500,
      outputTokens: 500,
      costEstimateUsd: 0.005,
      latencyMs: 820,
      success: false,
      error: 'HTTP 429: credit_balance_exhausted',
      timestamp: '2026-09-30T11:00:00Z',
    },
    {
      id: 'evt_3',
      appId: 'app_01',
      providerId: 'anthropic-production',
      modelId: 'claude-3-5-sonnet',
      feature: 'chat_assistant',
      requestId: 'req_3',
      inputTokens: 300,
      outputTokens: 600,
      costEstimateUsd: 0.003,
      latencyMs: 450,
      success: true,
      timestamp: '2026-09-29T15:00:00Z',
    },
  ];

  beforeEach(() => {
    resetTestAnalyticsData(sampleEvents);
  });

  describe('1. Usage Aggregations & Metrics', () => {
    it('should accurately aggregate requests, tokens, costs, errors and latency', async () => {
      const summary = await fetchUsageAnalytics(30);

      expect(summary.totalRequests).toBe(3);
      expect(summary.totalInputTokens).toBe(950);
      expect(summary.totalOutputTokens).toBe(1350);
      expect(summary.totalTokens).toBe(2300);
      expect(summary.totalCostEstimateUsd).toBe(0.0082);
      expect(summary.totalErrors).toBe(1);
      expect(summary.errorRatePct).toBe(33.33);
      expect(summary.avgLatencyMs).toBe(Math.round((380 + 820 + 450) / 3));
    });

    it('should aggregate by AI provider', async () => {
      const summary = await fetchUsageAnalytics(30);

      expect(summary.byProvider['gemini-production']).toBeDefined();
      expect(summary.byProvider['gemini-production']?.requests).toBe(1);
      expect(summary.byProvider['gemini-production']?.tokens).toBe(400);

      expect(summary.byProvider['openai-production']).toBeDefined();
      expect(summary.byProvider['openai-production']?.requests).toBe(1);
      expect(summary.byProvider['openai-production']?.errorCount).toBe(1);

      expect(summary.byProvider['anthropic-production']).toBeDefined();
      expect(summary.byProvider['anthropic-production']?.requests).toBe(1);
    });

    it('should aggregate by AI model', async () => {
      const summary = await fetchUsageAnalytics(30);

      expect(summary.byModel).toBeDefined();
      expect(summary.byModel?.['gemini-3.8-flash']).toBeDefined();
      expect(summary.byModel?.['gemini-3.8-flash']?.providerId).toBe('gemini-production');
      expect(summary.byModel?.['gpt-4o']?.errorCount).toBe(1);
      expect(summary.byModel?.['claude-3-5-sonnet']?.tokens).toBe(900);
    });

    it('should aggregate by application', async () => {
      const summary = await fetchUsageAnalytics(30);

      expect(summary.byApp['wapcentral_admin']?.requests).toBe(2);
      expect(summary.byApp['app_01']?.requests).toBe(1);
    });

    it('should populate recent telemetry events in descending order', async () => {
      const summary = await fetchUsageAnalytics(30);

      expect(summary.recentEvents).toBeDefined();
      expect(summary.recentEvents?.length).toBe(3);
      // Latest event first
      expect(summary.recentEvents?.[0]?.id).toBe('evt_2');
      expect(summary.recentEvents?.[0]?.success).toBe(false);
      expect(summary.recentEvents?.[0]?.error).toContain('credit_balance_exhausted');
    });

    it('should filter by specific app and provider', async () => {
      const summary = await fetchUsageAnalytics(30, {
        appId: 'wapcentral_admin',
        providerId: 'gemini-production',
      });

      expect(summary.totalRequests).toBe(1);
      expect(summary.byApp['wapcentral_admin']).toBeDefined();
      expect(summary.byApp['app_01']).toBeUndefined();
      expect(summary.byProvider['gemini-production']).toBeDefined();
      expect(summary.byProvider['openai-production']).toBeUndefined();
    });

    it('should return zero totals and empty breakdowns when no events match', async () => {
      resetTestAnalyticsData([]);

      const summary = await fetchUsageAnalytics(30);

      expect(summary.totalRequests).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCostEstimateUsd).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.errorRatePct).toBe(0);
      expect(summary.avgLatencyMs).toBe(0);
      expect(Object.keys(summary.byProvider).length).toBe(0);
      expect(Object.keys(summary.byApp).length).toBe(0);
      expect(Object.keys(summary.byModel || {}).length).toBe(0);
      expect(summary.dailyTrends.length).toBe(0);
      expect(summary.recentEvents?.length).toBe(0);
    });
  });

  describe('2. Cost Alerts & Rules', () => {
    it('should create, evaluate, toggle and delete cost alert rules', async () => {
      const newRule = await createCostAlertRule(
        {
          name: 'OpenAI Daily Cap',
          metric: 'daily_cost_usd',
          threshold: 0.001,
          notifyEmails: ['billing@webappypie.com'],
          enabled: true,
        },
        mockActor,
      );

      expect(newRule.id).toBeDefined();
      expect(newRule.name).toBe('OpenAI Daily Cap');

      const { rules, triggers } = await fetchCostAlerts();
      expect(rules.some((r) => r.id === newRule.id)).toBe(true);

      // Total daily cost exceeds 0.001 -> trigger should be active
      expect(triggers.length).toBeGreaterThanOrEqual(1);

      await toggleCostAlertRule(newRule.id, false, mockActor);
      const afterToggle = await fetchCostAlerts();
      const rule = afterToggle.rules.find((r) => r.id === newRule.id);
      expect(rule?.enabled).toBe(false);

      await deleteCostAlertRule(newRule.id, mockActor);
      const afterDelete = await fetchCostAlerts();
      expect(afterDelete.rules.some((r) => r.id === newRule.id)).toBe(false);
    });
  });

  describe('3. Data Retention Policy & Pruning', () => {
    it('should get and update retention policy and trigger manual pruning', async () => {
      const policy = await fetchDataRetentionPolicy();
      expect(policy.usageEventsTtlDays).toBeGreaterThan(0);

      await updateDataRetentionPolicy(
        {
          usageEventsTtlDays: 45,
          promotionEventsTtlDays: 45,
          auditLogsTtlDays: 180,
        },
        mockActor,
      );

      const updated = await fetchDataRetentionPolicy();
      expect(updated.usageEventsTtlDays).toBe(45);
      expect(updated.promotionEventsTtlDays).toBe(45);

      const result = await triggerManualRetentionPruning(mockActor);
      expect(result.timestamp).toBeDefined();
      expect(result.prunedCount).toBeDefined();
    });
  });

  describe('4. Subscription Listeners', () => {
    it('should deliver initial data and clean up subscription on unmount', () => {
      let receivedData = false;
      const unsub = subscribeUsageAnalytics(30, (summary) => {
        receivedData = true;
        expect(summary.totalRequests).toBeGreaterThanOrEqual(0);
      });

      expect(receivedData).toBe(true);
      expect(typeof unsub).toBe('function');
      unsub();
    });
  });
});
