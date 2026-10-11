import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AiProvider, AiPolicy } from '@wapcentral/types';

// In-memory simulation of Firestore database for AI tests
const mockFirestoreStore = new Map<string, any>();
let snapshotListeners: Array<(snapshot: any) => void> = [];
let snapshotErrorListeners: Array<(err: Error) => void> = [];
let mockSetDocFail = false;
let mockDeleteDocFail = false;

function triggerSnapshots(colName?: string) {
  const docs = Array.from(mockFirestoreStore.entries())
    .filter(([path]) => !colName || path.startsWith(`${colName}/`))
    .map(([path, data]) => {
      const id = path.split('/')[1] || path;
      return {
        id,
        data: () => ({ ...data }),
      };
    });

  for (const listener of snapshotListeners) {
    listener({
      empty: docs.length === 0,
      docs,
    });
  }
}

// 1. Force isOfflineMode = false to exercise the real Firestore production code paths
vi.mock('../lib/firestore.js', () => ({
  db: { type: 'mockFirestoreInstance' },
  isOfflineMode: false,
  isTestEnv: true,
  isEmulator: false,
}));

// 2. Mock auth from firebase.js
vi.mock('../lib/firebase.js', () => ({
  auth: {
    currentUser: { uid: 'usr_admin_1', email: 'admin@webappypie.com' },
    onAuthStateChanged: vi.fn(),
  },
  app: {},
}));

// 3. Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _type: 'collection', name })),
  doc: vi.fn((_db, colName, id) => ({ _type: 'doc', path: `${colName}/${id}`, colName, id })),
  query: vi.fn((colRef, ...filters) => ({ _type: 'query', colRef, filters })),
  orderBy: vi.fn((field, dir) => ({ _type: 'orderBy', field, dir })),
  getDocs: vi.fn(async (q) => {
    const colName = q.colRef?.name || 'providers';
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
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  setDoc: vi.fn(async (docRef, data, options) => {
    if (mockSetDocFail) {
      throw new Error('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');
    }

    // Strict Firestore validation: throw if any property at any depth is undefined
    function checkUndefined(val: any, path: string) {
      if (val === undefined) {
        throw new Error(
          `Function setDoc() called with invalid data. Unsupported field value: undefined (found in ${path})`,
        );
      }
      if (val && typeof val === 'object' && !('toDate' in val)) {
        for (const [k, v] of Object.entries(val)) {
          checkUndefined(v, path ? `${path}.${k}` : k);
        }
      }
    }
    checkUndefined(data, docRef.path);

    const current = mockFirestoreStore.get(docRef.path) || {};
    const updated = options?.merge ? { ...current, ...data } : data;
    mockFirestoreStore.set(docRef.path, updated);
    triggerSnapshots(docRef.colName);
  }),
  deleteDoc: vi.fn(async (docRef) => {
    if (mockDeleteDocFail) {
      throw new Error('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');
    }
    mockFirestoreStore.delete(docRef.path);
    triggerSnapshots(docRef.colName);
  }),
  onSnapshot: vi.fn((q, onNext, onError) => {
    snapshotListeners.push(onNext);
    if (onError) snapshotErrorListeners.push(onError);

    const colName = q.colRef?.name || 'providers';
    const docs = Array.from(mockFirestoreStore.entries())
      .filter(([path]) => path.startsWith(`${colName}/`))
      .map(([path, data]) => {
        const id = path.split('/')[1] || path;
        return {
          id,
          data: () => ({ ...data }),
        };
      });

    onNext({
      empty: docs.length === 0,
      docs,
    });

    return () => {
      snapshotListeners = snapshotListeners.filter((l) => l !== onNext);
      if (onError) {
        snapshotErrorListeners = snapshotErrorListeners.filter((l) => l !== onError);
      }
    };
  }),
}));

// Import services after mocks
const {
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
} = await import('./aiService.js');

const mockActor = {
  uid: 'usr_super_admin',
  email: 'admin@webappypie.com',
};

describe('AI Gateway & Provider Management Firestore Production Integration', () => {
  beforeEach(() => {
    mockFirestoreStore.clear();
    snapshotListeners = [];
    snapshotErrorListeners = [];
    mockSetDocFail = false;
    mockDeleteDocFail = false;
    vi.restoreAllMocks();
  });

  describe('1. Firestore Provider Loading & Empty State', () => {
    it('should return empty array when Firestore /providers is empty (no mock fallback)', () => {
      let loaded: AiProvider[] = [];
      const unsub = subscribeAiProviders((provs) => {
        loaded = provs;
      });

      expect(loaded).toEqual([]);
      expect(loaded.length).toBe(0);
      unsub();
    });

    it('should load provider documents directly from Firestore', () => {
      mockFirestoreStore.set('providers/anthropic', {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        enabled: true,
        models: [
          {
            id: 'm_claude_35_sonnet',
            providerId: 'anthropic',
            modelId: 'claude-3-5-sonnet',
            name: 'Claude 3.5 Sonnet',
            enabled: true,
            inputCostPer1kTokens: 0.003,
            outputCostPer1kTokens: 0.015,
          },
        ],
        secretName: 'ANTHROPIC_API_KEY',
        healthStatus: {
          status: 'healthy',
          latencyMs: 145,
          lastCheckedAt: '2026-10-02T12:00:00Z',
        },
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      });

      let loaded: AiProvider[] = [];
      const unsub = subscribeAiProviders((provs) => {
        loaded = provs;
      });

      expect(loaded.length).toBe(1);
      expect(loaded[0]?.id).toBe('anthropic');
      expect(loaded[0]?.name).toBe('Anthropic');
      expect(loaded[0]?.models.length).toBe(1);
      expect(loaded[0]?.healthStatus?.status).toBe('healthy');
      unsub();
    });
  });

  describe('2. Provider Creation & Secret Isolation Guarantee', () => {
    it('should create provider in Firestore and NEVER store apiKey in the Firestore document', async () => {
      const input = {
        id: 'openai',
        name: 'OpenAI Production',
        type: 'openai' as const,
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-proj-ultra-secret-key-1234567890', // Sensitive secret
        models: [
          {
            id: 'm_gpt4o',
            providerId: 'openai',
            modelId: 'gpt-4o',
            name: 'GPT-4o',
            enabled: true,
          },
        ],
      };

      const created = await createAiProvider(input, mockActor);

      // Verify returned provider does NOT leak apiKey
      expect(created.id).toBe('openai');
      expect((created as any).apiKey).toBeUndefined();

      // Inspect the exact document written to Firestore
      const storedDoc = mockFirestoreStore.get('providers/openai');
      expect(storedDoc).toBeDefined();
      expect(storedDoc.id).toBe('openai');
      expect(storedDoc.name).toBe('OpenAI Production');
      expect(storedDoc.secretName).toBe('OPENAI_API_KEY'); // Stored as reference name

      // CRITICAL: Raw secret must NOT be in Firestore!
      expect(storedDoc.apiKey).toBeUndefined();
      expect(storedDoc.secret).toBeUndefined();
      expect(JSON.stringify(storedDoc)).not.toContain('sk-proj-ultra-secret-key-1234567890');
    });

    it('should update provider in Firestore without writing apiKey to Firestore', async () => {
      mockFirestoreStore.set('providers/gemini', {
        id: 'gemini',
        name: 'Google Gemini',
        type: 'gemini',
        enabled: true,
        models: [],
      });

      await updateAiProvider(
        'gemini',
        {
          name: 'Google Gemini 1.5 Pro',
          apiKey: 'AIzaSySecretKey998877',
          enabled: false,
        },
        mockActor,
      );

      const updatedDoc = mockFirestoreStore.get('providers/gemini');
      expect(updatedDoc.name).toBe('Google Gemini 1.5 Pro');
      expect(updatedDoc.enabled).toBe(false);
      expect(updatedDoc.apiKey).toBeUndefined();
      expect(JSON.stringify(updatedDoc)).not.toContain('AIzaSySecretKey998877');
    });
  });

  describe('3. AI Policies Firestore CRUD', () => {
    it('should return empty list when no policies exist (no mock fallback)', async () => {
      const policies = await fetchAiPolicies();
      expect(policies).toEqual([]);
      expect(policies.length).toBe(0);
    });

    it('should create, read, toggle, and delete policies in Firestore', async () => {
      const newPolicy = await createAiPolicy(
        {
          appId: 'app_01',
          feature: 'smart_reader_ai',
          primaryProviderId: 'gemini',
          primaryModelId: 'gemini-1.5-flash',
          fallbackChain: [
            {
              providerId: 'openai',
              modelId: 'gpt-4o-mini',
              priority: 1,
            },
          ],
          enabled: true,
        },
        mockActor,
      );

      expect(newPolicy.id).toBeDefined();
      expect(newPolicy.feature).toBe('smart_reader_ai');

      // Stored in Firestore /aiPolicies/{id}
      expect(mockFirestoreStore.has(`aiPolicies/${newPolicy.id}`)).toBe(true);

      // Toggle policy
      const toggled = await toggleAiPolicy(newPolicy.id, mockActor);
      expect(toggled.enabled).toBe(false);
      expect(mockFirestoreStore.get(`aiPolicies/${newPolicy.id}`).enabled).toBe(false);

      // Delete policy
      await deleteAiPolicy(newPolicy.id, mockActor);
      expect(mockFirestoreStore.has(`aiPolicies/${newPolicy.id}`)).toBe(false);
    });
  });

  describe('4. Permission Failure Handling (No Silent Catch)', () => {
    it('should throw an error when provider setDoc fails with PERMISSION_DENIED', async () => {
      mockSetDocFail = true;

      await expect(
        createAiProvider(
          {
            id: 'openai',
            name: 'OpenAI',
            type: 'openai',
            enabled: true,
            models: [],
          },
          mockActor,
        ),
      ).rejects.toThrow('Missing or insufficient permissions');
    });

    it('should throw an error when policy setDoc fails with PERMISSION_DENIED', async () => {
      mockSetDocFail = true;

      await expect(
        createAiPolicy(
          {
            appId: 'app_01',
            feature: 'test_feature',
            primaryProviderId: 'gemini',
            primaryModelId: 'gemini-1.5-flash',
            enabled: true,
          },
          mockActor,
        ),
      ).rejects.toThrow('Missing or insufficient permissions');
    });

    it('should throw an error when deleteDoc fails', async () => {
      mockDeleteDocFail = true;

      await expect(deleteAiProvider('openai', mockActor)).rejects.toThrow(
        'Missing or insufficient permissions',
      );
      await expect(deleteAiPolicy('policy_123', mockActor)).rejects.toThrow(
        'Missing or insufficient permissions',
      );
    });
  });

  describe('5. Real Provider Health Check (No Synthetic/Random Latency)', () => {
    it('should return real unhealthy status when backend is unreachable instead of fake random numbers', async () => {
      // Mock global fetch to simulate unreachable backend
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

      const health = await checkProviderHealth('openai');

      expect(health.status).toBe('unhealthy');
      expect(health.latencyMs).toBe(0); // Not a random number!
      expect(health.error).toBe('Backend health check service unreachable');

      global.fetch = originalFetch;
    });

    it('should parse and save real health check response from backend', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            providerId: 'gemini',
            healthStatus: {
              status: 'healthy',
              latencyMs: 98,
              lastCheckedAt: '2026-10-03T05:30:00Z',
            },
          },
        }),
      });

      const health = await checkProviderHealth('gemini');

      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBe(98);
      expect(health.lastCheckedAt).toBe('2026-10-03T05:30:00Z');

      global.fetch = originalFetch;
    });
  });

  describe('6. Multi-Model Serialization Regression (No Undefined Firestore Fields)', () => {
    it('should successfully save and update a provider with both gpt-4o-mini and gpt-4o without any undefined fields', async () => {
      // 1. Create provider with gpt-4o-mini (omitting optional maxInputTokens/maxOutputTokens)
      const provider = await createAiProvider(
        {
          id: 'openai-production',
          name: 'OpenAI Production',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          enabled: true,
          secretName: 'OPENAI_API_KEY',
          useExistingSecret: true,
          models: [
            {
              id: 'm_gpt4o_mini',
              providerId: 'openai-production',
              modelId: 'gpt-4o-mini',
              name: 'GPT-4o Mini',
              enabled: true,
              inputCostPer1kTokens: 0.00015,
              outputCostPer1kTokens: 0.0006,
            },
          ],
        },
        mockActor,
      );

      expect(provider.id).toBe('openai-production');
      const savedDoc = mockFirestoreStore.get('providers/openai-production');
      expect(savedDoc).toBeDefined();
      expect(savedDoc.models).toHaveLength(1);
      expect(savedDoc.secretName).toBe('OPENAI_API_KEY');
      expect(savedDoc.configured).toBe(true);

      // Verify no undefined in saved document
      const docStr = JSON.stringify(savedDoc);
      expect(docStr).not.toContain('undefined');

      // 2. Fetch the provider and simulate reading back from Firestore
      const providers = await fetchAiProviders();
      const loaded = providers.find((p) => p.id === 'openai-production');
      expect(loaded).toBeDefined();
      const firstModel = loaded!.models[0]!;
      expect(firstModel.maxInputTokens).toBeUndefined();
      expect('maxInputTokens' in firstModel).toBe(false);

      // 3. Add second model gpt-4o and update the provider
      const updated = await updateAiProvider(
        'openai-production',
        {
          models: [
            ...loaded!.models,
            {
              id: 'm_gpt4o',
              providerId: 'openai-production',
              modelId: 'gpt-4o',
              name: 'GPT-4o (Omni Flagship)',
              enabled: true,
              inputCostPer1kTokens: 0.0025,
              outputCostPer1kTokens: 0.01,
            },
          ],
        },
        mockActor,
      );

      expect(updated.models).toHaveLength(2);
      const updatedDoc = mockFirestoreStore.get('providers/openai-production');
      expect(updatedDoc.models).toHaveLength(2);

      // Verify that neither model 1 nor model 2 has undefined fields in Firestore
      for (const model of updatedDoc.models) {
        for (const [key, val] of Object.entries(model)) {
          expect(val).not.toBeUndefined();
        }
      }
    });
  });
});
