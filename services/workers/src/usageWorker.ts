import type {
  UsageEvent,
  DailyUsage,
  CostAlertRule,
  CostAlertTrigger,
  UsageAggregationSummary,
  DailyUsageTrend,
  Campaign,
  PromotionEvent,
  CampaignPerformance,
} from '@wapcentral/types';

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
 * Aggregates raw AI usage events into multi-dimensional breakdown summary
 * (by provider, by app, by feature, and daily trends).
 */
export function aggregateUsageBreakdowns(
  events: UsageEvent[],
  daysLookback?: number,
  referenceDate = new Date(),
): UsageAggregationSummary {
  let filteredEvents = events;
  if (daysLookback && daysLookback > 0) {
    const cutoff = referenceDate.getTime() - daysLookback * 24 * 60 * 60 * 1000;
    filteredEvents = events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  }

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostEstimateUsd = 0;
  let totalErrors = 0;
  let totalLatency = 0;

  const byProvider: Record<
    string,
    {
      requests: number;
      tokens: number;
      costEstimateUsd: number;
      errorCount: number;
      avgLatencyMs: number;
      totalLatency: number;
    }
  > = {};

  const byApp: Record<string, { requests: number; tokens: number; costEstimateUsd: number }> = {};
  const byFeature: Record<string, { requests: number; tokens: number; costEstimateUsd: number }> =
    {};
  const trendsMap = new Map<
    string,
    { requests: number; tokens: number; costEstimateUsd: number }
  >();

  for (const event of filteredEvents) {
    const input = event.inputTokens || 0;
    const output = event.outputTokens || 0;
    const tokens = input + output;
    const cost = event.costEstimateUsd || 0;
    const dateStr = event.timestamp.split('T')[0] || 'unknown';

    totalRequests += 1;
    totalInputTokens += input;
    totalOutputTokens += output;
    totalCostEstimateUsd += cost;
    totalLatency += event.latencyMs;
    if (!event.success) totalErrors += 1;

    // Provider Breakdown
    const p = byProvider[event.providerId] || {
      requests: 0,
      tokens: 0,
      costEstimateUsd: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      totalLatency: 0,
    };
    p.requests += 1;
    p.tokens += tokens;
    p.costEstimateUsd += cost;
    p.totalLatency += event.latencyMs;
    if (!event.success) p.errorCount += 1;
    p.avgLatencyMs = Math.round(p.totalLatency / p.requests);
    byProvider[event.providerId] = p;

    // App Breakdown
    const a = byApp[event.appId] || { requests: 0, tokens: 0, costEstimateUsd: 0 };
    a.requests += 1;
    a.tokens += tokens;
    a.costEstimateUsd += cost;
    byApp[event.appId] = a;

    // Feature Breakdown
    const f = byFeature[event.feature] || { requests: 0, tokens: 0, costEstimateUsd: 0 };
    f.requests += 1;
    f.tokens += tokens;
    f.costEstimateUsd += cost;
    byFeature[event.feature] = f;

    // Daily Trend
    const t = trendsMap.get(dateStr) || { requests: 0, tokens: 0, costEstimateUsd: 0 };
    t.requests += 1;
    t.tokens += tokens;
    t.costEstimateUsd += cost;
    trendsMap.set(dateStr, t);
  }

  const dailyTrends: DailyUsageTrend[] = Array.from(trendsMap.entries())
    .map(([date, val]) => ({
      date,
      requests: val.requests,
      tokens: val.tokens,
      costEstimateUsd: Number(val.costEstimateUsd.toFixed(4)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Clean up internal helper fields from byProvider
  const finalByProvider: UsageAggregationSummary['byProvider'] = {};
  for (const [key, val] of Object.entries(byProvider)) {
    finalByProvider[key] = {
      requests: val.requests,
      tokens: val.tokens,
      costEstimateUsd: Number(val.costEstimateUsd.toFixed(4)),
      errorCount: val.errorCount,
      avgLatencyMs: val.avgLatencyMs,
    };
  }

  // Round cost estimates in byApp & byFeature
  const finalByApp: UsageAggregationSummary['byApp'] = {};
  for (const [key, val] of Object.entries(byApp)) {
    finalByApp[key] = {
      requests: val.requests,
      tokens: val.tokens,
      costEstimateUsd: Number(val.costEstimateUsd.toFixed(4)),
    };
  }

  const finalByFeature: UsageAggregationSummary['byFeature'] = {};
  for (const [key, val] of Object.entries(byFeature)) {
    finalByFeature[key] = {
      requests: val.requests,
      tokens: val.tokens,
      costEstimateUsd: Number(val.costEstimateUsd.toFixed(4)),
    };
  }

  return {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCostEstimateUsd: Number(totalCostEstimateUsd.toFixed(4)),
    totalErrors,
    errorRatePct: totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0,
    avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    byProvider: finalByProvider,
    byApp: finalByApp,
    byFeature: finalByFeature,
    dailyTrends,
  };
}

/**
 * Evaluates active CostAlertRules against current usage metrics and returns
 * triggered alerts with warning or critical status.
 */
export function evaluateCostAlerts(
  events: UsageEvent[],
  rules: CostAlertRule[],
  referenceDate = new Date(),
): CostAlertTrigger[] {
  const triggers: CostAlertTrigger[] = [];
  const todayStr = referenceDate.toISOString().split('T')[0]!;
  const monthStartStr = `${todayStr.slice(0, 7)}-01`;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Filter events by appId if specified by rule
    const relevantEvents = rule.appId ? events.filter((e) => e.appId === rule.appId) : events;

    let currentValue = 0;

    switch (rule.metric) {
      case 'daily_cost_usd': {
        const todayEvents = relevantEvents.filter((e) => e.timestamp.startsWith(todayStr));
        currentValue = todayEvents.reduce((acc, e) => acc + (e.costEstimateUsd || 0), 0);
        break;
      }
      case 'monthly_cost_usd': {
        const monthEvents = relevantEvents.filter((e) => e.timestamp >= monthStartStr);
        currentValue = monthEvents.reduce((acc, e) => acc + (e.costEstimateUsd || 0), 0);
        break;
      }
      case 'daily_tokens': {
        const todayEvents = relevantEvents.filter((e) => e.timestamp.startsWith(todayStr));
        currentValue = todayEvents.reduce(
          (acc, e) => acc + (e.inputTokens || 0) + (e.outputTokens || 0),
          0,
        );
        break;
      }
      case 'monthly_tokens': {
        const monthEvents = relevantEvents.filter((e) => e.timestamp >= monthStartStr);
        currentValue = monthEvents.reduce(
          (acc, e) => acc + (e.inputTokens || 0) + (e.outputTokens || 0),
          0,
        );
        break;
      }
      case 'error_rate_pct': {
        const count = relevantEvents.length;
        const errs = relevantEvents.filter((e) => !e.success).length;
        currentValue = count > 0 ? (errs / count) * 100 : 0;
        break;
      }
    }

    currentValue = Number(currentValue.toFixed(4));
    const pctOfThreshold = (currentValue / rule.threshold) * 100;

    if (pctOfThreshold >= 80) {
      const isCritical = pctOfThreshold >= 100;
      triggers.push({
        id: `trigger_${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        metric: rule.metric,
        currentValue,
        threshold: rule.threshold,
        severity: isCritical ? 'critical' : 'warning',
        appId: rule.appId,
        message: isCritical
          ? `Alert '${rule.name}' threshold exceeded (${currentValue} >= ${rule.threshold})`
          : `Alert '${rule.name}' nearing threshold (${pctOfThreshold.toFixed(1)}% of ${rule.threshold})`,
        triggeredAt: referenceDate.toISOString(),
      });
    }
  }

  return triggers;
}

/**
 * Aggregates campaign performance metrics (impressions, clicks, CTR %).
 */
export function aggregateCampaignPerformance(
  campaigns: Campaign[],
  events: PromotionEvent[],
): CampaignPerformance[] {
  const countsMap = new Map<string, { impressions: number; clicks: number }>();

  for (const event of events) {
    const cur = countsMap.get(event.campaignId) || { impressions: 0, clicks: 0 };
    if (event.eventType === 'impression') {
      cur.impressions += 1;
    } else if (event.eventType === 'click') {
      cur.clicks += 1;
    }
    countsMap.set(event.campaignId, cur);
  }

  return campaigns.map((campaign) => {
    const counts = countsMap.get(campaign.id) || {
      impressions: campaign.analytics?.impressions || 0,
      clicks: campaign.analytics?.clicks || 0,
    };

    const impressions = counts.impressions;
    const clicks = counts.clicks;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      promotedAppId: campaign.promotedAppId,
      layoutVariant: campaign.layoutVariant,
      impressions,
      clicks,
      ctr,
      status: campaign.status,
    };
  });
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
