/**
 * @wapcentral/provider-sdk
 *
 * AI Provider Abstraction Layer
 *
 * STUB — Implementation in Phase 5.
 *
 * This package defines the IProvider interface and will contain
 * implementations for OpenAI, Gemini, Anthropic, and self-hosted models.
 *
 * All provider implementations must:
 * - Never store secrets directly (secrets injected via Secret Manager at runtime)
 * - Implement timeout handling
 * - Return normalized responses (no provider-specific shapes leak out)
 * - Support healthCheck() for monitoring
 * - Support estimateCost() for cost tracking (always labeled as estimate)
 */

import type {
  GatewayPayload,
  GatewayResponse,
  HealthStatus,
  CostEstimate,
  TokenUsage,
} from '@wapcentral/types';

// ============================================================
// Provider Interface (platform-agnostic contract)
// ============================================================

export interface GenerateParams {
  payload: GatewayPayload;
  timeoutMs?: number;
}

export interface EmbedParams {
  text: string;
  timeoutMs?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: TokenUsage;
}

export interface CostParams {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

/**
 * IProvider — the interface every AI provider adapter must implement.
 * Implemented by: OpenAIProvider, GeminiProvider, AnthropicProvider, SelfHostedProvider
 */
export interface IProvider {
  readonly providerId: string;
  readonly providerType: string;

  generate(params: GenerateParams): Promise<GatewayResponse>;
  analyzeImage(params: GenerateParams): Promise<GatewayResponse>;
  embed(params: EmbedParams): Promise<EmbeddingResponse>;
  healthCheck(): Promise<HealthStatus>;
  estimateCost(params: CostParams): CostEstimate;
}

// ============================================================
// Provider Error Types
// ============================================================

export class ProviderError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export type ProviderErrorCode =
  | 'AUTH_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'PROVIDER_ERROR'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_TOO_LONG';

// ============================================================
// Phase 0 Stub Placeholder
// ============================================================

/**
 * TODO (Phase 5): Implement these provider classes:
 * - OpenAIProvider implements IProvider
 * - GeminiProvider implements IProvider
 * - AnthropicProvider implements IProvider
 * - SelfHostedProvider implements IProvider
 *
 * TODO (Phase 5): Implement ProviderRegistry:
 * - registerProvider(provider: IProvider): void
 * - getProvider(providerId: string): IProvider
 * - listProviders(): IProvider[]
 *
 * TODO (Phase 6): Implement ProviderRouter:
 * - route(policy: AiPolicy, request: GatewayRequest): Promise<GatewayResponse>
 * - fallback handling
 * - quota enforcement
 * - usage recording
 */

export const PROVIDER_SDK_VERSION = '0.1.0-stub';
