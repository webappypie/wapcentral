import { COLLECTIONS } from '@wapcentral/config';
import type { UsageEvent } from '@wapcentral/types';
import { getFirestoreDb } from './firestore.js';

const memoryUsageEvents: UsageEvent[] = [];

export interface RecordUsageInput {
  appId: string;
  providerId: string;
  modelId: string;
  feature: string;
  requestId: string;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  costEstimateUsd?: number | undefined;
  latencyMs: number;
  success: boolean;
  error?: string | undefined;
}

/**
 * Asynchronously records a model usage event.
 * Non-blocking: returns immediately without stalling gateway response to mobile apps.
 * Writes directly to real Firestore usageEvents collection and aggregates usageDaily.
 */
export function recordUsage(event: RecordUsageInput): void {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0]!; // YYYY-MM-DD
  const id = `use_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const usageEvent: UsageEvent = {
    id,
    appId: event.appId,
    providerId: event.providerId,
    modelId: event.modelId,
    feature: event.feature,
    requestId: event.requestId,
    latencyMs: event.latencyMs,
    success: event.success,
    timestamp,
    ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
    ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
    ...(event.costEstimateUsd !== undefined ? { costEstimateUsd: event.costEstimateUsd } : {}),
    ...(event.error ? { error: event.error } : {}),
  };

  // Immediate in-memory ring buffer (for live debugging/telemetry)
  memoryUsageEvents.push(usageEvent);
  if (memoryUsageEvents.length > 5000) {
    memoryUsageEvents.shift();
  }

  // Non-blocking fire-and-forget write to real Firestore in production
  void (async () => {
    try {
      const db = getFirestoreDb();
      // 1. Write immutable raw event
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc(id).set(usageEvent);

      // 2. Aggregate into daily usage document (appId_providerId_YYYY-MM-DD)
      const dailyDocId = `${event.appId}_${event.providerId}_${dateStr}`;
      const dailyRef = db.collection(COLLECTIONS.USAGE_DAILY).doc(dailyDocId);
      const existingSnap = await dailyRef.get();
      const current = existingSnap.exists ? existingSnap.data() || {} : null;

      const inputTokens = event.inputTokens || 0;
      const outputTokens = event.outputTokens || 0;
      const costEstimateUsd = event.costEstimateUsd || 0;

      if (current) {
        const nextRequestCount = (current['requestCount'] || 0) + 1;
        const nextInputTokens = (current['inputTokens'] || 0) + inputTokens;
        const nextOutputTokens = (current['outputTokens'] || 0) + outputTokens;
        const nextCostUsd = Number(((current['costEstimateUsd'] || 0) + costEstimateUsd).toFixed(6));
        const nextErrorCount = (current['errorCount'] || 0) + (event.success ? 0 : 1);
        const prevTotalLat = (current['avgLatencyMs'] || 0) * (current['requestCount'] || 1);
        const nextAvgLat = Math.round((prevTotalLat + event.latencyMs) / nextRequestCount);

        await dailyRef.set(
          {
            requestCount: nextRequestCount,
            inputTokens: nextInputTokens,
            outputTokens: nextOutputTokens,
            costEstimateUsd: nextCostUsd,
            errorCount: nextErrorCount,
            avgLatencyMs: nextAvgLat,
          },
          { merge: true },
        );
      } else {
        await dailyRef.set({
          id: dailyDocId,
          appId: event.appId,
          providerId: event.providerId,
          date: dateStr,
          requestCount: 1,
          inputTokens,
          outputTokens,
          costEstimateUsd: Number(costEstimateUsd.toFixed(6)),
          errorCount: event.success ? 0 : 1,
          avgLatencyMs: event.latencyMs,
        });
      }
    } catch {
      // Silent catch: usage logging must never crash the service or block gateway execution
    }
  })();
}

export function getUsageEvents(appId?: string): UsageEvent[] {
  if (appId) {
    return memoryUsageEvents.filter((e) => e.appId === appId);
  }
  return [...memoryUsageEvents];
}

export function clearUsageEventsForTest(): void {
  memoryUsageEvents.length = 0;
}
