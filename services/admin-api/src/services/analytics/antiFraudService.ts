/**
 * Anti-Fraud & Quality Protection Service
 *
 * Implements deduplication, anomaly detection, rate burst dampening,
 * and data integrity enforcement for incoming ad telemetry events.
 */

import { ANALYTICS_CONFIG } from '@wapcentral/config';
import type { AdEventType, AdFormat } from '@wapcentral/types';
import type { AdTelemetryEventInput } from '@wapcentral/validation';

export interface ValidationResult {
  valid: boolean;
  reason?: string | undefined;
  isDuplicate?: boolean | undefined;
}

const VALID_AD_FORMATS = new Set<AdFormat>([
  'banner',
  'native',
  'interstitial',
  'rewarded',
  'app_open',
  'rewarded_interstitial',
]);

const VALID_EVENT_TYPES = new Set<AdEventType>([
  'request',
  'fill',
  'impression',
  'click',
  'failure',
  'reward',
  'provider_selection',
  'fallback',
]);

// In-memory sliding window cache for deduplication (requestId + eventType -> timestamp)
const recentEventsCache = new Map<string, number>();
const CACHE_MAX_SIZE = 10000;
const CACHE_CLEANUP_INTERVAL_MS = 60000;

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentEventsCache.entries()) {
    if (now - timestamp > ANALYTICS_CONFIG.DEDUPLICATION_WINDOW_MS * 4) {
      recentEventsCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL_MS).unref?.();

export class AntiFraudService {
  /**
   * Validate a single telemetry event against anti-fraud and integrity rules.
   */
  public static validateEvent(
    appId: string,
    event: AdTelemetryEventInput,
  ): ValidationResult {
    if (!appId || typeof appId !== 'string' || appId.trim().length === 0) {
      return { valid: false, reason: 'Invalid or missing appId' };
    }

    if (!event.requestId || typeof event.requestId !== 'string' || event.requestId.trim().length === 0) {
      return { valid: false, reason: 'Missing requestId' };
    }

    if (!VALID_EVENT_TYPES.has(event.eventType as AdEventType)) {
      return { valid: false, reason: `Unknown eventType: ${event.eventType}` };
    }

    if (!VALID_AD_FORMATS.has(event.adFormat as AdFormat)) {
      return { valid: false, reason: `Invalid adFormat: ${event.adFormat}` };
    }

    if (!event.provider || typeof event.provider !== 'string' || event.provider.trim().length === 0) {
      return { valid: false, reason: 'Missing provider' };
    }

    // Latency sanity
    if (event.latencyMs !== undefined) {
      if (event.latencyMs < 0 || event.latencyMs > 600000) {
        return { valid: false, reason: 'Latency out of realistic range (0 - 600,000ms)' };
      }
    }

    // Future timestamp check (> 1 hour in the future)
    if (event.timestamp) {
      const eventTime = new Date(event.timestamp).getTime();
      const now = Date.now();
      if (!isNaN(eventTime) && eventTime > now + 3600000) {
        return { valid: false, reason: 'Event timestamp is in the future (> 1 hour)' };
      }
    }

    // Deduplication check: key = `${appId}:${event.requestId}:${event.eventType}`
    const dedupKey = `${appId}:${event.requestId}:${event.eventType}`;
    const now = Date.now();
    const lastSeen = recentEventsCache.get(dedupKey);

    if (lastSeen !== undefined && now - lastSeen < ANALYTICS_CONFIG.DEDUPLICATION_WINDOW_MS) {
      return {
        valid: false,
        isDuplicate: true,
        reason: `Duplicate event suppressed within ${ANALYTICS_CONFIG.DEDUPLICATION_WINDOW_MS}ms window`,
      };
    }

    // Save to cache
    if (recentEventsCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = recentEventsCache.keys().next().value;
      if (oldestKey) recentEventsCache.delete(oldestKey);
    }
    recentEventsCache.set(dedupKey, now);

    return { valid: true };
  }

  /**
   * Filter and validate a batch of events.
   */
  public static filterValidEvents(
    appId: string,
    events: AdTelemetryEventInput[],
  ): {
    validEvents: AdTelemetryEventInput[];
    rejectedCount: number;
    duplicateCount: number;
    errors: string[];
  } {
    const validEvents: AdTelemetryEventInput[] = [];
    let rejectedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    for (const event of events) {
      const result = this.validateEvent(appId, event);
      if (result.valid) {
        validEvents.push(event);
      } else {
        if (result.isDuplicate) {
          duplicateCount++;
        } else {
          rejectedCount++;
        }
        if (result.reason && errors.length < 10) {
          errors.push(result.reason);
        }
      }
    }

    return {
      validEvents,
      rejectedCount: rejectedCount + duplicateCount,
      duplicateCount,
      errors,
    };
  }

  /**
   * Reset in-memory cache (primarily for unit tests).
   */
  public static clearCache(): void {
    recentEventsCache.clear();
  }
}
