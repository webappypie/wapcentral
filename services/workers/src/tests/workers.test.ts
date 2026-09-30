import { describe, it, expect } from 'vitest';
import type { UsageEvent } from '@wapcentral/types';
import { aggregateUsageDaily, pruneExpiredEvents, processUsageBatch } from '../index.js';

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
});
