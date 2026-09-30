import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { IProvider } from '@wapcentral/provider-sdk';
import { ProviderError } from '@wapcentral/provider-sdk';
import { registerMockAdapter, clearMockAdapters } from '../services/router.js';
import { resetQuotasForTest, setPolicy } from '../services/policyEngine.js';
import { clearUsageEventsForTest, getUsageEvents } from '../services/usageRecorder.js';

describe('AI Gateway Service Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    clearMockAdapters();
    resetQuotasForTest();
    clearUsageEventsForTest();
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
});
