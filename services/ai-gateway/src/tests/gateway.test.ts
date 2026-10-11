import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { IProvider } from '@wapcentral/provider-sdk';
import { ProviderError } from '@wapcentral/provider-sdk';
import { registerMockAdapter, clearMockAdapters } from '../services/router.js';
import { resetQuotasForTest, setPolicy } from '../services/policyEngine.js';
import { clearUsageEventsForTest, getUsageEvents } from '../services/usageRecorder.js';
import { circuitBreaker } from '../services/circuitBreaker.js';

describe('AI Gateway Service Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    clearMockAdapters();
    resetQuotasForTest();
    clearUsageEventsForTest();
    circuitBreaker.resetAll();

    setPolicy({
      id: 'policy_chat_01',
      appId: 'app_01',
      feature: 'chat_assistant',
      primaryProviderId: 'gemini',
      primaryModelId: 'gemini-1.5-flash',
      fallbackChain: [
        {
          providerId: 'openai',
          modelId: 'gpt-4o-mini',
          priority: 1,
        },
      ],
      quotas: {
        dailyRequestLimit: 50000,
        dailyTokenLimit: 10000000,
        maxInputTokensPerRequest: 8192,
        maxOutputTokensPerRequest: 2048,
      },
      circuitBreaker: {
        failureThreshold: 3,
        timeoutMs: 10000,
        recoveryTimeMs: 1000,
      },
      priority: 50,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setPolicy({
      id: 'policy_image_01',
      appId: 'app_01',
      feature: 'image_analysis',
      primaryProviderId: 'openai',
      primaryModelId: 'gpt-4o',
      fallbackChain: [],
      quotas: {
        dailyRequestLimit: 10000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        timeoutMs: 10000,
        recoveryTimeMs: 1000,
      },
      priority: 50,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe('Health Checks', () => {
    it('should return 200 OK with service status on /health', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('ai-gateway');
    });

    it('should return 200 OK on /v1/health', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authentication & Validation', () => {
    it('should reject unauthenticated requests with HTTP 401', async () => {
      const res = await request(app)
        .post('/v1/gateway')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'chat_assistant',
          payload: { type: 'generate', prompt: 'Hello' },
          requestId: '123e4567-e89b-12d3-a456-426614174000',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should reject invalid schema payloads with HTTP 400', async () => {
      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          // missing version, environment, requestId
          feature: 'chat_assistant',
          payload: { type: 'generate' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Routing & Execution', () => {
    it('should execute primary provider and return normalized response with cost estimate', async () => {
      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async (params) => ({
          requestId: 'test_req',
          providerId: 'gemini',
          modelId: params.modelId,
          content: 'Hello! I am Gemini.',
          usage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 },
          costEstimate: { amountUsd: 0.0001, isEstimate: true, currency: 'USD' },
          latencyMs: 85,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0.0001, isEstimate: true, currency: 'USD' }),
      };

      registerMockAdapter('gemini', mockGemini);

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'chat_assistant',
          payload: { type: 'generate', prompt: 'Tell me a joke' },
          requestId: '123e4567-e89b-12d3-a456-426614174000',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Hello! I am Gemini.');
      expect(res.body.data.providerId).toBe('gemini');
      expect(res.body.data.modelId).toBe('gemini-1.5-flash');
      expect(res.body.data.costEstimate.isEstimate).toBe(true);
      expect(res.body.data.requestId).toBe('123e4567-e89b-12d3-a456-426614174000');

      // Verify async usage recording
      const events = getUsageEvents('app_01');
      expect(events.length).toBe(1);
      expect(events[0]?.success).toBe(true);
      expect(events[0]?.inputTokens).toBe(15);
    });

    it('should support multimodal image analysis', async () => {
      const mockOpenAI: IProvider = {
        providerId: 'openai',
        providerType: 'openai',
        generate: async () => {
          throw new Error('Not used');
        },
        analyzeImage: async (params) => ({
          requestId: 'test_vision',
          providerId: 'openai',
          modelId: params.modelId,
          content: 'This is a photo of a mountain.',
          usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
          costEstimate: { amountUsd: 0.0004, isEstimate: true, currency: 'USD' },
          latencyMs: 140,
          cached: false,
        }),
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0.0004, isEstimate: true, currency: 'USD' }),
      };

      registerMockAdapter('openai', mockOpenAI);

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'image_analysis',
          payload: {
            type: 'analyze_image',
            prompt: 'What is this?',
            imageData: 'data:image/jpeg;base64,mockimagedata',
          },
          requestId: '987e6543-e21b-12d3-a456-426614174000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('This is a photo of a mountain.');
      expect(res.body.data.providerId).toBe('openai');
    });

    it('should failover to fallback chain when primary provider errors out', async () => {
      // Primary gemini throws ProviderError
      const failingGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => {
          throw new ProviderError('gemini', 'RATE_LIMITED', 'Gemini rate limited', true);
        },
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'unhealthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };

      // Fallback openai succeeds
      const fallbackOpenAI: IProvider = {
        providerId: 'openai',
        providerType: 'openai',
        generate: async (params) => ({
          requestId: 'fallback_req',
          providerId: 'openai',
          modelId: params.modelId,
          content: 'Fallback response from OpenAI',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          costEstimate: { amountUsd: 0.0002, isEstimate: true, currency: 'USD' },
          latencyMs: 95,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0.0002, isEstimate: true, currency: 'USD' }),
      };

      registerMockAdapter('gemini', failingGemini);
      registerMockAdapter('openai', fallbackOpenAI);

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'chat_assistant',
          payload: { type: 'generate', prompt: 'Fallback test' },
          requestId: '555e4567-e89b-12d3-a456-426614174000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Fallback response from OpenAI');
      expect(res.body.data.providerId).toBe('openai');
      expect(res.body.data.modelId).toBe('gpt-4o-mini');
    });
  });

  describe('Quota & Rate Limit Enforcement', () => {
    it('should enforce daily request limits with HTTP 429', async () => {
      // Set strict quota of 2 requests
      setPolicy({
        id: 'policy_limited',
        appId: 'app_01',
        feature: 'chat_assistant',
        primaryProviderId: 'gemini',
        primaryModelId: 'gemini-1.5-flash',
        fallbackChain: [],
        quotas: {
          dailyRequestLimit: 2,
        },
        priority: 100,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => ({
          requestId: 'test',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          content: 'OK',
          latencyMs: 10,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };
      registerMockAdapter('gemini', mockGemini);

      const sendReq = (uuid: string) =>
        request(app)
          .post('/v1/gateway')
          .set('Authorization', 'Bearer mock-token-app')
          .send({
            appId: 'app_01',
            version: '1.0.0',
            environment: 'production',
            feature: 'chat_assistant',
            payload: { type: 'generate', prompt: 'Quota test' },
            requestId: uuid,
          });

      // Req 1: OK
      const r1 = await sendReq('11111111-1111-1111-1111-111111111111');
      expect(r1.status).toBe(200);

      // Req 2: OK
      const r2 = await sendReq('22222222-2222-2222-2222-222222222222');
      expect(r2.status).toBe(200);

      // Req 3: Exceeded -> 429
      const r3 = await sendReq('33333333-3333-3333-3333-333333333333');
      expect(r3.status).toBe(429);
      expect(r3.body.error.code).toBe('QUOTA_EXCEEDED');
    });
  });

  describe('Emergency Kill Switch', () => {
    it('should halt traffic when emergency global kill switch is triggered', async () => {
      // Trigger kill switch
      const switchRes = await request(app)
        .post('/v1/gateway/kill-switch')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({ global: true, disabled: true });

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.data.globalKillSwitch).toBe(true);

      // Attempt request -> 503 Service Unavailable
      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'chat_assistant',
          payload: { type: 'generate', prompt: 'Kill switch test' },
          requestId: '44444444-4444-4444-4444-444444444444',
        });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('KILL_SWITCH_ACTIVE');
    });
  });

  describe('AI Playground Direct Inference Endpoint', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/v1/gateway/playground')
        .send({
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          prompt: 'Hello from unauthenticated test',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should execute playground request on adapter, calculate tokens and cost estimate, and record usage', async () => {
      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async (params) => ({
          requestId: 'test_playground_gemini',
          providerId: 'gemini',
          modelId: params.modelId,
          content: 'Hello! This is Gemini answering in Playground.',
          usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
          costEstimate: { amountUsd: 0.00015, isEstimate: true, currency: 'USD' },
          latencyMs: 75,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0.00015, isEstimate: true, currency: 'USD' }),
      };

      registerMockAdapter('gemini', mockGemini);

      const res = await request(app)
        .post('/v1/gateway/playground')
        .set('Authorization', 'Bearer mock-token-super_admin')
        .send({
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          prompt: 'Tell me about AI Gateway',
          systemPrompt: 'Be concise',
          temperature: 0.7,
          maxTokens: 1024,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Hello! This is Gemini answering in Playground.');
      expect(res.body.data.providerId).toBe('gemini');
      expect(res.body.data.modelId).toBe('gemini-1.5-flash');
      expect(res.body.data.usage.inputTokens).toBe(20);
      expect(res.body.data.usage.outputTokens).toBe(30);
      expect(res.body.data.costEstimate.amountUsd).toBe(0.00015);
      expect(res.body.data.raw).toBeDefined();

      // Check telemetry
      const events = getUsageEvents();
      const last = events.find((e) => e.feature === 'ai_playground');
      expect(last).toBeDefined();
      expect(last?.providerId).toBe('gemini');
      expect(last?.success).toBe(true);
    });

    it('should reject invalid payload with 400 validation error', async () => {
      const res = await request(app)
        .post('/v1/gateway/playground')
        .set('Authorization', 'Bearer mock-token-super_admin')
        .send({
          // missing prompt
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Circuit Breakers & Advanced Policy Routing', () => {
    it('should trip circuit breaker to OPEN after consecutive failures and bypass to fallback', async () => {
      let geminiCallCount = 0;
      const failingGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => {
          geminiCallCount++;
          throw new ProviderError('gemini', 'PROVIDER_ERROR', 'Service outage', false);
        },
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'unhealthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };

      let openAICallCount = 0;
      const fallbackOpenAI: IProvider = {
        providerId: 'openai',
        providerType: 'openai',
        generate: async (params) => {
          openAICallCount++;
          return {
            requestId: 'fb_cb_req',
            providerId: 'openai',
            modelId: params.modelId,
            content: 'OpenAI Fallback Success',
            usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            costEstimate: { amountUsd: 0.0001, isEstimate: true, currency: 'USD' },
            latencyMs: 30,
            cached: false,
          };
        },
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0.0001, isEstimate: true, currency: 'USD' }),
      };

      registerMockAdapter('gemini', failingGemini);
      registerMockAdapter('openai', fallbackOpenAI);

      const sendReq = (uuid: string) =>
        request(app)
          .post('/v1/gateway')
          .set('Authorization', 'Bearer mock-token-app')
          .send({
            appId: 'app_01',
            version: '1.0.0',
            environment: 'production',
            feature: 'chat_assistant',
            payload: { type: 'generate', prompt: 'CB test' },
            requestId: uuid,
          });

      // Request 1: Gemini fails, trips count = 1. OpenAI fallback succeeds.
      const r1 = await sendReq('10000000-0000-0000-0000-000000000001');
      expect(r1.status).toBe(200);
      expect(geminiCallCount).toBe(1);
      expect(openAICallCount).toBe(1);

      // Request 2: Gemini fails, trips count = 2. OpenAI fallback succeeds.
      const r2 = await sendReq('10000000-0000-0000-0000-000000000002');
      expect(r2.status).toBe(200);
      expect(geminiCallCount).toBe(2);
      expect(openAICallCount).toBe(2);

      // Request 3: Gemini fails, trips count = 3 -> Circuit Breaker trips to OPEN!
      const r3 = await sendReq('10000000-0000-0000-0000-000000000003');
      expect(r3.status).toBe(200);
      expect(geminiCallCount).toBe(3);
      expect(openAICallCount).toBe(3);

      // Verify circuit is now OPEN
      const cbState = circuitBreaker.getSnapshot('policy_chat_01:gemini:gemini-1.5-flash');
      expect(cbState.status).toBe('open');

      // Request 4: Circuit is OPEN! Gemini adapter is NOT even called! Fast fails to OpenAI!
      const r4 = await sendReq('10000000-0000-0000-0000-000000000004');
      expect(r4.status).toBe(200);
      expect(geminiCallCount).toBe(3); // Unchanged! Fast fail bypass!
      expect(openAICallCount).toBe(4);
    });

    it('should fail immediately when primary fails and fallback chain is empty (no automatic fallback without config)', async () => {
      // image_analysis policy has fallbackChain: []
      const failingOpenAI: IProvider = {
        providerId: 'openai',
        providerType: 'openai',
        generate: async () => {
          throw new ProviderError('openai', 'PROVIDER_ERROR', 'OpenAI down', false);
        },
        analyzeImage: async () => {
          throw new ProviderError('openai', 'PROVIDER_ERROR', 'OpenAI down', false);
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'unhealthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };
      registerMockAdapter('openai', failingOpenAI);

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'image_analysis',
          payload: { type: 'generate', prompt: 'No fallback test' },
          requestId: '20000000-0000-0000-0000-000000000001',
        });

      // Must return 502 BAD_GATEWAY without falling back to any random provider
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('BAD_GATEWAY');
      expect(res.body.error.message).toContain('OpenAI down');
    });

    it('should enforce rate limits (RPM) with HTTP 429 RATE_LIMIT_EXCEEDED', async () => {
      setPolicy({
        id: 'policy_rate_limited',
        appId: 'app_01',
        feature: 'chat_assistant',
        primaryProviderId: 'gemini',
        primaryModelId: 'gemini-1.5-flash',
        fallbackChain: [],
        quotas: {
          rateLimitRpm: 2, // Only 2 requests per minute allowed
        },
        priority: 100,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => ({
          requestId: 'test_rpm',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          content: 'OK',
          latencyMs: 10,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };
      registerMockAdapter('gemini', mockGemini);

      const sendReq = (uuid: string) =>
        request(app)
          .post('/v1/gateway')
          .set('Authorization', 'Bearer mock-token-app')
          .send({
            appId: 'app_01',
            version: '1.0.0',
            environment: 'production',
            feature: 'chat_assistant',
            payload: { type: 'generate', prompt: 'RPM test' },
            requestId: uuid,
          });

      // Request 1: OK
      const r1 = await sendReq('30000000-0000-0000-0000-000000000001');
      expect(r1.status).toBe(200);

      // Request 2: OK
      const r2 = await sendReq('30000000-0000-0000-0000-000000000002');
      expect(r2.status).toBe(200);

      // Request 3: Exceeds 2 RPM limit
      const r3 = await sendReq('30000000-0000-0000-0000-000000000003');
      expect(r3.status).toBe(429);
      expect(r3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(r3.body.error.message).toContain('requests/minute');
    });

    it('should enforce monthly request limit with HTTP 429 QUOTA_EXCEEDED', async () => {
      setPolicy({
        id: 'policy_monthly_limited',
        appId: 'app_01',
        feature: 'chat_assistant',
        primaryProviderId: 'gemini',
        primaryModelId: 'gemini-1.5-flash',
        fallbackChain: [],
        quotas: {
          monthlyRequestLimit: 1, // Only 1 request allowed this month
        },
        priority: 100,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => ({
          requestId: 'test_month',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          content: 'OK',
          latencyMs: 10,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };
      registerMockAdapter('gemini', mockGemini);

      const sendReq = (uuid: string) =>
        request(app)
          .post('/v1/gateway')
          .set('Authorization', 'Bearer mock-token-app')
          .send({
            appId: 'app_01',
            version: '1.0.0',
            environment: 'production',
            feature: 'chat_assistant',
            payload: { type: 'generate', prompt: 'Month test' },
            requestId: uuid,
          });

      const r1 = await sendReq('40000000-0000-0000-0000-000000000001');
      expect(r1.status).toBe(200);

      const r2 = await sendReq('40000000-0000-0000-0000-000000000002');
      expect(r2.status).toBe(429);
      expect(r2.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(r2.body.error.message).toContain('Monthly request quota');
    });

    it('should prioritize higher priority policy when multiple policies match', async () => {
      // Low priority policy (priority 10)
      setPolicy({
        id: 'policy_low_priority',
        appId: 'app_01',
        feature: 'chat_assistant',
        primaryProviderId: 'openai',
        primaryModelId: 'gpt-4o',
        fallbackChain: [],
        quotas: {},
        priority: 10,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // High priority policy (priority 90)
      setPolicy({
        id: 'policy_high_priority',
        appId: 'app_01',
        feature: 'chat_assistant',
        primaryProviderId: 'gemini',
        primaryModelId: 'gemini-1.5-flash',
        fallbackChain: [],
        quotas: {},
        priority: 90,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockGemini: IProvider = {
        providerId: 'gemini',
        providerType: 'gemini',
        generate: async () => ({
          requestId: 'test_prio',
          providerId: 'gemini',
          modelId: 'gemini-1.5-flash',
          content: 'Gemini high priority',
          latencyMs: 10,
          cached: false,
        }),
        analyzeImage: async () => {
          throw new Error('Not used');
        },
        embed: async () => {
          throw new Error('Not used');
        },
        healthCheck: async () => ({ status: 'healthy', lastCheckedAt: new Date().toISOString() }),
        estimateCost: () => ({ amountUsd: 0, isEstimate: true, currency: 'USD' }),
      };
      registerMockAdapter('gemini', mockGemini);

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'chat_assistant',
          payload: { type: 'generate', prompt: 'Priority test' },
          requestId: '50000000-0000-0000-0000-000000000001',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.providerId).toBe('gemini'); // Chose Gemini (priority 90) over OpenAI (priority 10)
    });

    it('should reject request with HTTP 503 when policy is disabled', async () => {
      setPolicy({
        id: 'policy_disabled',
        appId: 'app_01',
        feature: 'disabled_feature',
        primaryProviderId: 'gemini',
        primaryModelId: 'gemini-1.5-flash',
        fallbackChain: [],
        quotas: {},
        enabled: false, // Disabled
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/v1/gateway')
        .set('Authorization', 'Bearer mock-token-app')
        .send({
          appId: 'app_01',
          version: '1.0.0',
          environment: 'production',
          feature: 'disabled_feature',
          payload: { type: 'generate', prompt: 'Disabled test' },
          requestId: '60000000-0000-0000-0000-000000000001',
        });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('POLICY_DISABLED');
    });
  });
});
