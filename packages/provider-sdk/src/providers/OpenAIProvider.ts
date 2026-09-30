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

export class OpenAIProvider implements IProvider {
  public readonly providerId: string;
  public readonly providerType = 'openai' as const;

  private readonly apiKey?: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ProviderConfig = {}, providerId = 'openai') {
    this.providerId = providerId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 15000;
    this.fetchFn = config.fetchFn || fetch;
  }

  async generate(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const messages = params.payload.messages
      ? [...params.payload.messages]
      : params.payload.prompt
        ? [{ role: 'user' as const, content: params.payload.prompt }]
        : [{ role: 'user' as const, content: '' }];

    const body: Record<string, unknown> = {
      model: params.modelId,
      messages,
      ...(params.payload.maxTokens ? { max_tokens: params.payload.maxTokens } : {}),
      ...(params.payload.temperature !== undefined
        ? { temperature: params.payload.temperature }
        : {}),
    };

    try {
      const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
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
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const latencyMs = Date.now() - startTime;
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage
        ? {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      return {
        requestId: data.id || `req_${Date.now()}`,
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
          `OpenAI request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `OpenAI request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async analyzeImage(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const imageUrl = params.payload.imageData?.startsWith('data:')
      ? params.payload.imageData
      : `data:image/jpeg;base64,${params.payload.imageData || ''}`;

    const promptText = params.payload.prompt || 'Describe this image.';

    const body = {
      model: params.modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      ...(params.payload.maxTokens ? { max_tokens: params.payload.maxTokens } : {}),
    };

    try {
      const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
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
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const latencyMs = Date.now() - startTime;
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage
        ? {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      return {
        requestId: data.id || `req_${Date.now()}`,
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
          `OpenAI image request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `OpenAI image request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async embed(params: EmbedParams): Promise<EmbeddingResponse> {
    const timeout = params.timeoutMs || this.timeoutMs;
    const model = params.modelId || 'text-embedding-3-small';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await this.fetchFn(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          input: params.text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
        usage?: { prompt_tokens?: number; total_tokens?: number };
      };

      const embedding = data.data?.[0]?.embedding || [];
      const usage = {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: 0,
        totalTokens: data.usage?.total_tokens || 0,
      };

      return {
        embedding,
        model,
        usage,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError(
          this.providerId,
          'TIMEOUT',
          `OpenAI embedding request timed out`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `OpenAI embedding failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await this.fetchFn(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (res.ok) {
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
