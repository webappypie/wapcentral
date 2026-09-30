import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { clearSecretStoreForTest } from '../services/secretVault.js';
import { clearAuditLogsForTest } from '../services/auditService.js';

describe('Admin API Service (Phase 4)', () => {
  beforeEach(() => {
    clearSecretStoreForTest();
    clearAuditLogsForTest();
  });

  describe('Health Endpoint', () => {
    it('should return 200 healthy without authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('admin-api');
      expect(res.body.timestamp).toBeDefined();
    });

    it('should support /v1/health alias', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('RBAC Middleware Enforcement', () => {
    it('should deny unauthenticated requests to protected endpoints (401)', async () => {
      const res = await request(app).get('/v1/apps');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow viewer role to GET apps (200)', async () => {
      const res = await request(app)
        .get('/v1/apps')
        .set('Authorization', 'Bearer mock-token-viewer');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should forbid viewer role from creating apps (403)', async () => {
      const res = await request(app)
        .post('/v1/apps')
        .set('Authorization', 'Bearer mock-token-viewer')
        .send({
          name: 'Forbidden App',
          packageId: 'com.webappypie.forbidden',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow editor role to create apps (201)', async () => {
      const res = await request(app)
        .post('/v1/apps')
        .set('Authorization', 'Bearer mock-token-editor')
        .send({
          name: 'Editor Created App',
          packageId: 'com.webappypie.editorapp',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Editor Created App');
    });

    it('should forbid editor role from deleting apps (403)', async () => {
      const res = await request(app)
        .delete('/v1/apps/app_01')
        .set('Authorization', 'Bearer mock-token-editor');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin role to delete apps (200)', async () => {
      const res = await request(app)
        .delete('/v1/apps/app_01')
        .set('Authorization', 'Bearer mock-token-admin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Secret Manager Vault & Zero-Leakage Guarantee', () => {
    it('should forbid viewer and editor from accessing secret vault (403)', async () => {
      const resViewer = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', 'Bearer mock-token-viewer');
      expect(resViewer.status).toBe(403);

      const resEditor = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', 'Bearer mock-token-editor');
      expect(resEditor.status).toBe(403);
    });

    it('should allow admin to inspect secret status list without exposing raw secrets', async () => {
      const res = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', 'Bearer mock-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const openAiEntry = res.body.data.find((s: any) => s.name === 'OPENAI_API_KEY');
      expect(openAiEntry).toBeDefined();
      expect(openAiEntry.configured).toBe(false);
      expect(openAiEntry.value).toBeUndefined(); // NEVER returned
    });

    it('should allow admin to write-only store a valid secret and never return raw secret', async () => {
      const SECRET_PAYLOAD = 'sk-live-test-super-secret-key-123456789';

      const res = await request(app)
        .post('/v1/secrets/OPENAI_API_KEY')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({ value: SECRET_PAYLOAD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('OPENAI_API_KEY');
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.configured).toBe(true);

      // Verify the response body does NOT contain the raw secret
      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain(SECRET_PAYLOAD);

      // Check status list now shows configured: true
      const statusRes = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', 'Bearer mock-token-admin');

      const entry = statusRes.body.data.find((s: any) => s.name === 'OPENAI_API_KEY');
      expect(entry.configured).toBe(true);
      expect(entry.version).toBe(1);
      expect(JSON.stringify(statusRes.body)).not.toContain(SECRET_PAYLOAD);
    });

    it('should reject unapproved secret names with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/v1/secrets/MALICIOUS_KEY_INJECTION')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({ value: 'bad-secret-data' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SECRET_ERROR');
      expect(res.body.error.message).toContain('Invalid secret name');
    });

    it('should forbid admin from deleting secrets (requires super_admin)', async () => {
      await request(app)
        .post('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({ value: 'gemini-key-123' });

      const resAdmin = await request(app)
        .delete('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', 'Bearer mock-token-admin');

      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error.code).toBe('FORBIDDEN');

      const resSuperAdmin = await request(app)
        .delete('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', 'Bearer mock-token-super_admin');

      expect(resSuperAdmin.status).toBe(200);
      expect(resSuperAdmin.body.data.deleted).toBe(true);
    });
  });

  describe('Audit Logging Verification', () => {
    it('should record audit trail for secret writes and app creations', async () => {
      // 1. Write secret
      await request(app)
        .post('/v1/secrets/ANTHROPIC_API_KEY')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({ value: 'sk-ant-test-key-999' });

      // 2. Create app
      await request(app).post('/v1/apps').set('Authorization', 'Bearer mock-token-editor').send({
        name: 'Audit Test App',
        packageId: 'com.webappypie.audittest',
        platform: 'ios',
        version: '1.0.0',
        environment: 'staging',
      });

      // 3. Query audit logs (Admin only)
      const auditRes = await request(app)
        .get('/v1/audit-logs')
        .set('Authorization', 'Bearer mock-token-admin');

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);

      const logs = auditRes.body.data;
      expect(
        logs.some((l: any) => l.action === 'secret.write' && l.resourceId === 'ANTHROPIC_API_KEY'),
      ).toBe(true);
      expect(
        logs.some(
          (l: any) => l.action === 'app.create' && l.actorEmail === 'editor@webappypie.com',
        ),
      ).toBe(true);
    });

    it('should forbid viewer and editor from querying audit trail (403)', async () => {
      const res = await request(app)
        .get('/v1/audit-logs')
        .set('Authorization', 'Bearer mock-token-editor');

      expect(res.status).toBe(403);
    });
  });

  describe('Feature Flag Endpoints', () => {
    it('should allow editor to upsert and toggle feature flags', async () => {
      const createRes = await request(app)
        .post('/v1/flags')
        .set('Authorization', 'Bearer mock-token-editor')
        .send({
          key: 'new_feature_toggle',
          description: 'Enables new feature',
          value: true,
          type: 'boolean',
          scope: 'global',
          enabled: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.key).toBe('new_feature_toggle');

      const flagId = createRes.body.data.id;
      const toggleRes = await request(app)
        .patch(`/v1/flags/${flagId}/toggle`)
        .set('Authorization', 'Bearer mock-token-editor')
        .send({ enabled: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.enabled).toBe(false);
    });
  });

  describe('AI Provider Management Endpoints', () => {
    it('should list all registered AI providers for viewer', async () => {
      const res = await request(app)
        .get('/v1/ai/providers')
        .set('Authorization', 'Bearer mock-token-viewer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((p: any) => p.id === 'openai')).toBe(true);
      expect(res.body.data.some((p: any) => p.id === 'gemini')).toBe(true);
    });

    it('should allow admin to register an AI provider with write-only secret key', async () => {
      const res = await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', 'Bearer mock-token-admin')
        .send({
          id: 'custom_ollama',
          name: 'Custom Ollama Instance',
          type: 'self_hosted',
          enabled: true,
          baseUrl: 'http://localhost:11434',
          apiKey: 'test-secret-key-12345',
          models: [
            {
              id: 'm_llama3',
              providerId: 'custom_ollama',
              modelId: 'llama-3.1-8b',
              name: 'Llama 3.1 8B',
              enabled: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('custom_ollama');
      // Zero secret leakage in response
      expect(res.body.data.apiKey).toBeUndefined();
    });

    it('should allow viewer to trigger provider health check', async () => {
      const res = await request(app)
        .post('/v1/ai/providers/openai/health-check')
        .set('Authorization', 'Bearer mock-token-viewer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.healthStatus).toBeDefined();
      expect(res.body.data.healthStatus.status).toBe('healthy');
    });

    it('should reject non-super_admin from deleting an AI provider', async () => {
      const res = await request(app)
        .delete('/v1/ai/providers/openai')
        .set('Authorization', 'Bearer mock-token-admin');

      expect(res.status).toBe(403);
    });
  });

  describe('AI Routing Policy Endpoints', () => {
    it('should allow editor to create, toggle, and manage routing policies', async () => {
      const createRes = await request(app)
        .post('/v1/ai/policies')
        .set('Authorization', 'Bearer mock-token-editor')
        .send({
          appId: 'app_01',
          feature: 'summarize_article',
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
            dailyRequestLimit: 25000,
          },
          enabled: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.feature).toBe('summarize_article');

      const policyId = createRes.body.data.id;

      // Toggle status
      const toggleRes = await request(app)
        .patch(`/v1/ai/policies/${policyId}/toggle`)
        .set('Authorization', 'Bearer mock-token-editor');

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.enabled).toBe(false);

      // Delete policy (admin required)
      const deleteRes = await request(app)
        .delete(`/v1/ai/policies/${policyId}`)
        .set('Authorization', 'Bearer mock-token-admin');

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.deleted).toBe(true);
    });
  });
});
