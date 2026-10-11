import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiProvider, AiPolicy } from '@wapcentral/types';

// Mock in-memory Firestore database
const mockFirestoreStore = new Map<string, any>();
let mockListeners: Array<(snap: any) => void> = [];
let mockErrorListeners: Array<(err: Error) => void> = [];

vi.mock('../lib/firestore.js', () => ({
  db: { type: 'mockDb' },
  isOfflineMode: false,
  isTestEnv: true,
  isEmulator: false,
}));

let mockUser: any = {
  uid: 'usr_superadmin_1',
  email: 'webappypie@gmail.com',
  getIdToken: vi.fn().mockResolvedValue('superadmin-id-token-xyz'),
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
  query: vi.fn((colRef) => ({ _type: 'query', colRef })),
  orderBy: vi.fn((field, dir) => ({ _type: 'orderBy', field, dir })),
  getDocs: vi.fn(async (q) => {
    const colName = q.colRef?.name || q.name || 'providers';
    const docs = Array.from(mockFirestoreStore.entries())
      .filter(([path]) => path.startsWith(`${colName}/`))
      .map(([path, data]) => {
        const id = path.split('/')[1] || path;
        return {
          id,
          data: () => ({ ...data }),
        };
      });
    return {
      empty: docs.length === 0,
      docs,
    };
  }),
  setDoc: vi.fn(async (docRef, data, options) => {
    const current = mockFirestoreStore.get(docRef.path) || {};
    const updated = options?.merge ? { ...current, ...data } : data;
    mockFirestoreStore.set(docRef.path, updated);
  }),
  deleteDoc: vi.fn(async (docRef) => {
    mockFirestoreStore.delete(docRef.path);
  }),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  onSnapshot: vi.fn((q, onNext, onError) => {
    mockListeners.push(onNext);
    if (onError) mockErrorListeners.push(onError);

    const colName = q.colRef?.name || q.name || 'providers';
    const docs = Array.from(mockFirestoreStore.entries())
      .filter(([path]) => path.startsWith(`${colName}/`))
      .map(([path, data]) => {
        const id = path.split('/')[1] || path;
        return {
          id,
          data: () => ({ ...data }),
        };
      });

    onNext({ empty: docs.length === 0, docs });

    return () => {
      mockListeners = mockListeners.filter((l) => l !== onNext);
      if (onError) mockErrorListeners = mockErrorListeners.filter((l) => l !== onError);
    };
  }),
}));

import {
  subscribeAiProviders,
  fetchAiProviders,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  checkProviderHealth,
  subscribeAiPolicies,
  fetchAiPolicies,
  createAiPolicy,
  updateAiPolicy,
  toggleAiPolicy,
  deleteAiPolicy,
  runPlaygroundInference,
  getModelCatalog,
  getSecretNameForType,
} from '../services/aiService.js';

describe('AI Gateway & Provider End-to-End Production Regression Tests', () => {
  let fetchSpy: any;

  beforeEach(() => {
    mockFirestoreStore.clear();
    mockListeners = [];
    mockErrorListeners = [];
    mockUser = {
      uid: 'usr_superadmin_1',
      email: 'webappypie@gmail.com',
      getIdToken: vi.fn().mockResolvedValue('superadmin-id-token-xyz'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Providers remain visible after refresh & docs missing createdAt preserved
  describe('1. Provider Visibility and Document Resilience', () => {
    it('should keep providers visible even when createdAt field is missing/undefined in Firestore', async () => {
      // Seed provider document with ONLY updatedAt (simulating real Firestore state)
      mockFirestoreStore.set('providers/openai-production', {
        id: 'openai-production',
        name: 'OpenAI Production',
        type: 'openai',
        enabled: true,
        configured: true,
        secretName: 'OPENAI_API_KEY',
        updatedAt: '2026-10-05T20:10:46.546Z',
        models: [
          { id: 'm1', providerId: 'openai-production', modelId: 'gpt-4o', name: 'GPT-4o', enabled: true },
        ],
      });

      const providers = await fetchAiProviders();
      expect(providers.length).toBe(1);
      expect(providers[0]?.id).toBe('openai-production');
      expect(providers[0]?.name).toBe('OpenAI Production');
    });

    it('should receive real-time snapshot updates and maintain visibility across re-subscription (page refresh)', () => {
      mockFirestoreStore.set('providers/gemini-production', {
        id: 'gemini-production',
        name: 'Google Gemini Production',
        type: 'gemini',
        enabled: true,
        configured: true,
        secretName: 'GEMINI_API_KEY',
        updatedAt: '2026-10-05T20:10:46.546Z',
        models: [
          { id: 'm2', providerId: 'gemini-production', modelId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', enabled: true },
        ],
      });

      let received: AiProvider[] = [];
      const unsub = subscribeAiProviders((provs) => {
        received = provs;
      });

      expect(received.length).toBe(1);
      expect(received[0]?.id).toBe('gemini-production');

      // Simulate component unmount on refresh, and remount
      unsub();
      let refreshed: AiProvider[] = [];
      const unsub2 = subscribeAiProviders((provs) => {
        refreshed = provs;
      });

      expect(refreshed.length).toBe(1);
      expect(refreshed[0]?.id).toBe('gemini-production');
      unsub2();
    });
  });

  // 2. Authenticated provider GET & auth token propagation
  describe('2. Authenticated Provider GET & Token Propagation', () => {
    it('should propagate Bearer ID token in Authorization header when calling Admin API', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'anthropic-production',
              name: 'Anthropic Claude Production',
              type: 'anthropic',
              enabled: true,
              models: [{ id: 'm3', modelId: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', enabled: true }],
            },
          ],
        }),
      } as any);

      // Force window existence to trigger browser API path
      const originalWindow = globalThis.window;
      (globalThis as any).window = {} as any;

      try {
        const provs = await fetchAiProviders();
        expect(fetchSpy).toHaveBeenCalled();
        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe('/api/admin/v1/ai/providers');
        expect(opts.headers['Authorization']).toBe('Bearer superadmin-id-token-xyz');
        expect(provs.length).toBe(1);
        expect(provs[0]?.id).toBe('anthropic-production');
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('CRITICAL: API failure (401/403) must NOT be silently swallowed into empty fallback data', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User session has expired. Please log in again.' },
        }),
      } as any);

      const originalWindow = globalThis.window;
      (globalThis as any).window = {} as any;

      try {
        await expect(fetchAiProviders()).rejects.toThrow('User session has expired');
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });
  });

  // 3. Provider CRUD & Secret Manager Lookup
  describe('3. Provider CRUD and Secret Security', () => {
    it('should map provider type to the correct Secret Manager key name', () => {
      expect(getSecretNameForType('openai')).toBe('OPENAI_API_KEY');
      expect(getSecretNameForType('gemini')).toBe('GEMINI_API_KEY');
      expect(getSecretNameForType('anthropic')).toBe('ANTHROPIC_API_KEY');
      expect(getSecretNameForType('self_hosted')).toBe('SELF_HOSTED_AI_CREDENTIALS');
      expect(getSecretNameForType('unknown')).toBeNull();
    });

    it('should create provider in Firestore without saving raw API key', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      const created = await createAiProvider(
        {
          id: 'test-custom-openai',
          name: 'Custom OpenAI',
          type: 'openai',
          apiKey: 'sk-proj-super-secret-key-12345',
          models: [
            {
              id: 'm_gpt4o',
              providerId: 'test-custom-openai',
              modelId: 'gpt-4o',
              name: 'GPT-4o',
              enabled: true,
            },
          ],
        },
        actor,
      );

      expect(created.id).toBe('test-custom-openai');
      const savedDoc = mockFirestoreStore.get('providers/test-custom-openai');
      expect(savedDoc).toBeDefined();
      expect(savedDoc.apiKey).toBeUndefined(); // Raw secret NEVER written to Firestore!
      expect(savedDoc.secretName).toBe('OPENAI_API_KEY');
    });

    it('should update provider models and enabled state', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      mockFirestoreStore.set('providers/openai-production', {
        id: 'openai-production',
        name: 'OpenAI Production',
        type: 'openai',
        enabled: true,
        models: [
          {
            id: 'm_gpt4o',
            providerId: 'openai-production',
            modelId: 'gpt-4o',
            name: 'GPT-4o',
            enabled: true,
          },
        ],
      });

      const updated = await updateAiProvider(
        'openai-production',
        {
          enabled: false,
          models: [
            {
              id: 'm_gpt4o',
              providerId: 'openai-production',
              modelId: 'gpt-4o',
              name: 'GPT-4o',
              enabled: true,
            },
            {
              id: 'm_gpt4o_mini',
              providerId: 'openai-production',
              modelId: 'gpt-4o-mini',
              name: 'GPT-4o Mini',
              enabled: true,
            },
          ],
        },
        actor,
      );

      expect(updated.enabled).toBe(false);
      const savedDoc = mockFirestoreStore.get('providers/openai-production');
      expect(savedDoc.enabled).toBe(false);
      expect(savedDoc.models.length).toBe(2);
    });

    it('should delete provider from Firestore', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      mockFirestoreStore.set('providers/to-delete', {
        id: 'to-delete',
        name: 'Delete Me',
        type: 'openai',
      });

      await deleteAiProvider('to-delete', actor);
      expect(mockFirestoreStore.get('providers/to-delete')).toBeUndefined();
    });
  });

  // 4. Provider Health Check
  describe('4. Real Provider Health Check Flow', () => {
    it('should invoke backend health check endpoint and persist latency and status', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            providerId: 'gemini-production',
            healthStatus: {
              status: 'healthy',
              latencyMs: 84,
              lastCheckedAt: '2026-10-06T02:00:00.000Z',
            },
          },
        }),
      } as any);

      const health = await checkProviderHealth('gemini-production');
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBe(84);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/v1/ai/providers/gemini-production/health-check',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer superadmin-id-token-xyz',
          }),
        }),
      );
    });
  });

  // 5. Policies CRUD and Telemetry
  describe('5. AI Routing Policies CRUD & Telemetry', () => {
    it('should create and retrieve routing policies', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      const created = await createAiPolicy(
        {
          appId: 'wapcentral_core',
          feature: 'mobile_chat',
          primaryProviderId: 'openai-production',
          primaryModelId: 'gpt-4o',
          priority: 80,
          quotas: { dailyRequestLimit: 500, dailyTokenLimit: 250000 },
          circuitBreaker: { failureThreshold: 3, timeoutMs: 5000, recoveryTimeMs: 15000 },
        },
        actor,
      );

      expect(created.id).toBeDefined();
      expect(created.feature).toBe('mobile_chat');
      expect(created.priority).toBe(80);

      const fetched = await fetchAiPolicies('wapcentral_core');
      expect(fetched.length).toBe(1);
      expect(fetched[0]?.feature).toBe('mobile_chat');
    });

    it('should toggle policy enabled status', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      mockFirestoreStore.set('aiPolicies/pol_toggle_test', {
        id: 'pol_toggle_test',
        appId: 'core',
        feature: 'search',
        enabled: true,
      });

      const toggled = await toggleAiPolicy('pol_toggle_test', actor);
      expect(toggled.enabled).toBe(false);

      const toggledBack = await toggleAiPolicy('pol_toggle_test', actor);
      expect(toggledBack.enabled).toBe(true);
    });

    it('should delete policy from Firestore', async () => {
      const actor = { uid: 'usr_admin', email: 'admin@webappypie.com' };
      mockFirestoreStore.set('aiPolicies/pol_del', {
        id: 'pol_del',
        appId: 'core',
        feature: 'temp',
      });

      await deleteAiPolicy('pol_del', actor);
      expect(mockFirestoreStore.get('aiPolicies/pol_del')).toBeUndefined();
    });
  });

  // 6. Model Catalog Retrieval
  describe('6. Verified Model Pricing & Context Catalog', () => {
    it('should produce verified models with rates, context window, and official source', async () => {
      const mockProviders: AiProvider[] = [
        {
          id: 'openai-production',
          name: 'OpenAI Production',
          type: 'openai',
          enabled: true,
          models: [
            { id: 'm1', providerId: 'openai-production', modelId: 'gpt-4o', name: 'GPT-4o (Omni)', enabled: true },
          ],
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ];

      const catalog = await getModelCatalog(mockProviders);
      expect(catalog.length).toBeGreaterThan(0);

      const gpt4o = catalog.find((c) => c.modelId === 'gpt-4o');
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.inputCostPer1M).toBe(2.5);
      expect(gpt4o?.outputCostPer1M).toBe(10.0);
      expect(gpt4o?.contextWindow).toBe(128000);
      expect(gpt4o?.source).toContain('OpenAI Official API Pricing');
      expect(gpt4o?.lastVerifiedDate).toBe('2026-10-05');
    });
  });

  // 7. Playground Request & Error Handling
  describe('7. AI Playground Request & Error Handling', () => {
    it('should successfully execute inference through the backend route with super admin token', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            requestId: 'req_live_play',
            providerId: 'openai-production',
            modelId: 'gpt-4o',
            content: 'Real model output from AI Gateway.',
            usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
            costEstimate: { amountUsd: 0.00011, isEstimate: true, currency: 'USD' },
            latencyMs: 240,
          },
        }),
      } as any);

      const res = await runPlaygroundInference({
        providerId: 'openai-production',
        modelId: 'gpt-4o',
        prompt: 'Hello from test',
      });

      expect(res.content).toBe('Real model output from AI Gateway.');
      expect(res.latencyMs).toBe(240);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/v1/ai/playground/infer',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer superadmin-id-token-xyz',
          }),
        }),
      );
    });

    it('should cleanly handle insufficient credit / rate limit errors without fake fallbacks', async () => {
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'You have exceeded your current quota, please check your plan and billing details.' },
        }),
      } as any);

      await expect(
        runPlaygroundInference({
          providerId: 'openai-production',
          modelId: 'gpt-4o',
          prompt: 'Testing quota exhaustion',
        }),
      ).rejects.toThrow('You have exceeded your current quota');
    });
  });
});
