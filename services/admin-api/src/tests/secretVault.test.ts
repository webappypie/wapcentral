import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import {
  getInternalSecret,
  setSecretClientForTest,
  clearSecretStoreForTest,
  getSecretStatusList,
  writeSecret,
  redact,
} from '../services/secretVault.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { COLLECTIONS } from '@wapcentral/config';

describe('Google Cloud Secret Manager & Secret Vault', () => {
  const VIEWER_AUTH = 'Bearer test-unauthorized-role-token';
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearSecretStoreForTest();
    clearInMemoryFirestoreForTest();
    process.env['GOOGLE_CLOUD_PROJECT'] = 'wapcentral-prod';
    delete process.env['OPENAI_API_KEY'];
    delete process.env['GEMINI_API_KEY'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearSecretStoreForTest();
    vi.restoreAllMocks();
  });

  it('Requirement 3: should look up secret from Google Cloud Secret Manager using secret name', async () => {
    const mockAccessSecretVersion = vi.fn().mockResolvedValue([
      {
        payload: {
          data: Buffer.from('sk-proj-test-secret-manager-key-12345'),
        },
      },
    ]);

    setSecretClientForTest({
      accessSecretVersion: mockAccessSecretVersion,
    });

    const secret = await getInternalSecret('OPENAI_API_KEY');
    expect(secret).toBe('sk-proj-test-secret-manager-key-12345');
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/wapcentral-prod/secrets/OPENAI_API_KEY/versions/latest',
    });

    // Verify TTL cache: subsequent call should NOT call Secret Manager again
    const cachedSecret = await getInternalSecret('OPENAI_API_KEY');
    expect(cachedSecret).toBe('sk-proj-test-secret-manager-key-12345');
    expect(mockAccessSecretVersion).toHaveBeenCalledTimes(1);
  });

  it('Requirement 4: should fall back to environment variable if Secret Manager is unreachable or throws', async () => {
    const mockAccessSecretVersion = vi.fn().mockRejectedValue(new Error('Permission denied'));

    setSecretClientForTest({
      accessSecretVersion: mockAccessSecretVersion,
    });

    process.env['OPENAI_API_KEY'] = 'sk-proj-fallback-env-key-67890';

    const secret = await getInternalSecret('OPENAI_API_KEY');
    expect(secret).toBe('sk-proj-fallback-env-key-67890');
  });

  it('Requirement 5: secret values must NEVER be exposed in metadata list or logs', async () => {
    setSecretClientForTest({
      accessSecretVersion: vi.fn().mockResolvedValue([
        {
          payload: {
            data: Buffer.from('super-secret-production-key-999'),
          },
        },
      ]),
    });

    const statuses = await getSecretStatusList();
    const openaiStatus = statuses.find((s) => s.name === 'OPENAI_API_KEY');
    expect(openaiStatus).toBeDefined();
    expect(openaiStatus?.configured).toBe(true);
    // Value property must NOT exist in SecretMetadata
    expect((openaiStatus as any).value).toBeUndefined();

    // Verify redact helper masks secret
    const masked = redact('sk-proj-very-sensitive-token-12345678');
    expect(masked).not.toContain('very-sensitive');
    expect(masked).toBe('sk-...678');
  });

  it('Requirement 6: provider health-check route should execute with Secret Manager secret', async () => {
    // Seed provider in Firestore
    const db = getFirestoreDb();
    await db.collection(COLLECTIONS.PROVIDERS).doc('openai-prod').set({
      name: 'OpenAI Prod',
      type: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      secretName: 'OPENAI_API_KEY',
      configured: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Provide mocked secret via Secret Manager
    setSecretClientForTest({
      accessSecretVersion: vi.fn().mockResolvedValue([
        {
          payload: {
            data: Buffer.from('sk-test-health-key'),
          },
        },
      ]),
    });

    // Global fetch mock to simulate OpenAI response
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'gpt-4o' }] }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const res = await request(app)
      .post('/v1/ai/providers/openai-prod/health-check')
      .set('Authorization', SUPER_ADMIN_AUTH);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.healthStatus.status).toBe('healthy');

    // Verify fetch was called with the Bearer authorization from Secret Manager
    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs![0]).toBe('https://api.openai.com/v1/models');
    expect(callArgs![1]?.headers).toEqual({
      Authorization: 'Bearer sk-test-health-key',
    });
  });
});
