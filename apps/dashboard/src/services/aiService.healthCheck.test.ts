import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory store for firestore docs
const mockStore = new Map<string, any>();

vi.mock('../lib/firestore.js', () => ({
  db: { type: 'mockDb' },
  isOfflineMode: false,
  isTestEnv: true,
  isEmulator: false,
}));

let mockUser: any = {
  uid: 'usr_admin_1',
  email: 'admin@webappypie.com',
  getIdToken: vi.fn().mockResolvedValue('test-firebase-id-token-abc123'),
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
  setDoc: vi.fn(async (docRef, data) => {
    mockStore.set(docRef.path, { ...data });
  }),
}));

import { checkProviderHealth } from './aiService.js';

describe('Dashboard AI Health Check Authentication & Error Handling', () => {
  let fetchSpy: any;

  beforeEach(() => {
    mockStore.clear();
    mockUser = {
      uid: 'usr_admin_1',
      email: 'admin@webappypie.com',
      getIdToken: vi.fn().mockResolvedValue('test-firebase-id-token-abc123'),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Requirement 1: should send Bearer token obtained from current Firebase user in Authorization header', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          providerId: 'openai-production',
          healthStatus: {
            status: 'healthy',
            latencyMs: 120,
            lastCheckedAt: '2026-10-03T09:00:00.000Z',
          },
        },
      }),
    } as any);

    const result = await checkProviderHealth('openai-production');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/admin/v1/ai/providers/openai-production/health-check');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-firebase-id-token-abc123');

    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBe(120);

    // Verify Firestore doc updated
    const saved = mockStore.get('providers/openai-production');
    expect(saved).toBeDefined();
    expect(saved.healthStatus.status).toBe('healthy');
  });

  it('Requirement 2: should handle missing signed-in user gracefully with clear auth required message', async () => {
    mockUser = null; // No user signed in

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      }),
    } as any);

    const result = await checkProviderHealth('openai-production');

    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('Missing bearer token');

    const saved = mockStore.get('providers/openai-production');
    expect(saved.healthStatus.status).toBe('unhealthy');
    expect(saved.healthStatus.error).toContain('Missing bearer token');
  });

  it('Requirement 2: should handle token refresh/retrieval failure without crashing', async () => {
    mockUser = {
      uid: 'usr_admin_1',
      email: 'admin@webappypie.com',
      getIdToken: vi.fn().mockRejectedValue(new Error('Firebase auth token expired or revoked')),
    };

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please provide a valid Bearer token.' },
      }),
    } as any);

    const result = await checkProviderHealth('openai-production');

    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('Authentication required');
  });

  it('Requirement 2 & 6: should preserve real backend error message on 401/403/500 rather than hiding it', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: "Insufficient permissions. WAPCentral requires 'super_admin' access." },
      }),
    } as any);

    const result = await checkProviderHealth('openai-production');

    expect(result.status).toBe('unhealthy');
    // Must NOT be the old generic message
    expect(result.error).not.toBe('Backend health check service unreachable');
    expect(result.error).toContain("Insufficient permissions. WAPCentral requires 'super_admin' access.");
  });
});
