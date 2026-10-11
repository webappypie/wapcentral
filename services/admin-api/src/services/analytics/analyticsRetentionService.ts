/**
 * Analytics Data Retention Service
 *
 * Enforces data retention policies:
 * - Raw telemetry events: 90 days TTL retention
 * - Daily aggregates: 730 days (2 years) retention
 */

import { ANALYTICS_CONFIG, COLLECTIONS } from '@wapcentral/config';
import { getFirestoreDb } from '../firestore.js';

export interface RetentionCleanupReport {
  rawEventsDeleted: number;
  aggregatesDeleted: number;
  cutoffDateRaw: string;
  cutoffDateAggregate: string;
  status: 'completed' | 'failed';
  timestamp: string;
}

export class AnalyticsRetentionService {
  /**
   * Run retention cleanup for events older than configured days.
   */
  public static async runRetentionCleanup(
    rawRetentionDays = ANALYTICS_CONFIG.DEFAULT_RAW_EVENT_RETENTION_DAYS,
    aggregateRetentionDays = ANALYTICS_CONFIG.DEFAULT_AGGREGATE_RETENTION_DAYS,
  ): Promise<RetentionCleanupReport> {
    const now = new Date();

    const rawCutoff = new Date(now);
    rawCutoff.setDate(rawCutoff.getDate() - rawRetentionDays);
    const cutoffDateRaw = rawCutoff.toISOString();

    const aggCutoff = new Date(now);
    aggCutoff.setDate(aggCutoff.getDate() - aggregateRetentionDays);
    const cutoffDateAggregate = aggCutoff.toISOString().slice(0, 10);

    let rawEventsDeleted = 0;
    let aggregatesDeleted = 0;

    try {
      const db = getFirestoreDb();

      // Collections to clean
      const rawCollections = [
        COLLECTIONS.AD_IMPRESSION_EVENTS,
        COLLECTIONS.AD_CLICK_EVENTS,
        COLLECTIONS.AD_REQUEST_EVENTS,
        COLLECTIONS.AD_FILL_EVENTS,
        COLLECTIONS.AD_FAILURE_EVENTS,
        COLLECTIONS.AD_REWARD_EVENTS,
        COLLECTIONS.AD_PROVIDER_EVENTS,
      ];

      for (const collName of rawCollections) {
        try {
          const snapshot = await db.collection(collName).get();
          for (const doc of snapshot.docs) {
            const data = doc.data() as Record<string, any> | undefined;
            if (data?.['timestamp'] && data['timestamp'] < cutoffDateRaw) {
              await db.collection(collName).doc(doc.id).delete();
              rawEventsDeleted++;
            }
          }
        } catch (err) {
          // Non-blocking for offline/unseeded environments
        }
      }

      // Cleanup aggregates
      try {
        const aggSnapshot = await db.collection(COLLECTIONS.ANALYTICS_DAILY_AGGREGATES).get();
        for (const doc of aggSnapshot.docs) {
          const data = doc.data() as Record<string, any> | undefined;
          if (data?.['date'] && data['date'] < cutoffDateAggregate) {
            await db.collection(COLLECTIONS.ANALYTICS_DAILY_AGGREGATES).doc(doc.id).delete();
            aggregatesDeleted++;
          }
        }
      } catch (err) {
        // Non-blocking
      }

      return {
        rawEventsDeleted,
        aggregatesDeleted,
        cutoffDateRaw,
        cutoffDateAggregate,
        status: 'completed',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('[AnalyticsRetentionService] Cleanup error:', err);
      return {
        rawEventsDeleted: 0,
        aggregatesDeleted: 0,
        cutoffDateRaw,
        cutoffDateAggregate,
        status: 'failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
