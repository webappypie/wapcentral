import type { UsageEvent } from '@wapcentral/types';

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
 */
export function recordUsage(event: RecordUsageInput): void {
  const usageEvent: UsageEvent = {
    id: `use_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    appId: event.appId,
    providerId: event.providerId,
    modelId: event.modelId,
    feature: event.feature,
    requestId: event.requestId,
    latencyMs: event.latencyMs,
    success: event.success,
    timestamp: new Date().toISOString(),
    ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
    ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
    ...(event.costEstimateUsd !== undefined ? { costEstimateUsd: event.costEstimateUsd } : {}),
    ...(event.error ? { error: event.error } : {}),
  };

  // Immediate in-memory buffer
  memoryUsageEvents.push(usageEvent);

  // Keep ring buffer at max 5000 items
  if (memoryUsageEvents.length > 5000) {
    memoryUsageEvents.shift();
  }

  // Non-blocking fire-and-forget write to Firestore in production
  void (async () => {
    try {
      // In production, write to Firestore usageEvents collection
    } catch {
      // Silent catch: usage logging must never crash the service
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
