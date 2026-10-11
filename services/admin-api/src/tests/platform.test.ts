import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  registerMemoryApp,
  resetPlatformQuotaForTest,
} from '../platform/middleware/platformAuth.js';
import {
  resetKillSwitchesForTest,
  setAppKillSwitch,
  setGlobalKillSwitch,
  setServiceKillSwitch,
} from '../platform/services/killSwitchService.js';
import { setMockAiAdapterForTest } from '../platform/services/platformAiService.js';

describe('WAPCentral Platform Services API Gateway (/api/platform/v1/*)', () => {
  const app = createApp();

  beforeEach(() => {
    resetKillSwitchesForTest();
    resetPlatformQuotaForTest();
    setMockAiAdapterForTest({
      generate: async () => ({
        requestId: 'mock-req-1',
        content: '{"label": "technology", "confidence": 0.95, "fullText": "Electricity Bill 2025", "total": 2450.0, "currency": "INR"}',
        modelId: 'test-model',
        providerId: 'test-provider',
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
        costEstimate: { amountUsd: 0.0001, isEstimate: true, currency: 'USD' },
        latencyMs: 15,
        cached: false,
      }),
      analyzeImage: async () => ({
        requestId: 'mock-req-2',
        content: 'A clean document page with text.',
        modelId: 'test-model',
        providerId: 'test-provider',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        costEstimate: { amountUsd: 0.0002, isEstimate: true, currency: 'USD' },
        latencyMs: 25,
        cached: false,
      }),
      estimateCost: () => ({ amountUsd: 0.0001, isEstimate: true, currency: 'USD' }),
      healthCheck: async () => ({
        status: 'healthy',
        latencyMs: 10,
        lastCheckedAt: new Date().toISOString(),
      }),
    });

    // Ensure FileZen and OptiLens test fixtures
    registerMemoryApp({
      id: 'filezen',
      name: 'FileZen — AI File & Document Manager',
      packageId: 'com.webappypie.filezen',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_filezen_prod',
      allowedServices: ['ai', 'ocr', 'files'],
      enabledModules: ['ai', 'ocr', 'file_intelligence'],
      serviceQuotas: {
        ai: { dailyRequests: 100, rateLimitRpm: 30 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    registerMemoryApp({
      id: 'optilens',
      name: 'OptiLens AI — Smart Camera & Photo Enhancer',
      packageId: 'com.webappypie.optilens',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_optilens_prod',
      allowedServices: ['image', 'ai'],
      enabledModules: ['image_intelligence', 'ai'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------
  // 1. Health & Discovery
  // ------------------------------------------------------------
  describe('Health and Discovery', () => {
    it('GET /api/platform/v1/health should return platform gateway health and available endpoints', async () => {
      const res = await request(app).get('/api/platform/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toContain('WAPCentral Platform');
      expect(res.body.endpoints.ai).toBeDefined();
      expect(res.body.endpoints.image).toBeDefined();
      expect(res.body.endpoints.ocr).toBeDefined();
      expect(res.body.endpoints.files).toBeDefined();
    });

    it('GET /api/platform/v1/apps/:id should return registered app info without secrets', async () => {
      const res = await request(app).get('/api/platform/v1/apps/filezen');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('filezen');
      expect(res.body.data.allowedServices).toEqual(['ai', 'ocr', 'files']);
      expect(res.body.data.appKey).toBeUndefined(); // MUST NOT leak secret key
    });
  });

  // ------------------------------------------------------------
  // 2. Authentication & Authorization Enforcement
  // ------------------------------------------------------------
  describe('Authentication and Authorization', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/platform/v1/ai/generate')
        .send({ prompt: 'Hello' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should reject request with invalid app key with 403', async () => {
      const res = await request(app)
        .post('/api/platform/v1/ai/generate')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wrong_secret_key')
        .send({ appId: 'filezen', prompt: 'Hello' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_APP_KEY');
    });

    it('should reject inactive application with 403 APP_INACTIVE', async () => {
      registerMemoryApp({
        id: 'suspended_app',
        name: 'Suspended App',
        packageId: 'com.webappypie.suspended',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        status: 'inactive',
        appKey: 'wap_key_suspended',
        allowedServices: ['ai'],
        enabledModules: ['ai'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/platform/v1/ai/generate')
        .set('X-App-Id', 'suspended_app')
        .set('X-App-Key', 'wap_key_suspended')
        .send({ appId: 'suspended_app', prompt: 'Hello' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APP_INACTIVE');
    });

    it('should strictly deny unauthorized service (OptiLens attempting OCR) with 403', async () => {
      // OptiLens only has 'image' and 'ai' allowed. NOT 'ocr'.
      const res = await request(app)
        .post('/api/platform/v1/ocr/extract')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod')
        .send({ appId: 'optilens', imageData: 'base64_sample' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_NOT_AUTHORIZED');
      expect(res.body.error.details.requestedService).toBe('ocr');
    });

    it('should allow FileZen to access OCR and AI and File Intelligence', async () => {
      // 1. AI
      const aiRes = await request(app)
        .post('/api/platform/v1/ai/generate')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', prompt: 'Generate test text' });
      expect(aiRes.status).toBe(200);
      expect(aiRes.body.success).toBe(true);
      expect(aiRes.body.service).toBe('ai');

      // 2. OCR
      const ocrRes = await request(app)
        .post('/api/platform/v1/ocr/extract')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', imageData: 'sample_receipt_b64', documentType: 'receipt' });
      expect(ocrRes.status).toBe(200);
      expect(ocrRes.body.success).toBe(true);
      expect(ocrRes.body.service).toBe('ocr');

      // 3. File Intelligence Search
      const fileRes = await request(app)
        .post('/api/platform/v1/files/search')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', query: '2025 electricity bill' });
      expect(fileRes.status).toBe(200);
      expect(fileRes.body.success).toBe(true);
      expect(fileRes.body.service).toBe('files');
    });

    it('should allow OptiLens to access Image Intelligence', async () => {
      const res = await request(app)
        .post('/api/platform/v1/image/enhance')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod')
        .send({
          appId: 'optilens',
          operation: 'enhance',
          imageData: 'data:image/jpeg;base64,9j4AAQSkZJRg...',
          preferLocal: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('image');
      expect(res.body.data.operation).toBe('enhance');
      expect(res.body.data.directive).toBeDefined();
    });
  });

  // ------------------------------------------------------------
  // 3. Kill Switches
  // ------------------------------------------------------------
  describe('Platform Kill Switches', () => {
    it('should block requests when service kill switch is enabled', async () => {
      setServiceKillSwitch('ai', true);

      const res = await request(app)
        .post('/api/platform/v1/ai/generate')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', prompt: 'Hello' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_DISABLED');
    });

    it('should block requests when app kill switch is enabled', async () => {
      setAppKillSwitch('filezen', true);

      const res = await request(app)
        .post('/api/platform/v1/files/search')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', query: 'search' });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('APP_KILL_SWITCH_ACTIVE');
    });

    it('should block all platform requests when global kill switch is enabled', async () => {
      setGlobalKillSwitch(true);

      const res = await request(app)
        .post('/api/platform/v1/image/enhance')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod')
        .send({ appId: 'optilens', operation: 'enhance', imageData: 'test' });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('GLOBAL_KILL_SWITCH_ACTIVE');
    });
  });

  // ------------------------------------------------------------
  // 4. File Intelligence Real Flow
  // ------------------------------------------------------------
  describe('File Intelligence Service Flow', () => {
    it('should parse natural-language search query and rank local candidates', async () => {
      const candidates = [
        {
          id: 'doc_1',
          name: 'Electricity_Bill_Jan_2025.pdf',
          extension: 'pdf',
          tags: ['bill', 'electricity'],
          extractedSnippet: 'Consumer electricity charges for 2025',
        },
        {
          id: 'doc_2',
          name: 'Grocery_Receipt_2024.jpg',
          extension: 'jpg',
          tags: ['food'],
          extractedSnippet: 'Milk, bread, butter',
        },
      ];

      const res = await request(app)
        .post('/api/platform/v1/files/search')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          query: '2025 ka electricity bill dhundo',
          localCandidates: candidates,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.parsedIntent.targetYear).toBe(2025);
      expect(res.body.data.parsedIntent.documentType).toBe('electricity_bill');
      expect(res.body.data.matchedFiles.length).toBeGreaterThan(0);
      expect(res.body.data.matchedFiles[0].fileId).toBe('doc_1');
      expect(res.body.data.matchedFiles[0].relevanceScore).toBeGreaterThan(50);
      expect(res.body.data.recommendedLocalFilters.dateAfter).toBe('2025-01-01');
    });

    it('should classify multiple files into categories with duplicate detection', async () => {
      const files = [
        { id: 'f1', name: 'salary_march_2025.pdf', sizeBytes: 25000 },
        { id: 'f2', name: 'salary_march_copy.pdf', sizeBytes: 25000 }, // duplicate size
        { id: 'f3', name: 'doctor_prescription.jpg', sizeBytes: 50000 },
      ];

      const res = await request(app)
        .post('/api/platform/v1/files/classify')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ appId: 'filezen', files });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBe(3);

      const f1 = res.body.data.results.find((r: any) => r.id === 'f1');
      expect(f1.category).toBe('financial');

      const f2 = res.body.data.results.find((r: any) => r.id === 'f2');
      expect(f2.isDuplicateCandidate).toBe(true);
      expect(f2.duplicateOfId).toBe('f1');

      const f3 = res.body.data.results.find((r: any) => r.id === 'f3');
      expect(f3.category).toBe('medical');
    });
  });

  // ------------------------------------------------------------
  // 5. Image Intelligence Service Flow
  // ------------------------------------------------------------
  describe('Image Intelligence Service Flow', () => {
    it('should perform image quality analysis with heuristics', async () => {
      const res = await request(app)
        .post('/api/platform/v1/image/analyze')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod')
        .send({
          appId: 'optilens',
          imageData: 'data:image/jpeg;base64,9j4AAQSkZJRg...',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.qualityScore).toBeGreaterThan(0);
      expect(res.body.data.estimatedResolution).toBeDefined();
    });
  });

  // ------------------------------------------------------------
  // 6. Response Contract Consistency
  // ------------------------------------------------------------
  describe('Standard Response Envelope', () => {
    it('every request returns consistent envelope fields', async () => {
      const res = await request(app)
        .post('/api/platform/v1/ai/classify')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({
          appId: 'filezen',
          text: 'New quantum chip breakthrough announced by researchers',
          candidateLabels: ['technology', 'sports', 'cooking'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.appId).toBe('filezen');
      expect(res.body.service).toBe('ai');
      expect(res.body.version).toBe('v1');
      expect(res.body.executionSource).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
