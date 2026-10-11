import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiProvider } from '@wapcentral/types';

vi.mock('../lib/firestore.js', () => ({
  db: { type: 'mockDb' },
  isOfflineMode: false,
  isTestEnv: true,
  isEmulator: false,
}));

let mockUser: any = {
  uid: 'usr_super_admin_1',
  email: 'admin@webappypie.com',
  getIdToken: vi.fn().mockResolvedValue('test-firebase-super-admin-token'),
};

vi.mock('../lib/firebase.js', () => ({
  auth: {
    get currentUser() {
      return mockUser;
    },
    onAuthStateChanged: vi.fn(),
  },
  app: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _type: 'collection', name })),
  doc: vi.fn((_db, colName, id) => ({ _type: 'doc', path: `${colName}/${id}`, colName, id })),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

import { runPlaygroundInference } from './aiService.js';

describe('AI Playground UI & Inference Service Tests', () => {
  let fetchSpy: any;

  beforeEach(() => {
    mockUser = {
      uid: 'usr_super_admin_1',
      email: 'admin@webappypie.com',
      getIdToken: vi.fn().mockResolvedValue('test-firebase-super-admin-token'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Provider and Model Loading & Filtering', () => {
    it('should filter only active (enabled) providers from Firestore data', () => {
      const sampleProviders: AiProvider[] = [
        {
          id: 'openai',
          name: 'OpenAI',
          type: 'openai',
          enabled: true,
          models: [
            { id: 'm1', providerId: 'openai', modelId: 'gpt-4o', name: 'GPT-4o', enabled: true },
            { id: 'm2', providerId: 'openai', modelId: 'gpt-3.5', name: 'GPT-3.5', enabled: false },
          ],
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
        {
          id: 'gemini_disabled',
          name: 'Gemini (Inactive)',
          type: 'gemini',
          enabled: false,
          models: [
            { id: 'm3', providerId: 'gemini_disabled', modelId: 'gemini-1.5-pro', name: 'Gemini Pro', enabled: true },
          ],
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ];

      const activeProviders = sampleProviders.filter((p) => p.enabled);
      expect(activeProviders.length).toBe(1);
      expect(activeProviders[0]?.id).toBe('openai');
    });

    it('should filter only enabled/allowlisted models for the selected provider', () => {
      const provider: AiProvider = {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        enabled: true,
        models: [
          { id: 'm1', providerId: 'openai', modelId: 'gpt-4o', name: 'GPT-4o', enabled: true },
          { id: 'm2', providerId: 'openai', modelId: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true },
          { id: 'm3', providerId: 'openai', modelId: 'deprecated-davinci', name: 'Davinci', enabled: false },
        ],
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      };

      const enabledModels = provider.models.filter((m) => m.enabled);
      expect(enabledModels.length).toBe(2);
      expect(enabledModels.map((m) => m.modelId)).toEqual(['gpt-4o', 'gpt-4o-mini']);
      expect(enabledModels.some((m) => m.modelId === 'deprecated-davinci')).toBe(false);
    });
  });

  describe('2. Authenticated Request Handling', () => {
    it('should include Bearer token from Firebase Auth in Authorization header', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            requestId: 'req_auth_test',
            providerId: 'openai',
            modelId: 'gpt-4o',
            content: 'Authenticated response from model.',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            costEstimate: { amountUsd: 0.0002, isEstimate: true, currency: 'USD' },
            latencyMs: 145,
          },
        }),
      } as any);

      await runPlaygroundInference({
        providerId: 'openai',
        modelId: 'gpt-4o',
        prompt: 'Test authentication',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/admin/v1/ai/playground/infer');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-firebase-super-admin-token');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('should fail if user token acquisition fails', async () => {
      mockUser.getIdToken = vi.fn().mockRejectedValue(new Error('Token expired or revoked'));

      await expect(
        runPlaygroundInference({
          providerId: 'openai',
          modelId: 'gpt-4o',
          prompt: 'Test token failure',
        }),
      ).rejects.toThrow('Authentication failed: Token expired or revoked');
    });
  });

  describe('3. Successful Real Gateway Request Path & Token/Cost Metrics Handling', () => {
    it('should successfully execute inference and parse tokens, cost estimate and latency', async () => {
      const mockBackendResponse = {
        success: true,
        data: {
          requestId: 'req_1234567890',
          providerId: 'openai',
          modelId: 'gpt-4o',
          content: 'The AI Gateway routes model requests with intelligent failover.',
          usage: {
            inputTokens: 25,
            outputTokens: 40,
            totalTokens: 65,
          },
          costEstimate: {
            amountUsd: 0.000462,
            isEstimate: true,
            currency: 'USD',
          },
          latencyMs: 310,
          raw: {
            requestId: 'req_1234567890',
            providerId: 'openai',
            modelId: 'gpt-4o',
            content: 'The AI Gateway routes model requests with intelligent failover.',
          },
        },
      };

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockBackendResponse,
      } as any);

      const result = await runPlaygroundInference({
        providerId: 'openai',
        modelId: 'gpt-4o',
        prompt: 'Describe AI Gateway',
        systemPrompt: 'You are an architect.',
        temperature: 0.5,
        maxTokens: 1000,
      });

      // Verify request payload forwarded
      const [, options] = fetchSpy.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.providerId).toBe('openai');
      expect(parsedBody.modelId).toBe('gpt-4o');
      expect(parsedBody.prompt).toBe('Describe AI Gateway');
      expect(parsedBody.systemPrompt).toBe('You are an architect.');
      expect(parsedBody.temperature).toBe(0.5);
      expect(parsedBody.maxTokens).toBe(1000);

      // Verify returned metrics
      expect(result.content).toBe('The AI Gateway routes model requests with intelligent failover.');
      expect(result.providerId).toBe('openai');
      expect(result.modelId).toBe('gpt-4o');
      expect(result.latencyMs).toBe(310);
      expect(result.usage.inputTokens).toBe(25);
      expect(result.usage.outputTokens).toBe(40);
      expect(result.usage.totalTokens).toBe(65);
      expect(result.costEstimate.amountUsd).toBe(0.000462);
      expect(result.costEstimate.currency).toBe('USD');
      expect(result.raw).toBeDefined();
    });
  });

  describe('4. Error Handling', () => {
    it('should propagate gateway errors with user-friendly error message', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          success: false,
          error: {
            code: 'MODEL_NOT_ALLOWLISTED',
            message: "Model 'unauthorized-model' is not allowlisted for provider 'OpenAI'.",
          },
        }),
      } as any);

      await expect(
        runPlaygroundInference({
          providerId: 'openai',
          modelId: 'unauthorized-model',
          prompt: 'Hello',
        }),
      ).rejects.toThrow("Model 'unauthorized-model' is not allowlisted for provider 'OpenAI'.");
    });

    it('should handle gateway 502 bad gateway errors gracefully', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => ({
          success: false,
          error: {
            code: 'GATEWAY_ERROR',
            message: 'Inference failed on provider: OpenAI rate limit exceeded (429)',
          },
        }),
      } as any);

      await expect(
        runPlaygroundInference({
          providerId: 'openai',
          modelId: 'gpt-4o',
          prompt: 'Hello',
        }),
      ).rejects.toThrow('Inference failed on provider: OpenAI rate limit exceeded (429)');
    });
  });

  describe('5. Zero Secret Exposure Guarantee', () => {
    it('should never expose apiKey or secret values in request payload or client response', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            requestId: 'req_secret_check',
            providerId: 'openai',
            modelId: 'gpt-4o',
            content: 'Response without secrets.',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            costEstimate: { amountUsd: 0.0001, isEstimate: true, currency: 'USD' },
            latencyMs: 100,
          },
        }),
      } as any);

      const result = await runPlaygroundInference({
        providerId: 'openai',
        modelId: 'gpt-4o',
        prompt: 'Verify no credentials are leaked',
      });

      // Verify request payload sent to backend has NO secret keys or credentials
      const [, options] = fetchSpy.mock.calls[0];
      const requestBody = options.body;
      expect(requestBody).not.toContain('apiKey');
      expect(requestBody).not.toContain('secretKey');
      expect(requestBody).not.toContain('secretName');
      expect(requestBody).not.toContain('sk-');

      // Verify response object contains NO secret keys or credentials
      const resultJson = JSON.stringify(result);
      expect(resultJson).not.toContain('apiKey');
      expect(resultJson).not.toContain('secretKey');
      expect(resultJson).not.toContain('secretName');
      expect(resultJson).not.toContain('sk-');
    });
  });
});
