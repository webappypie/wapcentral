import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../app.js';
import { clearSecretStoreForTest, writeSecret } from '../services/secretVault.js';
import { clearAuditLogsForTest } from '../services/auditService.js';
import { clearInMemoryFirestoreForTest, getFirestoreDb } from '../services/firestore.js';
import { COLLECTIONS, APP_VERSION } from '@wapcentral/config';

describe('Admin API Service (Single Super Admin Model)', () => {
  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const UNAUTHORIZED_ROLE_AUTH = 'Bearer test-unauthorized-role-token';

  beforeEach(() => {
    clearInMemoryFirestoreForTest();
    clearSecretStoreForTest();
    clearAuditLogsForTest();
  });

  describe('Health Endpoint', () => {
    it('should return 200 healthy without authentication and expose centralized APP_VERSION', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('admin-api');
      expect(res.body.version).toBe(APP_VERSION);
      expect(res.body.release.version).toBe(APP_VERSION);
      expect(res.body.timestamp).toBeDefined();
    });

    it('should support /v1/health alias and expose matching APP_VERSION', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe(APP_VERSION);
    });
  });

  describe('Authentication & Access Control', () => {
    it('should deny unauthenticated requests to protected endpoints (401)', async () => {
      const res = await request(app).get('/v1/apps');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject malformed authorization header with 401', async () => {
      const res = await request(app).get('/v1/apps').set('Authorization', 'InvalidFormatHeader');
      expect(res.status).toBe(401);
    });

    it('should forbid non-super_admin role from accessing protected endpoints (403)', async () => {
      const res = await request(app).get('/v1/apps').set('Authorization', UNAUTHORIZED_ROLE_AUTH);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow Super Admin full access to GET apps (200)', async () => {
      const res = await request(app).get('/v1/apps').set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow Super Admin to create apps (201)', async () => {
      const res = await request(app).post('/v1/apps').set('Authorization', SUPER_ADMIN_AUTH).send({
        name: 'Super Admin Created App',
        packageId: 'com.webappypie.superapp',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Super Admin Created App');
    });

    it('should allow Super Admin to delete apps (200)', async () => {
      const res = await request(app)
        .delete('/v1/apps/app_01')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Secret Manager Vault & Zero-Leakage Guarantee', () => {
    it('should forbid non-super_admin from accessing secret vault (403)', async () => {
      const resUnauthorized = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', UNAUTHORIZED_ROLE_AUTH);
      expect(resUnauthorized.status).toBe(403);
    });

    it('should allow Super Admin to inspect secret status list without exposing raw secrets', async () => {
      const res = await request(app)
        .get('/v1/secrets/status')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const openAiEntry = res.body.data.find((s: any) => s.name === 'OPENAI_API_KEY');
      expect(openAiEntry).toBeDefined();
      expect(openAiEntry.configured).toBe(false);
      expect(openAiEntry.value).toBeUndefined(); // NEVER returned
    });

    it('should allow Super Admin to write-only store a valid secret and never return raw secret', async () => {
      const SECRET_PAYLOAD = 'sk-live-test-super-secret-key-123456789';

      const res = await request(app)
        .post('/v1/secrets/OPENAI_API_KEY')
        .set('Authorization', SUPER_ADMIN_AUTH)
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
        .set('Authorization', SUPER_ADMIN_AUTH);

      const entry = statusRes.body.data.find((s: any) => s.name === 'OPENAI_API_KEY');
      expect(entry.configured).toBe(true);
      expect(entry.version).toBe(1);
      expect(JSON.stringify(statusRes.body)).not.toContain(SECRET_PAYLOAD);
    });

    it('should reject unapproved secret names with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/v1/secrets/MALICIOUS_KEY_INJECTION')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ value: 'bad-secret-data' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SECRET_ERROR');
      expect(res.body.error.message).toContain('Invalid secret name');
    });

    it('should forbid non-super_admin from deleting secrets', async () => {
      await request(app)
        .post('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ value: 'gemini-key-123' });

      const resUnauthorized = await request(app)
        .delete('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', UNAUTHORIZED_ROLE_AUTH);

      expect(resUnauthorized.status).toBe(403);
      expect(resUnauthorized.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow Super Admin to delete secrets', async () => {
      await request(app)
        .post('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ value: 'gemini-key-123' });

      const resSuperAdmin = await request(app)
        .delete('/v1/secrets/GEMINI_API_KEY')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(resSuperAdmin.status).toBe(200);
      expect(resSuperAdmin.body.data.deleted).toBe(true);
    });
  });

  describe('Audit Logging Verification', () => {
    it('should record audit trail for secret writes and app creations', async () => {
      // 1. Write secret
      await request(app)
        .post('/v1/secrets/ANTHROPIC_API_KEY')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ value: 'sk-ant-test-key-999' });

      // 2. Create app
      await request(app).post('/v1/apps').set('Authorization', SUPER_ADMIN_AUTH).send({
        name: 'Audit Test App',
        packageId: 'com.webappypie.audittest',
        platform: 'ios',
        version: '1.0.0',
        environment: 'staging',
      });

      // 3. Query audit logs (Super Admin)
      const auditRes = await request(app)
        .get('/v1/audit-logs')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);

      const logs = auditRes.body.data;
      expect(
        logs.some((l: any) => l.action === 'secret.write' && l.resourceId === 'ANTHROPIC_API_KEY'),
      ).toBe(true);
      expect(logs.some((l: any) => l.action === 'app.create')).toBe(true);
    });

    it('should forbid non-super_admin from querying audit trail (403)', async () => {
      const res = await request(app)
        .get('/v1/audit-logs')
        .set('Authorization', UNAUTHORIZED_ROLE_AUTH);

      expect(res.status).toBe(403);
    });
  });

  describe('Feature Flag Endpoints', () => {
    it('should allow Super Admin to upsert and toggle feature flags', async () => {
      const createRes = await request(app)
        .post('/v1/flags')
        .set('Authorization', SUPER_ADMIN_AUTH)
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
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ enabled: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.enabled).toBe(false);
    });
  });

  describe('AI Provider Management Endpoints (Firestore Source of Truth)', () => {
    it('should return an empty array when Firestore collection is empty (no mock fallback)', async () => {
      const res = await request(app).get('/v1/ai/providers').set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0); // Zero hardcoded seeds or mock fallback!
    });

    it('should allow Super Admin to register an AI provider with write-only secret key and zero secret leakage', async () => {
      const SECRET_KEY = 'sk-live-ultra-secret-test-key-998877';

      const res = await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'custom_ollama',
          name: 'Custom Ollama Instance',
          type: 'self_hosted',
          enabled: true,
          baseUrl: 'http://localhost:11434',
          apiKey: SECRET_KEY,
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
      expect(res.body.data.name).toBe('Custom Ollama Instance');

      // CRITICAL ZERO-LEAKAGE: Raw secret must NOT be in API response
      expect(res.body.data.apiKey).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(SECRET_KEY);

      // Verify Firestore document directly: MUST NOT store raw apiKey
      const db = getFirestoreDb();
      const firestoreDocSnap = await db.collection(COLLECTIONS.PROVIDERS).doc('custom_ollama').get();
      expect(firestoreDocSnap.exists).toBe(true);
      const docData = firestoreDocSnap.data();
      expect(docData?.['apiKey']).toBeUndefined();
      expect(docData?.['secret']).toBeUndefined();
      expect(JSON.stringify(docData)).not.toContain(SECRET_KEY);
      expect(docData?.['configured']).toBe(true);
      expect(docData?.['secretName']).toBe('SELF_HOSTED_AI_CREDENTIALS');
    });

    it('should support full provider CRUD: create -> list -> get -> update -> delete in Firestore', async () => {
      // 1. Create
      const createRes = await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'crud_gemini',
          name: 'CRUD Gemini Test',
          type: 'gemini',
          enabled: true,
          models: [
            {
              id: 'm_gemini_flash',
              providerId: 'crud_gemini',
              modelId: 'gemini-1.5-flash',
              name: 'Gemini 1.5 Flash',
              enabled: true,
            },
          ],
        });
      expect(createRes.status).toBe(201);

      // 2. List (GET /v1/ai/providers)
      const listRes = await request(app).get('/v1/ai/providers').set('Authorization', SUPER_ADMIN_AUTH);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].id).toBe('crud_gemini');

      // 3. Get single (GET /v1/ai/providers/:id)
      const getRes = await request(app)
        .get('/v1/ai/providers/crud_gemini')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('CRUD Gemini Test');

      // 4. Update (PUT /v1/ai/providers/:id)
      const updateRes = await request(app)
        .put('/v1/ai/providers/crud_gemini')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          name: 'Updated Gemini Name',
          enabled: false,
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated Gemini Name');
      expect(updateRes.body.data.enabled).toBe(false);

      // 5. Delete (DELETE /v1/ai/providers/:id)
      const deleteRes = await request(app)
        .delete('/v1/ai/providers/crud_gemini')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.deleted).toBe(true);

      // 6. Verify 404 after delete
      const notFoundRes = await request(app)
        .get('/v1/ai/providers/crud_gemini')
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(notFoundRes.status).toBe(404);
    });

    it('should reject creation of duplicate provider type with 409 DUPLICATE_PROVIDER_TYPE', async () => {
      // 1. Create first OpenAI provider
      const firstRes = await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'openai-production',
          name: 'OpenAI Production',
          type: 'openai',
          enabled: true,
          models: [],
        });
      expect(firstRes.status).toBe(201);

      // 2. Attempt to create second provider with same type 'openai'
      const duplicateRes = await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'openai-second',
          name: 'Duplicate OpenAI',
          type: 'openai',
          enabled: true,
          models: [],
        });
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe('DUPLICATE_PROVIDER_TYPE');
      expect(duplicateRes.body.error.message).toContain('already exists');
    });

    it('should reject updating a provider to a duplicate type with 409 DUPLICATE_PROVIDER_TYPE', async () => {
      // 1. Create gemini provider
      await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'gemini-production',
          name: 'Gemini Production',
          type: 'gemini',
          enabled: true,
          models: [],
        });

      // 2. Create anthropic provider
      await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'anthropic-production',
          name: 'Anthropic Production',
          type: 'anthropic',
          enabled: true,
          models: [],
        });

      // 3. Attempt to update anthropic provider type to 'gemini'
      const updateRes = await request(app)
        .put('/v1/ai/providers/anthropic-production')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          type: 'gemini',
        });
      expect(updateRes.status).toBe(409);
      expect(updateRes.body.error.code).toBe('DUPLICATE_PROVIDER_TYPE');
    });

    it('should execute real provider health check and update Firestore healthStatus', async () => {
      // Create a self-hosted provider pointing to a test local endpoint
      await request(app)
        .post('/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          id: 'test_health_provider',
          name: 'Health Provider Test',
          type: 'self_hosted',
          baseUrl: 'http://127.0.0.1:9999',
          enabled: true,
          models: [],
        });

      const res = await request(app)
        .post('/v1/ai/providers/test_health_provider/health-check')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providerId).toBe('test_health_provider');
      expect(res.body.data.healthStatus).toBeDefined();
      expect(typeof res.body.data.healthStatus.status).toBe('string');
      expect(typeof res.body.data.healthStatus.latencyMs).toBe('number');
      expect(res.body.data.healthStatus.lastCheckedAt).toBeDefined();

      // Verify Firestore provider document was updated with real health status
      const db = getFirestoreDb();
      const updatedSnap = await db.collection(COLLECTIONS.PROVIDERS).doc('test_health_provider').get();
      const updatedData = updatedSnap.data();
      expect(updatedData?.['healthStatus']).toBeDefined();
      expect(updatedData?.['healthStatus'].status).toBe(res.body.data.healthStatus.status);
    });

    it('should return 404 for health check on nonexistent provider', async () => {
      const res = await request(app)
        .post('/v1/ai/providers/nonexistent_provider_id/health-check')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('AI Routing Policy Endpoints (Firestore Source of Truth)', () => {
    it('should return an empty array when Firestore /aiPolicies is empty (no mock fallback)', async () => {
      const res = await request(app).get('/v1/ai/policies').set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0); // Zero hardcoded seeds or mock fallback!
    });

    it('should allow Super Admin to create, toggle, update, and delete routing policies in Firestore', async () => {
      // 1. Create Policy
      const createRes = await request(app)
        .post('/v1/ai/policies')
        .set('Authorization', SUPER_ADMIN_AUTH)
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

      // 2. Read Single Policy (GET /v1/ai/policies/:id)
      const getRes = await request(app)
        .get(`/v1/ai/policies/${policyId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.appId).toBe('app_01');

      // 3. Toggle status (PATCH /v1/ai/policies/:id/toggle)
      const toggleRes = await request(app)
        .patch(`/v1/ai/policies/${policyId}/toggle`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.enabled).toBe(false);

      // Verify Firestore reflects toggled status
      const db = getFirestoreDb();
      const firestoreSnap = await db.collection(COLLECTIONS.AI_POLICIES).doc(policyId).get();
      expect(firestoreSnap.data()?.['enabled']).toBe(false);

      // 4. Update Policy (PUT /v1/ai/policies/:id)
      const updateRes = await request(app)
        .put(`/v1/ai/policies/${policyId}`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          feature: 'summarize_article_v2',
          primaryModelId: 'gemini-1.5-pro',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.feature).toBe('summarize_article_v2');
      expect(updateRes.body.data.primaryModelId).toBe('gemini-1.5-pro');

      // 5. Delete policy (DELETE /v1/ai/policies/:id)
      const deleteRes = await request(app)
        .delete(`/v1/ai/policies/${policyId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.deleted).toBe(true);

      // Verify 404 after delete
      const notFoundRes = await request(app)
        .get(`/v1/ai/policies/${policyId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);
      expect(notFoundRes.status).toBe(404);
    });
  });

  describe('Firebase Hosting Cloud Run Rewrites & /api/admin Path Routing', () => {
    it('should serve /api/admin/v1/ai/providers matching proxied Firebase Hosting requests', async () => {
      const res = await request(app)
        .get('/api/admin/v1/ai/providers')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should serve /api/admin/v1/ai/policies matching proxied Firebase Hosting requests', async () => {
      const res = await request(app)
        .get('/api/admin/v1/ai/policies')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should have firebase.json configured with /api/admin/** rewriting to Cloud Run before SPA catch-all', () => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const firebaseJsonPath = path.resolve(__dirname, '../../../../firebase.json');

      expect(fs.existsSync(firebaseJsonPath)).toBe(true);
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));

      expect(firebaseConfig.hosting).toBeDefined();
      expect(Array.isArray(firebaseConfig.hosting.rewrites)).toBe(true);

      const rewrites = firebaseConfig.hosting.rewrites;
      const apiRewriteIndex = rewrites.findIndex((r: any) => r.source === '/api/admin/**');
      const spaCatchAllIndex = rewrites.findIndex((r: any) => r.source === '**');

      expect(apiRewriteIndex).toBeGreaterThanOrEqual(0);
      expect(rewrites[apiRewriteIndex].run).toBeDefined();
      expect(rewrites[apiRewriteIndex].run.serviceId).toBe('wapcentral-admin-api');
      expect(rewrites[apiRewriteIndex].run.region).toBe('asia-south1');

      // CRITICAL: API rewrite MUST appear before SPA catch-all '**'
      expect(spaCatchAllIndex).toBeGreaterThan(apiRewriteIndex);
    });
  });

  describe('Campaign Management & Full Lifecycle', () => {
    it('should manage full campaign lifecycle: create -> update -> publish -> pause -> end -> delete', async () => {
      // 1. Create Campaign (Draft)
      const createRes = await request(app)
        .post('/v1/campaigns')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          name: 'Habits Launch Blitz',
          promotedAppId: 'app_03',
          targetAppIds: ['app_01', 'app_02'],
          title: 'Build Unstoppable Habits',
          description: 'Track streaks and boost productivity with AI habit reminders',
          ctaText: 'Start 7-Day Free Trial',
          storeUrl: 'https://play.google.com/store/apps/details?id=com.webappypie.habits',
          layoutVariant: 'native',
          priority: 88,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.status).toBe('draft');
      const campaignId = createRes.body.data.id;

      // 2. Update Campaign Details (PUT /:id)
      const updateRes = await request(app)
        .put(`/v1/campaigns/${campaignId}`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          title: 'Build High-Impact Habits Fast',
          priority: 95,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Build High-Impact Habits Fast');
      expect(updateRes.body.data.priority).toBe(95);

      // 3. Publish Campaign
      const publishRes = await request(app)
        .patch(`/v1/campaigns/${campaignId}/status`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ status: 'published' });

      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe('published');
      expect(publishRes.body.data.enabled).toBe(true);

      // 4. Pause Campaign
      const pauseRes = await request(app)
        .patch(`/v1/campaigns/${campaignId}/status`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ status: 'paused' });

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.status).toBe('paused');
      expect(pauseRes.body.data.enabled).toBe(false);

      // 5. End Campaign
      const endRes = await request(app)
        .patch(`/v1/campaigns/${campaignId}/status`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ status: 'ended' });

      expect(endRes.status).toBe(200);
      expect(endRes.body.data.status).toBe('ended');

      // 6. Delete Campaign
      const deleteRes = await request(app)
        .delete(`/v1/campaigns/${campaignId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });
  });

  describe('AI Playground & Inference Endpoints (Super Admin)', () => {
    beforeEach(async () => {
      // Seed an active provider with allowlisted models
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.PROVIDERS).doc('openai_test').set({
        id: 'openai_test',
        name: 'OpenAI Test Provider',
        type: 'openai',
        enabled: true,
        secretName: 'OPENAI_API_KEY',
        configured: true,
        models: [
          {
            id: 'm_gpt4o',
            providerId: 'openai_test',
            modelId: 'gpt-4o',
            name: 'GPT-4o',
            enabled: true,
            inputCostPer1kTokens: 0.0025,
            outputCostPer1kTokens: 0.01,
            maxInputTokens: 128000,
            maxOutputTokens: 4096,
          },
          {
            id: 'm_gpt4o_mini_disabled',
            providerId: 'openai_test',
            modelId: 'gpt-4o-mini-disabled',
            name: 'GPT-4o Mini Disabled',
            enabled: false,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Configure mock API key in secret store
      await writeSecret('OPENAI_API_KEY', 'sk-test-secret-key-1234567890', {
        uid: 'test_admin',
        email: 'admin@webappypie.com',
      });
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o',
          prompt: 'Hello AI',
        });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject non-super_admin callers with 403', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', UNAUTHORIZED_ROLE_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o',
          prompt: 'Hello AI',
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject missing or invalid parameters with 400 validation error', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for unknown provider', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'non_existent_provider',
          modelId: 'gpt-4o',
          prompt: 'Hello',
        });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject inference when provider is disabled in Firestore', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.PROVIDERS).doc('openai_test').set(
        { enabled: false },
        { merge: true },
      );

      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o',
          prompt: 'Hello',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROVIDER_DISABLED');
    });

    it('should reject inference when model is not allowlisted', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'unauthorized-model-xyz',
          prompt: 'Hello',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MODEL_NOT_ALLOWLISTED');
    });

    it('should reject inference when model is disabled for provider', async () => {
      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o-mini-disabled',
          prompt: 'Hello',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MODEL_DISABLED');
    });

    it('should reject cloud provider inference if Secret Manager key is missing', async () => {
      clearSecretStoreForTest();

      const res = await request(app)
        .post('/v1/ai/playground/infer')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          providerId: 'openai_test',
          modelId: 'gpt-4o',
          prompt: 'Hello',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CREDENTIAL_MISSING');
    });

    it('should execute real gateway request path, return token/cost metrics and NEVER expose secrets', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, opts: any) => {
        if (String(url).includes('/chat/completions')) {
          expect(opts.headers['Authorization']).toBe('Bearer sk-test-secret-key-1234567890');
          return {
            ok: true,
            status: 200,
            text: async () => '',
            json: async () => ({
              id: 'chatcmpl-test-playground-123',
              choices: [
                {
                  message: {
                    content: 'This is a live response from OpenAI via WAPCentral AI Gateway.',
                  },
                },
              ],
              usage: {
                prompt_tokens: 18,
                completion_tokens: 14,
                total_tokens: 32,
              },
            }),
          };
        }
        return originalFetch(url, opts);
      });

      try {
        const res = await request(app)
          .post('/v1/ai/playground/infer')
          .set('Authorization', SUPER_ADMIN_AUTH)
          .send({
            providerId: 'openai_test',
            modelId: 'gpt-4o',
            prompt: 'Explain what AI Gateway does in one sentence.',
            systemPrompt: 'You are a concise AI assistant.',
            temperature: 0.5,
            maxTokens: 500,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.content).toBe('This is a live response from OpenAI via WAPCentral AI Gateway.');
        expect(res.body.data.providerId).toBe('openai_test');
        expect(res.body.data.modelId).toBe('gpt-4o');

        // Token & Cost metrics
        expect(res.body.data.usage).toBeDefined();
        expect(res.body.data.usage.inputTokens).toBe(18);
        expect(res.body.data.usage.outputTokens).toBe(14);
        expect(res.body.data.usage.totalTokens).toBe(32);
        expect(res.body.data.costEstimate).toBeDefined();
        expect(res.body.data.costEstimate.currency).toBe('USD');
        expect(res.body.data.costEstimate.isEstimate).toBe(true);
        expect(typeof res.body.data.costEstimate.amountUsd).toBe('number');
        expect(typeof res.body.data.latencyMs).toBe('number');

        // Verify raw response object exists for debugging
        expect(res.body.data.raw).toBeDefined();
        expect(res.body.data.raw.content).toBe('This is a live response from OpenAI via WAPCentral AI Gateway.');

        // CRITICAL: Verify NO secret exposure in response
        const rawJson = JSON.stringify(res.body);
        expect(rawJson).not.toContain('sk-test-secret-key-1234567890');
        expect(rawJson).not.toContain('Bearer sk-');

        // Verify telemetry record was written to Firestore usageEvents
        const db = getFirestoreDb();
        const usageSnap = await db.collection(COLLECTIONS.USAGE_EVENTS).get();
        expect(usageSnap.docs.length).toBeGreaterThan(0);
        const lastUsage = usageSnap.docs[usageSnap.docs.length - 1]!.data();
        expect(lastUsage?.['providerId']).toBe('openai_test');
        expect(lastUsage?.['modelId']).toBe('gpt-4o');
        expect(lastUsage?.['feature']).toBe('ai_playground');
        expect(lastUsage?.['success']).toBe(true);
        expect(lastUsage?.['inputTokens']).toBe(18);
        expect(lastUsage?.['outputTokens']).toBe(14);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should support /v1/ai/providers/:id/infer and /v1/ai/playground/infer routes interchangeably', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, opts: any) => {
        if (String(url).includes('/chat/completions')) {
          return {
            ok: true,
            status: 200,
            text: async () => '',
            json: async () => ({
              id: 'chatcmpl-test-playground-456',
              choices: [{ message: { content: 'Provider param test' } }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }),
          };
        }
        return originalFetch(url, opts);
      });

      try {
        const res = await request(app)
          .post('/v1/ai/providers/openai_test/infer')
          .set('Authorization', SUPER_ADMIN_AUTH)
          .send({
            modelId: 'gpt-4o',
            prompt: 'Test param route',
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.content).toBe('Provider param test');
        expect(res.body.data.providerId).toBe('openai_test');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should handle provider errors gracefully and record failure telemetry', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, opts: any) => {
        if (String(url).includes('/chat/completions')) {
          return {
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded on OpenAI' } }),
          };
        }
        return originalFetch(url, opts);
      });

      try {
        const res = await request(app)
          .post('/v1/ai/playground/infer')
          .set('Authorization', SUPER_ADMIN_AUTH)
          .send({
            providerId: 'openai_test',
            modelId: 'gpt-4o',
            prompt: 'Test error',
          });

        expect(res.status).toBe(502);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('GATEWAY_ERROR');
        expect(res.body.error.message).toContain('Inference failed on provider');

        // Verify failure telemetry
        const db = getFirestoreDb();
        const usageSnap = await db.collection(COLLECTIONS.USAGE_EVENTS).get();
        const failedEvent = usageSnap.docs.find((d) => d.data()?.['success'] === false);
        expect(failedEvent).toBeDefined();
        expect(failedEvent?.data()?.['providerId']).toBe('openai_test');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Infrastructure Health & Telemetry Endpoint', () => {
    it('should return complete production infrastructure health report (200)', async () => {
      const res = await request(app)
        .get('/v1/infrastructure/overview')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const report = res.body.data;
      expect(report.overallStatus).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalServices).toBeGreaterThan(0);

      // Cloud Run health
      expect(report.cloudRun).toBeDefined();
      expect(Array.isArray(report.cloudRun)).toBe(true);

      // Firestore health
      expect(report.firestore).toBeDefined();
      expect(report.firestore.status).toBeDefined();
      expect(typeof report.firestore.latencyMs).toBe('number');

      // Secret Manager health
      expect(report.secretManager).toBeDefined();
      expect(report.secretManager.secrets).toBeDefined();
      // Verify no secrets leaked
      for (const s of report.secretManager.secrets) {
        expect(s.value).toBeUndefined();
        expect(s.apiKey).toBeUndefined();
      }

      // Cloud Scheduler health
      expect(report.cloudScheduler).toBeDefined();
      expect(typeof report.cloudScheduler.totalJobs).toBe('number');

      // System Process telemetry
      expect(report.systemProcess).toBeDefined();
      expect(typeof report.systemProcess.heapUsedMb).toBe('number');
      expect(typeof report.systemProcess.uptimeSeconds).toBe('number');

      // AI Node telemetry
      expect(report.aiNode).toBeDefined();
      expect(report.aiNode.status).toBe('unconfigured');
      expect(report.aiNode.gpuUsagePct).toBeNull(); // Never fake metrics
    });

    it('should support manual infrastructure probe (200)', async () => {
      const res = await request(app)
        .post('/v1/infrastructure/probe')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('probed successfully');
    });

    it('should manage infrastructure alert rules via CRUD', async () => {
      // 1. Create Rule
      const createRes = await request(app)
        .post('/v1/infrastructure/alerts/rules')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          name: 'High Latency Alarm',
          targetServiceId: 'wapcentral-admin-api',
          metric: 'latency_ms',
          threshold: 450,
          severity: 'warning',
          enabled: true,
          notifyEmails: ['ops@webappypie.com'],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.id).toBeDefined();
      const ruleId = createRes.body.data.id;

      // 2. List Rules
      const listRes = await request(app)
        .get('/v1/infrastructure/alerts/rules')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((r: any) => r.id === ruleId)).toBe(true);

      // 3. Patch Rule
      const patchRes = await request(app)
        .patch(`/v1/infrastructure/alerts/rules/${ruleId}`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ threshold: 550, enabled: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.threshold).toBe(550);
      expect(patchRes.body.data.enabled).toBe(false);

      // 4. Delete Rule
      const delRes = await request(app)
        .delete(`/v1/infrastructure/alerts/rules/${ruleId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(delRes.status).toBe(200);
    });
  });

  describe('Analytics Endpoints', () => {
    it('should aggregate real usage events with breakdown by provider, app, model and daily trends', async () => {
      // Seed a usage event into Firestore
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc('test_use_1').set({
        id: 'test_use_1',
        appId: 'app_01',
        providerId: 'gemini-production',
        modelId: 'gemini-1.5-flash',
        feature: 'chat',
        requestId: 'req_1',
        inputTokens: 200,
        outputTokens: 400,
        costEstimateUsd: 0.0003,
        latencyMs: 150,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // Also seed an error event
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc('test_use_2').set({
        id: 'test_use_2',
        appId: 'app_02',
        providerId: 'openai-production',
        modelId: 'gpt-4o',
        feature: 'analysis',
        requestId: 'req_2',
        inputTokens: 500,
        outputTokens: 500,
        costEstimateUsd: 0.005,
        latencyMs: 320,
        success: false,
        error: 'Quota exceeded',
        timestamp: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/v1/analytics/usage?days=30')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRequests).toBeGreaterThanOrEqual(2);
      expect(res.body.data.totalTokens).toBeGreaterThanOrEqual(1600);
      expect(res.body.data.totalErrors).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byProvider['gemini-production']).toBeDefined();
      expect(res.body.data.byProvider['openai-production']).toBeDefined();
      expect(res.body.data.byApp['app_01']).toBeDefined();
      expect(res.body.data.byModel['gemini-1.5-flash']).toBeDefined();
      expect(res.body.data.dailyTrends.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.recentEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter usage analytics by appId and providerId', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc('test_use_1').set({
        id: 'test_use_1',
        appId: 'app_01',
        providerId: 'gemini-production',
        modelId: 'gemini-1.5-flash',
        feature: 'chat',
        requestId: 'req_1',
        inputTokens: 200,
        outputTokens: 400,
        costEstimateUsd: 0.0003,
        latencyMs: 150,
        success: true,
        timestamp: new Date().toISOString(),
      });
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc('test_use_2').set({
        id: 'test_use_2',
        appId: 'app_02',
        providerId: 'openai-production',
        modelId: 'gpt-4o',
        feature: 'analysis',
        requestId: 'req_2',
        inputTokens: 500,
        outputTokens: 500,
        costEstimateUsd: 0.005,
        latencyMs: 320,
        success: false,
        error: 'Quota exceeded',
        timestamp: new Date().toISOString(),
      });

      const res = await request(app)
        .get('/v1/analytics/usage?days=30&appId=app_01&providerId=gemini-production')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.byApp['app_01']).toBeDefined();
      expect(res.body.data.byApp['app_02']).toBeUndefined();
    });

    it('should manage cost alert rules: create, list, evaluate, patch, and delete', async () => {
      const db = getFirestoreDb();
      await db.collection(COLLECTIONS.USAGE_EVENTS).doc('test_use_alert').set({
        id: 'test_use_alert',
        appId: 'app_01',
        providerId: 'gemini-production',
        modelId: 'gemini-1.5-flash',
        feature: 'chat',
        requestId: 'req_alert_1',
        costEstimateUsd: 0.005,
        latencyMs: 150,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // 1. Create Rule
      const createRes = await request(app)
        .post('/v1/analytics/alerts')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          name: 'Daily Cost Cap',
          metric: 'daily_cost_usd',
          threshold: 0.001,
          enabled: true,
          notifyEmails: ['ops@webappypie.com'],
        });

      expect(createRes.status).toBe(201);
      const ruleId = createRes.body.data.id;
      expect(ruleId).toBeDefined();

      // 2. List & evaluate alerts
      const listRes = await request(app)
        .get('/v1/analytics/alerts')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.rules.some((r: any) => r.id === ruleId)).toBe(true);
      // With our seeded event of 0.005, threshold 0.001 should trigger
      expect(listRes.body.data.triggers.length).toBeGreaterThanOrEqual(1);

      // 3. Patch rule
      const patchRes = await request(app)
        .patch(`/v1/analytics/alerts/${ruleId}`)
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({ enabled: false, threshold: 50.0 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.enabled).toBe(false);
      expect(patchRes.body.data.threshold).toBe(50.0);

      // 4. Delete rule
      const delRes = await request(app)
        .delete(`/v1/analytics/alerts/${ruleId}`)
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(delRes.status).toBe(200);
    });

    it('should get and update data retention policy and trigger manual pruning', async () => {
      // 1. Get default policy
      const getRes = await request(app)
        .get('/v1/analytics/retention')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.usageEventsTtlDays).toBe(90);

      // 2. Update policy
      const putRes = await request(app)
        .put('/v1/analytics/retention')
        .set('Authorization', SUPER_ADMIN_AUTH)
        .send({
          usageEventsTtlDays: 60,
          promotionEventsTtlDays: 60,
          auditLogsTtlDays: 180,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.usageEventsTtlDays).toBe(60);

      // 3. Trigger pruning
      const pruneRes = await request(app)
        .post('/v1/analytics/retention/prune')
        .set('Authorization', SUPER_ADMIN_AUTH);

      expect(pruneRes.status).toBe(200);
      expect(pruneRes.body.data.prunedCount).toBeDefined();
    });
  });
});
