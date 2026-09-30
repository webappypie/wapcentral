import type {
  GatewayPayload,
  GatewayResponse,
  HealthStatus,
  CostEstimate,
  TokenUsage,
  AiProviderType,
} from '@wapcentral/types';

export interface GenerateParams {
  payload: GatewayPayload;
  modelId: string;
  timeoutMs?: number | undefined;
}

export interface EmbedParams {
  text: string;
  modelId?: string | undefined;
  timeoutMs?: number | undefined;
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

export interface ProviderConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  organizationId?: string | undefined;
  timeoutMs?: number | undefined;
  fetchFn?: typeof fetch | undefined;
}

/**
 * Platform-agnostic contract for AI provider implementations.
 * Implemented by OpenAIProvider, GeminiProvider, AnthropicProvider, and SelfHostedProvider.
 */
export interface IProvider {
  readonly providerId: string;
  readonly providerType: AiProviderType;

  /**
   * Generates text/chat completion given a normalized GatewayPayload.
   */
  generate(params: GenerateParams): Promise<GatewayResponse>;

  /**
   * Processes multimodal image understanding given a normalized GatewayPayload with imageData.
   */
  analyzeImage(params: GenerateParams): Promise<GatewayResponse>;

  /**
   * Computes vector embeddings for input text.
   */
  embed(params: EmbedParams): Promise<EmbeddingResponse>;

  /**
   * Performs an active connection test / health probe.
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Calculates estimated usage cost in USD. Always labeled isEstimate: true.
   */
  estimateCost(params: CostParams): CostEstimate;
}
