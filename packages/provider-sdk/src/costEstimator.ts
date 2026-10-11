import type { CostEstimate } from '@wapcentral/types';

import { VERIFIED_MODEL_CATALOG } from './catalog.js';
import type { CostParams } from './types.js';

export interface ModelRate {
  inputPer1k: number;
  outputPer1k: number;
  source?: string;
  lastVerified?: string;
}

/**
 * Standard reference rate card in USD per 1,000 tokens dynamically derived
 * from the centralized, verified production VERIFIED_MODEL_CATALOG.
 * All generated cost numbers are strictly marked as estimates.
 */
export const DEFAULT_MODEL_RATES: Record<string, ModelRate> = Object.fromEntries(
  Object.entries(VERIFIED_MODEL_CATALOG).map(([modelId, spec]) => [
    modelId,
    {
      inputPer1k: spec.inputCostPer1M !== null ? Number((spec.inputCostPer1M / 1000).toFixed(6)) : 0,
      outputPer1k: spec.outputCostPer1M !== null ? Number((spec.outputCostPer1M / 1000).toFixed(6)) : 0,
      source: spec.source,
      lastVerified: spec.lastVerifiedDate,
    },
  ]),
);

/**
 * Calculates estimated cost for model usage.
 * Result is strictly marked with isEstimate: true.
 * NEVER fabricates prices: unlisted models without custom rates evaluate to 0 USD.
 */
export function estimateCost(
  params: CostParams,
  customRates?: { inputCostPer1kTokens?: number; outputCostPer1kTokens?: number },
): CostEstimate {
  const rate: ModelRate = {
    inputPer1k:
      customRates?.inputCostPer1kTokens ?? DEFAULT_MODEL_RATES[params.modelId]?.inputPer1k ?? 0,
    outputPer1k:
      customRates?.outputCostPer1kTokens ?? DEFAULT_MODEL_RATES[params.modelId]?.outputPer1k ?? 0,
  };

  const inputCost = (params.inputTokens / 1000) * rate.inputPer1k;
  const outputCost = (params.outputTokens / 1000) * rate.outputPer1k;
  const total = Number((inputCost + outputCost).toFixed(6));

  return {
    amountUsd: total,
    isEstimate: true,
    currency: 'USD',
  };
}
