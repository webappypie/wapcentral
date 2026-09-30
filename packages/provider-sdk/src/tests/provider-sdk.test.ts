import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
  ProviderRegistry,
  ProviderError,
  estimateCost,
  DEFAULT_MODEL_RATES,
} from '../index.js';

describe('CostEstimator', () => {
  it('should calculate estimated cost correctly for standard models', () => {
    const est = estimateCost({
      inputTokens: 1000,
      outputTokens: 1000,
      modelId: 'gpt-4o',
    });

    expect(est.isEstimate).toBe(true);
    expect(est.currency).toBe('USD');
    // gpt-4o: input 0.0025, output 0.010 -> total 0.0125
    expect(est.amountUsd).toBe(0.0125);
  });

  it('should handle zero-cost models like self-hosted', () => {
    const est = estimateCost({
      inputTokens: 5000,
      outputTokens: 2000,
      modelId: 'llama-3.1-8b',
    });

    expect(est.amountUsd).toBe(0);
    expect(est.isEstimate).toBe(true);
  });

  it('should allow custom rate overrides', () => {
    const est = estimateCost(
      { inputTokens: 2000, outputTokens: 1000, modelId: 'custom-model' },
      { inputCostPer1kTokens: 0.005, outputCostPer1kTokens: 0.02 },
    );

    // input: 2 * 0.005 = 0.01, output: 1 * 0.02 = 0.02 -> 0.03
    expect(est.amountUsd).toBe(0.03);
  });
});

describe('ProviderError', () => {
  it('should map HTTP 401/403 to non-retryable AUTH_ERROR', () => {
    const err = ProviderError.fromHttpStatus('openai', 401, 'Invalid API Key');
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.retryable).toBe(false);
  });

  it('should map HTTP 429 to retryable RATE_LIMITED', () => {
    const err = ProviderError.fromHttpStatus('openai', 429, 'Rate limit exceeded');
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryable).toBe(true);
  });

  it('should map HTTP 500 to retryable PROVIDER_ERROR', () => {
    const err = ProviderError.fromHttpStatus('gemini', 503, 'Service unavailable');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('should map context length error to CONTEXT_TOO_LONG', () => {
    const err = ProviderError.fromHttpStatus(
      'anthropic',
      400,
      'Context window exceeded maximum token limit',
    );
    expect(err.code).toBe('CONTEXT_TOO_LONG');
    expect(err.retryable).toBe(false);
  });
});

describe('OpenAIProvider', () => {
  it('should generate text completion with normalized response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        choices: [{ message: { content: 'Hello from OpenAI' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });

    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await provider.generate({
      modelId: 'gpt-4o',
      payload: { type: 'generate', prompt: 'Hello world' },
    });

    expect(res.providerId).toBe('openai');
    expect(res.modelId).toBe('gpt-4o');
    expect(res.content).toBe('Hello from OpenAI');
    expect(res.usage?.totalTokens).toBe(30);
    expect(res.costEstimate?.isEstimate).toBe(true);
    expect(res.cached).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should analyze image multimodal payloads', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-vision',
        choices: [{ message: { content: 'This is a test image.' } }],
        usage: { prompt_tokens: 100, completion_tokens: 15, total_tokens: 115 },
      }),
    });

    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await provider.analyzeImage({
      modelId: 'gpt-4o',
      payload: { type: 'analyze_image', prompt: 'What is this?', imageData: 'base64sample' },
    });

    expect(res.content).toBe('This is a test image.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle embedding requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 5, total_tokens: 5 },
      }),
    });

    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await provider.embed({ text: 'Embed this string' });

    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(res.model).toBe('text-embedding-3-small');
  });

  it('should report health check status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const health = await provider.healthCheck();

    expect(health.status).toBe('healthy');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('GeminiProvider', () => {
  it('should generate text completion and parse candidates', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini says hi' }] } }],
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25, totalTokenCount: 40 },
      }),
    });

    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await provider.generate({
      modelId: 'gemini-1.5-flash',
      payload: { type: 'generate', prompt: 'Greetings' },
    });

    expect(res.providerId).toBe('gemini');
    expect(res.content).toBe('Gemini says hi');
    expect(res.usage?.totalTokens).toBe(40);
  });

  it('should perform health check on Google models API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const health = await provider.healthCheck();

    expect(health.status).toBe('healthy');
  });
});

describe('AnthropicProvider', () => {
  it('should generate messages completion with normalized usage', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_123',
        content: [{ text: 'Claude here.' }],
        usage: { input_tokens: 12, output_tokens: 18 },
      }),
    });

    const provider = new AnthropicProvider({
      apiKey: 'anthropic-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    const res = await provider.generate({
      modelId: 'claude-3-5-sonnet',
      payload: { type: 'generate', prompt: 'Hi Claude' },
    });

    expect(res.providerId).toBe('anthropic');
    expect(res.content).toBe('Claude here.');
    expect(res.usage?.totalTokens).toBe(30);
  });

  it('should reject embedding requests gracefully', async () => {
    const provider = new AnthropicProvider();
    await expect(provider.embed({ text: 'test' })).rejects.toThrow(
      'Anthropic does not offer native vector embeddings',
    );
  });
});

describe('SelfHostedProvider', () => {
  it('should support OpenAI-compatible endpoints with 0 cost', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Local model response' } }],
        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
      }),
    });

    const provider = new SelfHostedProvider({
      baseUrl: 'http://localhost:8000',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await provider.generate({
      modelId: 'llama-3.1-8b',
      payload: { type: 'generate', prompt: 'Test local' },
    });

    expect(res.providerId).toBe('self_hosted');
    expect(res.content).toBe('Local model response');
    expect(res.costEstimate?.amountUsd).toBe(0);
  });

  it('should support Ollama format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Ollama response',
        prompt_eval_count: 10,
        eval_count: 20,
      }),
    });

    const provider = new SelfHostedProvider({
      format: 'ollama',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await provider.generate({
      modelId: 'llama-3.1-8b',
      payload: { type: 'generate', prompt: 'Ollama test' },
    });

    expect(res.content).toBe('Ollama response');
    expect(res.usage?.totalTokens).toBe(30);
  });
});

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve providers', () => {
    const p1 = new OpenAIProvider({}, 'openai-prod');
    const p2 = new GeminiProvider({}, 'gemini-prod');

    registry.registerProvider(p1);
    registry.registerProvider(p2);

    expect(registry.hasProvider('openai-prod')).toBe(true);
    expect(registry.hasProvider('gemini-prod')).toBe(true);
    expect(registry.hasProvider('nonexistent')).toBe(false);

    expect(registry.getProvider('openai-prod')?.providerType).toBe('openai');
    expect(registry.listProviders()).toHaveLength(2);
  });

  it('should remove and clear providers', () => {
    const p1 = new OpenAIProvider({}, 'openai-prod');
    registry.registerProvider(p1);

    expect(registry.removeProvider('openai-prod')).toBe(true);
    expect(registry.hasProvider('openai-prod')).toBe(false);

    registry.registerProvider(p1);
    registry.clear();
    expect(registry.listProviders()).toHaveLength(0);
  });
});
