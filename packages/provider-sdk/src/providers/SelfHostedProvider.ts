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

export interface SelfHostedConfig extends ProviderConfig {
  format?: 'openai_compatible' | 'ollama';
}

export class SelfHostedProvider implements IProvider {
  public readonly providerId: string;
  public readonly providerType = 'self_hosted' as const;

  private readonly apiKey?: string | undefined;
  private readonly baseUrl: string;
  private readonly format: 'openai_compatible' | 'ollama';
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: SelfHostedConfig = {}, providerId = 'self_hosted') {
    this.providerId = providerId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.format = config.format || 'openai_compatible';
    this.timeoutMs = config.timeoutMs || 30000;
    this.fetchFn = config.fetchFn || fetch;
  }

  async generate(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const promptText =
      params.payload.prompt ||
      params.payload.messages?.map((m) => `${m.role}: ${m.content}`).join('\n') ||
      '';

    try {
      let content = '';
      let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

      if (this.format === 'ollama') {
        const res = await this.fetchFn(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: params.modelId,
            prompt: promptText,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
        }

        const data = (await res.json()) as {
          response?: string;
          prompt_eval_count?: number;
          eval_count?: number;
        };

        content = data.response || '';
        usage = {
          inputTokens: data.prompt_eval_count || Math.ceil(promptText.length / 4),
          outputTokens: data.eval_count || Math.ceil(content.length / 4),
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        };
      } else {
        // OpenAI-compatible (vLLM, TGI, LocalAI)
        const messages = params.payload.messages
          ? [...params.payload.messages]
          : [{ role: 'user' as const, content: promptText }];

        const res = await this.fetchFn(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: params.modelId,
            messages,
            ...(params.payload.maxTokens ? { max_tokens: params.payload.maxTokens } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        content = data.choices?.[0]?.message?.content || '';
        usage = {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
      }

      const latencyMs = Date.now() - startTime;

      return {
        requestId: `self_${Date.now()}`,
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
          `Self-hosted request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Self-hosted request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async analyzeImage(params: GenerateParams): Promise<GatewayResponse> {
    // Delegates to generate with prompt
    return this.generate(params);
  }

  async embed(params: EmbedParams): Promise<EmbeddingResponse> {
    const timeout = params.timeoutMs || this.timeoutMs;
    const model = params.modelId || 'llama-3.1-8b';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          prompt: params.text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as { embedding?: number[] };
      return {
        embedding: data.embedding || [],
        model,
        usage: {
          inputTokens: Math.ceil(params.text.length / 4),
          outputTokens: 0,
          totalTokens: Math.ceil(params.text.length / 4),
        },
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Self-hosted embedding failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const endpoint =
        this.format === 'ollama' ? `${this.baseUrl}/api/tags` : `${this.baseUrl}/health`;
      const res = await this.fetchFn(endpoint, {
        method: 'GET',
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
        status: 'degraded',
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
    return estimateCost(params, { inputCostPer1kTokens: 0, outputCostPer1kTokens: 0 });
  }
}
