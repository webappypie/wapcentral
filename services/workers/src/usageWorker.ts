import type { UsageEvent, DailyUsage } from '@wapcentral/types';

/**
 * Aggregates raw AI usage events into DailyUsage records.
 * Grouped by appId, providerId, and date (YYYY-MM-DD).
 */
export function aggregateUsageDaily(events: UsageEvent[]): DailyUsage[] {
  const map = new Map<
    string,
    {
      appId: string;
      providerId: string;
      date: string;
      requestCount: number;
      inputTokens: number;
      outputTokens: number;
      costEstimateUsd: number;
      errorCount: number;
      totalLatencyMs: number;
    }
  >();

  for (const event of events) {
    const dateStr = event.timestamp.split('T')[0] || new Date().toISOString().split('T')[0]!;
    const key = `${event.appId}_${event.providerId}_${dateStr}`;

    const existing = map.get(key) || {
      appId: event.appId,
      providerId: event.providerId,
      date: dateStr,
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costEstimateUsd: 0,
      errorCount: 0,
      totalLatencyMs: 0,
    };

    existing.requestCount += 1;
    existing.inputTokens += event.inputTokens || 0;
    existing.outputTokens += event.outputTokens || 0;
    existing.costEstimateUsd += event.costEstimateUsd || 0;
    existing.totalLatencyMs += event.latencyMs;

    if (!event.success) {
      existing.errorCount += 1;
    }

    map.set(key, existing);
  }

  const results: DailyUsage[] = [];
  for (const [key, val] of map.entries()) {
    results.push({
      id: key,
      appId: val.appId,
      providerId: val.providerId,
      date: val.date,
      requestCount: val.requestCount,
      inputTokens: val.inputTokens,
      outputTokens: val.outputTokens,
      costEstimateUsd: Number(val.costEstimateUsd.toFixed(6)),
      errorCount: val.errorCount,
      avgLatencyMs: val.requestCount > 0 ? Math.round(val.totalLatencyMs / val.requestCount) : 0,
    });
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Prunes raw usage events that are older than the retention threshold.
 */
export function pruneExpiredEvents(
  events: UsageEvent[],
  retentionDays = 90,
  referenceDate = new Date(),
): { retained: UsageEvent[]; prunedCount: number } {
  const cutoffTime = referenceDate.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  const retained: UsageEvent[] = [];
  let prunedCount = 0;

  for (const event of events) {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime >= cutoffTime) {
      retained.push(event);
    } else {
      prunedCount += 1;
    }
  }

  return { retained, prunedCount };
}

/**
 * Merges a batch of new events into an existing collection of DailyUsage records.
 */
export function processUsageBatch(
  newEvents: UsageEvent[],
  existingDaily: DailyUsage[] = [],
): { updatedDaily: DailyUsage[]; processedCount: number } {
  const newlyAggregated = aggregateUsageDaily(newEvents);
  const dailyMap = new Map<string, DailyUsage>();

  for (const item of existingDaily) {
    dailyMap.set(item.id, { ...item });
  }

  for (const item of newlyAggregated) {
    const existing = dailyMap.get(item.id);
    if (!existing) {
      dailyMap.set(item.id, item);
    } else {
      const combinedRequests = existing.requestCount + item.requestCount;
      const combinedTotalLatency =
        existing.avgLatencyMs * existing.requestCount + item.avgLatencyMs * item.requestCount;

      dailyMap.set(item.id, {
        id: item.id,
        appId: item.appId,
        providerId: item.providerId,
        date: item.date,
        requestCount: combinedRequests,
        inputTokens: existing.inputTokens + item.inputTokens,
        outputTokens: existing.outputTokens + item.outputTokens,
        costEstimateUsd: Number((existing.costEstimateUsd + item.costEstimateUsd).toFixed(6)),
        errorCount: existing.errorCount + item.errorCount,
        avgLatencyMs:
          combinedRequests > 0 ? Math.round(combinedTotalLatency / combinedRequests) : 0,
      });
    }
  }

  return {
    updatedDaily: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    processedCount: newEvents.length,
  };
}
