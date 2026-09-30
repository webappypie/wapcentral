import type { CostEstimate } from '@wapcentral/types';
import type { CostParams } from './types.js';

export interface ModelRate {
  inputPer1k: number;
  outputPer1k: number;
}

/**
 * Standard reference rate card in USD per 1,000 tokens.
 * All generated cost numbers are clearly labeled as estimates.
 */
export const DEFAULT_MODEL_RATES: Record<string, ModelRate> = {
  // OpenAI
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'text-embedding-3-small': { inputPer1k: 0.00002, outputPer1k: 0 },
  'text-embedding-3-large': { inputPer1k: 0.00013, outputPer1k: 0 },

  // Google Gemini
  'gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  'gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.005 },
  'gemini-2.0-flash': { inputPer1k: 0.0001, outputPer1k: 0.0004 },
  'text-embedding-004': { inputPer1k: 0.000025, outputPer1k: 0 },

  // Anthropic
  'claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-haiku': { inputPer1k: 0.0008, outputPer1k: 0.004 },
  'claude-3-opus': { inputPer1k: 0.015, outputPer1k: 0.075 },

  // Self-hosted (zero cloud API cost by default)
  'llama-3.1-8b': { inputPer1k: 0, outputPer1k: 0 },
  'llama-3.3-70b': { inputPer1k: 0, outputPer1k: 0 },
  'mistral-7b': { inputPer1k: 0, outputPer1k: 0 },
  'deepseek-r1': { inputPer1k: 0, outputPer1k: 0 },
};

/**
 * Calculates estimated cost for model usage.
 * Result is strictly marked with isEstimate: true.
 */
export function estimateCost(
  params: CostParams,
  customRates?: { inputCostPer1kTokens?: number; outputCostPer1kTokens?: number },
): CostEstimate {
  const rate: ModelRate = {
    inputPer1k:
      customRates?.inputCostPer1kTokens ?? DEFAULT_MODEL_RATES[params.modelId]?.inputPer1k ?? 0.001,
    outputPer1k:
      customRates?.outputCostPer1kTokens ??
      DEFAULT_MODEL_RATES[params.modelId]?.outputPer1k ??
      0.002,
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
