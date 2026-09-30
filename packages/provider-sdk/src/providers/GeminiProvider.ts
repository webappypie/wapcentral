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

export class GeminiProvider implements IProvider {
  public readonly providerId: string;
  public readonly providerType = 'gemini' as const;

  private readonly apiKey?: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ProviderConfig = {}, providerId = 'gemini') {
    this.providerId = providerId;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = config.timeoutMs || 15000;
    this.fetchFn = config.fetchFn || fetch;
  }

  private buildUrl(path: string): string {
    const sep = path.includes('?') ? '&' : '?';
    return this.apiKey
      ? `${this.baseUrl}${path}${sep}key=${encodeURIComponent(this.apiKey)}`
      : `${this.baseUrl}${path}`;
  }

  async generate(params: GenerateParams): Promise<GatewayResponse> {
    const startTime = Date.now();
    const timeout = params.timeoutMs || this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const parts: Array<{ text: string }> = [];
    if (params.payload.messages && params.payload.messages.length > 0) {
      for (const m of params.payload.messages) {
        parts.push({ text: `${m.role.toUpperCase()}: ${m.content}` });
      }
    } else if (params.payload.prompt) {
      parts.push({ text: params.payload.prompt });
    } else {
      parts.push({ text: '' });
    }

    const body: Record<string, unknown> = {
      contents: [{ parts }],
    };

    if (params.payload.maxTokens || params.payload.temperature !== undefined) {
      body.generationConfig = {
        ...(params.payload.maxTokens ? { maxOutputTokens: params.payload.maxTokens } : {}),
        ...(params.payload.temperature !== undefined
          ? { temperature: params.payload.temperature }
          : {}),
      };
    }

    try {
      const url = this.buildUrl(`/models/${params.modelId}:generateContent`);
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const latencyMs = Date.now() - startTime;
      const content =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
      const usage = {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      };

      return {
        requestId: `gemini_${Date.now()}`,
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
          `Gemini request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Gemini request failed: ${(err as Error).message}`,
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
    let mimeType = 'image/jpeg';

    if (rawBase64.startsWith('data:')) {
      const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1] || 'image/jpeg';
        rawBase64 = match[2] || '';
      }
    }

    const body = {
      contents: [
        {
          parts: [
            { text: params.payload.prompt || 'Analyze this image.' },
            {
              inlineData: {
                mimeType,
                data: rawBase64,
              },
            },
          ],
        },
      ],
    };

    try {
      const url = this.buildUrl(`/models/${params.modelId}:generateContent`);
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const latencyMs = Date.now() - startTime;
      const content =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
      const usage = {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      };

      return {
        requestId: `gemini_${Date.now()}`,
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
          `Gemini image request timed out after ${timeout}ms`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Gemini image request failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async embed(params: EmbedParams): Promise<EmbeddingResponse> {
    const timeout = params.timeoutMs || this.timeoutMs;
    const model = params.modelId || 'text-embedding-004';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = this.buildUrl(`/models/${model}:embedContent`);
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ text: params.text }],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw ProviderError.fromHttpStatus(this.providerId, res.status, errorText);
      }

      const data = (await res.json()) as {
        embedding?: { values?: number[] };
      };

      return {
        embedding: data.embedding?.values || [],
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
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError(
          this.providerId,
          'TIMEOUT',
          `Gemini embedding request timed out`,
          true,
        );
      }
      throw new ProviderError(
        this.providerId,
        'PROVIDER_ERROR',
        `Gemini embedding failed: ${(err as Error).message}`,
        true,
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const url = this.buildUrl('/models');
      const res = await this.fetchFn(url, {
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
