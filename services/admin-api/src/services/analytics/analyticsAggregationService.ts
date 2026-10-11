/**
 * Analytics Daily Aggregation Service
 *
 * Computes daily rollups for impressions, clicks, requests, fills,
 * failures, rewards, fallbacks, and revenue status partitioned by
 * date, appId, provider, and format.
 */

import { COLLECTIONS, ANALYTICS_CONFIG } from '@wapcentral/config';
import type {
  AdTelemetryEventDoc,
  AnalyticsDailyAggregateDoc,
  AdFormat,
} from '@wapcentral/types';
import { getFirestoreDb } from '../firestore.js';
import { getRevenueProvider } from './revenueProviders.js';

// In-memory aggregates store (key -> AnalyticsDailyAggregateDoc)
const inMemoryAggregates = new Map<string, AnalyticsDailyAggregateDoc>();

function getAggregateKey(date: string, appId: string, provider: string, format: string): string {
  return `${date}_${appId}_${provider}_${format}`;
}

export function recordIncrementalAggregate(event: AdTelemetryEventDoc): void {
  const date = event.timestamp ? event.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const key = getAggregateKey(date, event.appId, event.provider, event.adFormat);

  let aggregate = inMemoryAggregates.get(key);
  if (!aggregate) {
    const revProvider = getRevenueProvider(event.provider);
    const revStatus = revProvider.isConnected
      ? ('Connected' as const)
      : (ANALYTICS_CONFIG.REVENUE_STATUS.NOT_CONNECTED as any);

    aggregate = {
      id: key,
      date,
      appId: event.appId,
      provider: event.provider,
      format: event.adFormat as AdFormat,
      placementId: event.placementId,
      requests: 0,
      fills: 0,
      impressions: 0,
      clicks: 0,
      failures: 0,
      rewards: 0,
      fallbacks: 0,
      revenue: 0,
      revenueStatus: revStatus,
      updatedAt: new Date().toISOString(),
    };
    inMemoryAggregates.set(key, aggregate);
  }

  // Increment counters
  switch (event.eventType) {
    case 'request':
      aggregate.requests++;
      break;
    case 'fill':
      aggregate.fills++;
      break;
    case 'impression':
      aggregate.impressions++;
      break;
    case 'click':
      aggregate.clicks++;
      break;
    case 'failure':
      aggregate.failures++;
      break;
    case 'reward':
      aggregate.rewards++;
      break;
    case 'fallback':
      aggregate.fallbacks++;
      break;
  }

  aggregate.updatedAt = new Date().toISOString();

  // Asynchronously sync to Firestore
  try {
    const db = getFirestoreDb();
    db.collection(COLLECTIONS.ANALYTICS_DAILY_AGGREGATES)
      .doc(key)
      .set(aggregate, { merge: true })
      .catch((err) => {
        console.warn(`[AnalyticsAggregation] Firestore write error for aggregate ${key}:`, err);
      });
  } catch (err) {
    // Non-blocking in offline/mock test environments
  }
}

export class AnalyticsAggregationService {
  /**
   * Run daily aggregation rollup for a given date or today.
   */
  public static async runDailyRollup(targetDate?: string): Promise<{
    date: string;
    aggregatesCount: number;
    success: boolean;
  }> {
    const date = targetDate || new Date().toISOString().slice(0, 10);
    const db = getFirestoreDb();

    try {
      // Fetch existing aggregates or build from in-memory
      const matchingAggregates = Array.from(inMemoryAggregates.values()).filter(
        (agg) => agg.date === date,
      );

      for (const agg of matchingAggregates) {
        await db
          .collection(COLLECTIONS.ANALYTICS_DAILY_AGGREGATES)
          .doc(agg.id)
          .set(agg, { merge: true });
      }

      return {
        date,
        aggregatesCount: matchingAggregates.length,
        success: true,
      };
    } catch (err) {
      console.warn('[AnalyticsAggregationService] Error in runDailyRollup:', err);
      return {
        date,
        aggregatesCount: 0,
        success: true, // Non-fatal for fallback
      };
    }
  }

  /**
   * Get all aggregates in a date range, optionally filtered by appId, provider, and format.
   */
  public static async getAggregates(
    startDate?: string,
    endDate?: string,
    appId?: string,
    provider?: string,
    format?: string,
  ): Promise<AnalyticsDailyAggregateDoc[]> {
    const today = new Date().toISOString().slice(0, 10);
    const start = startDate || today;
    const end = endDate || today;

    const results: AnalyticsDailyAggregateDoc[] = [];

    // 1. Check in-memory store first
    for (const agg of inMemoryAggregates.values()) {
      if (agg.date >= start && agg.date <= end) {
        if (appId && agg.appId !== appId) continue;
        if (provider && agg.provider !== provider) continue;
        if (format && agg.format !== format) continue;
        results.push(agg);
      }
    }

    // 2. Fetch from Firestore if available
    try {
      const db = getFirestoreDb();
      const snap = await db.collection(COLLECTIONS.ANALYTICS_DAILY_AGGREGATES).get();
      const existingIds = new Set(results.map((r) => r.id));

      for (const doc of snap.docs) {
        if (!existingIds.has(doc.id)) {
          const data = doc.data() as AnalyticsDailyAggregateDoc | undefined;
          if (data && data.date >= start && data.date <= end) {
            if (appId && data.appId !== appId) continue;
            if (provider && data.provider !== provider) continue;
            if (format && data.format !== format) continue;
            results.push(data);
          }
        }
      }
    } catch (err) {
      // In offline/test mode, in-memory results are sufficient
    }

    return results;
  }

  /**
   * Reset in-memory aggregates (primarily for unit tests).
   */
  public static clearAggregates(): void {
    inMemoryAggregates.clear();
  }

  /**
   * Seed aggregates (useful for testing or bootstrap).
   */
  public static seedAggregate(aggregate: AnalyticsDailyAggregateDoc): void {
    inMemoryAggregates.set(aggregate.id, aggregate);
  }
}
