/**
 * Analytics Event Ingestion Service
 *
 * Handles high-throughput, non-blocking ingestion of ad telemetry events
 * from mobile SDKs and platform API clients.
 * Partitions raw events into dedicated Firestore collections and triggers
 * incremental daily aggregations.
 */

import crypto from 'crypto';
import { COLLECTIONS, ANALYTICS_CONFIG } from '@wapcentral/config';
import type {
  AdTelemetryEventDoc,
  AdTelemetryIngestResult,
  CustomAdAnalyticsDoc,
} from '@wapcentral/types';
import type { AdTelemetryEventInput } from '@wapcentral/validation';
import { getFirestoreDb } from '../firestore.js';
import { AntiFraudService } from './antiFraudService.js';
import { recordIncrementalAggregate } from './analyticsAggregationService.js';

// In-memory fallback event store for offline/testing resilience
const inMemoryEvents: AdTelemetryEventDoc[] = [];

/**
 * Map an event type to its destination Firestore collection.
 */
function getCollectionForEventType(eventType: string): string {
  switch (eventType) {
    case 'impression':
      return COLLECTIONS.AD_IMPRESSION_EVENTS;
    case 'click':
      return COLLECTIONS.AD_CLICK_EVENTS;
    case 'request':
      return COLLECTIONS.AD_REQUEST_EVENTS;
    case 'fill':
      return COLLECTIONS.AD_FILL_EVENTS;
    case 'failure':
      return COLLECTIONS.AD_FAILURE_EVENTS;
    case 'reward':
      return COLLECTIONS.AD_REWARD_EVENTS;
    case 'provider_selection':
    case 'fallback':
    default:
      return COLLECTIONS.AD_PROVIDER_EVENTS;
  }
}

export class AnalyticsEventService {
  /**
   * Ingest a batch of telemetry events for an application.
   */
  public static async recordEvents(
    appId: string,
    rawEvents: AdTelemetryEventInput[],
  ): Promise<AdTelemetryIngestResult> {
    const { validEvents, rejectedCount, errors } = AntiFraudService.filterValidEvents(
      appId,
      rawEvents,
    );

    if (validEvents.length === 0) {
      return {
        accepted: 0,
        rejected: rejectedCount,
        errors,
      };
    }

    const nowIso = new Date().toISOString();
    const eventDocs: AdTelemetryEventDoc[] = validEvents.map((input) => {
      const id = crypto.randomUUID();
      const timestamp = input.timestamp ? new Date(input.timestamp).toISOString() : nowIso;

      return {
        id,
        requestId: input.requestId,
        appId,
        eventType: input.eventType as any,
        adFormat: input.adFormat as any,
        provider: input.provider,
        placementId: input.placementId,
        adUnitId: input.adUnitId,
        campaignId: input.campaignId,
        creativeId: input.creativeId,
        rewardType: input.rewardType,
        rewardAmount: input.rewardAmount,
        failureReason: input.failureReason,
        errorCode: input.errorCode,
        latencyMs: input.latencyMs,
        environment: input.environment || 'production',
        platform: input.platform || 'android',
        appVersion: input.appVersion,
        sdkVersion: input.sdkVersion,
        timestamp,
        createdAt: nowIso,
        metadata: input.metadata as Record<string, unknown> | undefined,
      };
    });

    // In-memory store
    inMemoryEvents.push(...eventDocs);
    if (inMemoryEvents.length > 5000) {
      inMemoryEvents.splice(0, inMemoryEvents.length - 5000);
    }

    // Persist to Firestore asynchronously / safely
    try {
      const db = getFirestoreDb();
      for (const eventDoc of eventDocs) {
        const targetCollection = getCollectionForEventType(eventDoc.eventType);
        await db.collection(targetCollection).doc(eventDoc.id).set(eventDoc);

        // Track custom ads events separately if provider is custom_ads
        if (eventDoc.provider === 'custom_ads' && (eventDoc.eventType === 'impression' || eventDoc.eventType === 'click')) {
          const customAdDoc: CustomAdAnalyticsDoc = {
            id: eventDoc.id,
            campaignId: eventDoc.campaignId || 'internal',
            appId: eventDoc.appId,
            creativeId: eventDoc.creativeId,
            eventType: eventDoc.eventType,
            placementId: eventDoc.placementId,
            timestamp: eventDoc.timestamp,
            environment: eventDoc.environment,
          };
          await db.collection(COLLECTIONS.CUSTOM_AD_ANALYTICS).doc(eventDoc.id).set(customAdDoc);
        }
      }
    } catch (err) {
      // Non-blocking: log error but do not fail mobile client request
      console.warn('[AnalyticsEventService] Firestore write fallback/error:', err);
    }

    // Incremental aggregation
    for (const doc of eventDocs) {
      try {
        recordIncrementalAggregate(doc);
      } catch (err) {
        console.warn('[AnalyticsEventService] Incremental aggregate error:', err);
      }
    }

    return {
      accepted: eventDocs.length,
      rejected: rejectedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get in-memory events (useful for tests or quick fallback).
   */
  public static getInMemoryEvents(): AdTelemetryEventDoc[] {
    return [...inMemoryEvents];
  }

  /**
   * Clear in-memory events.
   */
  public static clearInMemoryEvents(): void {
    inMemoryEvents.length = 0;
  }
}
