import type { GatewayResponse, HealthStatus, CostEstimate } from '@wapcentral/types';
import type {
  IProvider,
  GenerateParams,
  EmbedParams,
  EmbeddingResponse,
  CostParams,
  ProviderConfig,
} from '../types.js';
import { ProviderError } from '../errors.js';
import { estimateCost } from '../costEstimator.js';

export class AnthropicProvider implements IProvider {
  public readonly providerId: string;
  public readonly providerType = 'anthropic' as const;

  private readonly apiKey?: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ProviderConfig = {}, providerId = 'anthropic') {
    this.providerId = providerId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 15000;
    this.fetchFn = config.fetchFn || fetch;
  }

  async generate(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const messages = params.payload.messages
      ? params.payload.messages.map((m) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        }))
      : params.payload.prompt
        ? [{ role: 'user' as const, content: params.payload.prompt }]
        : [{ role: 'user' as const, content: '' }];

    const body: Record<string, unknown> = {
      model: params.modelId,
      messages,
      max_tokens: params.payload.maxTokens || 1024,
      ...(params.payload.temperature !== undefined
        ? { temperature: params.payload.temperature }
        : {}),
    };

    try {
      const res = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        id?: string;
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const latencyMs = Date.now() - startTime;
      const content = data.content?.map((c) => c.text || '').join('\n') || '';
      const usage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };

      return {
        requestId: data.id || `anthropic_${Date.now()}`,
        providerId: this.providerId,
        modelId: params.modelId,
        content,
        usage,
        costEstimate: this.estimateCost({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          modelId: params.modelId,
        }),
        latencyMs,
        cached: false,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError(
          this.providerId,
          'TIMEOUT',
          `Anthropic request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Anthropic request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async analyzeImage(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let rawBase64 = params.payload.imageData || '';
    let mediaType = 'image/jpeg';

    if (rawBase64.startsWith('data:')) {
      const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mediaType = match[1] || 'image/jpeg';
        rawBase64 = match[2] || '';
      }
    }

    const body = {
      model: params.modelId,
      max_tokens: params.payload.maxTokens || 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: rawBase64,
              },
            },
            {
              type: 'text',
              text: params.payload.prompt || 'Describe this image.',
            },
          ],
        },
      ],
    };

    try {
      const res = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        id?: string;
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const latencyMs = Date.now() - startTime;
      const content = data.content?.map((c) => c.text || '').join('\n') || '';
      const usage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };

      return {
        requestId: data.id || `anthropic_${Date.now()}`,
        providerId: this.providerId,
        modelId: params.modelId,
        content,
        usage,
        costEstimate: this.estimateCost({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          modelId: params.modelId,
        }),
        latencyMs,
        cached: false,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError(
          this.providerId,
          'TIMEOUT',
          `Anthropic image request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Anthropic image request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async embed(params: EmbedParams): Promise<EmbeddingResponse> {
    // Anthropic does not have a dedicated embeddings endpoint; inform caller
    throw new ProviderError(
      this.providerId,
      'INVALID_REQUEST',
      'Anthropic does not offer native vector embeddings. Use OpenAI or Gemini.',
      false,
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // Lightweight message check
      const res = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (res.ok || res.status === 400) {
        // 400 may mean ping model parameter differences but proves auth and reachability
        return {
          status: 'healthy',
          latencyMs,
          lastCheckedAt: new Date().toISOString(),
        };
      }

      return {
        status: res.status >= 500 ? 'degraded' : 'unhealthy',
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - startTime,
        lastCheckedAt: new Date().toISOString(),
        error: (err as Error).message,
      };
    }
  }

  estimateCost(params: CostParams): CostEstimate {
    return estimateCost(params);
  }
}
