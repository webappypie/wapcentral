import type { PromotionEvent, PromotionEventType } from '@wapcentral/types';
import { getAllCampaigns, setCampaigns } from './campaignMatcher.js';

let memoryPromotionEvents: PromotionEvent[] = [];

export interface RecordEventInput {
  eventType: PromotionEventType;
  campaignId: string;
  appId: string;
  deviceId?: string | undefined;
  timestamp?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Returns all recorded promotion events, optionally filtered.
 */
export function getPromotionEvents(filter?: {
  campaignId?: string | undefined;
  appId?: string | undefined;
}): PromotionEvent[] {
  return memoryPromotionEvents.filter((evt) => {
    if (filter?.campaignId && evt.campaignId !== filter.campaignId) return false;
    if (filter?.appId && evt.appId !== filter.appId) return false;
    return true;
  });
}

/**
 * Clears buffered events (for testing).
 */
export function clearPromotionEvents(): void {
  memoryPromotionEvents = [];
}

/**
 * Records a promotion impression or click event asynchronously.
 * Non-blocking: immediately updates in-memory buffers and campaign stats.
 */
export function recordPromotionEvent(input: RecordEventInput): PromotionEvent {
  const eventId = `pevt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = input.timestamp || new Date().toISOString();

  const event: PromotionEvent = {
    id: eventId,
    eventType: input.eventType,
    campaignId: input.campaignId,
    appId: input.appId,
    deviceId: input.deviceId,
    timestamp: now,
    metadata: input.metadata,
  };

  memoryPromotionEvents.push(event);

  // Asynchronously update campaign analytics counters
  try {
    const campaigns = getAllCampaigns();
    const camp = campaigns.find((c) => c.id === input.campaignId);
    if (camp) {
      if (!camp.analytics) {
        camp.analytics = { impressions: 0, clicks: 0, ctr: 0 };
      }

      if (input.eventType === 'impression') {
        camp.analytics.impressions += 1;
      } else if (input.eventType === 'click') {
        camp.analytics.clicks += 1;
      }

      if (camp.analytics.impressions > 0) {
        camp.analytics.ctr = camp.analytics.clicks / camp.analytics.impressions;
      }

      setCampaigns(campaigns);
    }
  } catch {
    // Non-blocking fire-and-forget: catch any error silently
  }

  return event;
}
