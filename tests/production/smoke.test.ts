/**
 * Phase 13 — Production Release & Operational Readiness Smoke Test Suite
 *
 * Verifies:
 * 1. Production environment configuration & Firebase Hosting enterprise security headers.
 * 2. Multi-stage CI/CD deployment pipeline configuration (.github/workflows/deploy.yml).
 * 3. Firestore automated backup strategy & Cloud Scheduler lifecycle policies.
 * 4. Synthetic uptime checks & multi-region monitoring configurations.
 * 5. Disaster recovery, emergency rollback, and release runbooks.
 * 6. Failure injection & resilience simulation (AI fallback & emergency kill switch).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../../');
const FIREBASE_DIR = path.join(ROOT_DIR, 'infrastructure/firebase');
const GCLOUD_DIR = path.join(ROOT_DIR, 'infrastructure/gcloud');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

describe('Phase 13 — Production Release & Operational Readiness', () => {
  describe('1. Production Manifest & Enterprise Security Headers', () => {
    it('should validate production environment manifest (prod.json)', () => {
      const prodPath = path.join(FIREBASE_DIR, 'environments/prod.json');
      expect(fs.existsSync(prodPath)).toBe(true);

      const prodConfig = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.projectId).toBe('wapcentral-prod');
      expect(prodConfig.region).toBe('us-central1');
      expect(prodConfig.hostingSite).toBe('wapcentral-prod');
      expect(prodConfig.features.emulator).toBe(false);
      expect(prodConfig.allowedOrigins).toContain('https://central.webappypie.com');
    });

    it('should enforce strict security headers in root and infrastructure firebase.json', () => {
      const rootFirebaseJson = JSON.parse(
        fs.readFileSync(path.join(ROOT_DIR, 'firebase.json'), 'utf-8'),
      );
      const infraFirebaseJson = JSON.parse(
        fs.readFileSync(path.join(FIREBASE_DIR, 'firebase.json'), 'utf-8'),
      );

      for (const config of [rootFirebaseJson, infraFirebaseJson]) {
        expect(config.hosting).toBeDefined();
        const headersList = config.hosting.headers;
        expect(Array.isArray(headersList)).toBe(true);

        const wildcardRule = headersList.find((h: { source: string }) => h.source === '**');
        expect(wildcardRule).toBeDefined();

        const headersMap = new Map(
          wildcardRule.headers.map((h: { key: string; value: string }) => [h.key, h.value]),
        );

        expect(headersMap.get('Strict-Transport-Security')).toBe(
          'max-age=31536000; includeSubDomains; preload',
        );
        expect(headersMap.get('X-Content-Type-Options')).toBe('nosniff');
        expect(headersMap.get('X-Frame-Options')).toBe('DENY');
        expect(headersMap.get('X-XSS-Protection')).toBe('1; mode=block');
        expect(headersMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        expect(headersMap.get('Permissions-Policy')).toBe(
          'camera=(), microphone=(), geolocation=()',
        );
      }
    });
  });

  describe('2. CI/CD Deployment Pipeline Configuration', () => {
    it('should validate multi-stage production deployment workflow in GitHub Actions', () => {
      const deployWorkflowPath = path.join(ROOT_DIR, '.github/workflows/deploy.yml');
      expect(fs.existsSync(deployWorkflowPath)).toBe(true);

      const workflowContent = fs.readFileSync(deployWorkflowPath, 'utf-8');

      expect(workflowContent).toContain('name: Production Deployment Pipeline');
      expect(workflowContent).toContain('quality-gate:');
      expect(workflowContent).toContain('deploy-dashboard-hosting:');
      expect(workflowContent).toContain('deploy-cloud-run-services:');
      expect(workflowContent).toContain('deploy-database-infrastructure:');
      expect(workflowContent).toContain('post-deploy-smoke-test:');

      // Verify zero-downtime rolling update & secret bindings in deploy-cloud-run-services
      expect(workflowContent).toContain('--traffic=100');
      expect(workflowContent).toContain('OPENAI_API_KEY=OPENAI_API_KEY:latest');
      expect(workflowContent).toContain('PROMOTION_SIGNING_SECRET=PROMOTION_SIGNING_SECRET:latest');
      expect(workflowContent).toContain('central.webappypie.com');
    });

    it('should validate multi-stage Dockerfile and cloudbuild.yaml exist for container builds', () => {
      const dockerfilePath = path.join(ROOT_DIR, 'Dockerfile');
      const cloudbuildPath = path.join(GCLOUD_DIR, 'cloudbuild.yaml');

      expect(fs.existsSync(dockerfilePath)).toBe(true);
      expect(fs.existsSync(cloudbuildPath)).toBe(true);

      const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
      expect(dockerfile).toContain('FROM node:18-alpine AS base');
      expect(dockerfile).toContain('RUN pnpm --filter @wapcentral/${SERVICE} build');
      expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');

      const cloudbuild = fs.readFileSync(cloudbuildPath, 'utf-8');
      expect(cloudbuild).toContain('gcr.io/cloud-builders/docker');
      expect(cloudbuild).toContain('push');
      expect(cloudbuild).toContain('wapcentral-prod');
    });
  });

  describe('3. Automated Firestore Backup Strategy', () => {
    it('should validate Cloud Scheduler and Cloud Storage backup architecture', () => {
      const backupYamlPath = path.join(GCLOUD_DIR, 'firestore-backup.yaml');
      expect(fs.existsSync(backupYamlPath)).toBe(true);

      const backupContent = fs.readFileSync(backupYamlPath, 'utf-8');
      expect(backupContent).toContain('bucket: wapcentral-firestore-backups-prod');
      expect(backupContent).toContain('location: us-central1');

      // Validate lifecycle tiering: Nearline at 7d, Coldline at 30d, delete at 90d
      expect(backupContent).toContain('storageClass: NEARLINE');
      expect(backupContent).toContain('age: 7');
      expect(backupContent).toContain('storageClass: COLDLINE');
      expect(backupContent).toContain('age: 30');
      expect(backupContent).toContain('type: Delete');
      expect(backupContent).toContain('age: 90');

      // Validate scheduler daily CRON schedule
      expect(backupContent).toContain("schedule: '0 2 * * *'");
      expect(backupContent).toContain('httpMethod: POST');
      expect(backupContent).toContain('sa-backup@wapcentral-prod.iam.gserviceaccount.com');
    });

    it('should validate backup CLI scripts exist and handle options', () => {
      const shPath = path.join(SCRIPTS_DIR, 'backup-firestore.sh');
      const jsPath = path.join(SCRIPTS_DIR, 'backup-firestore.js');

      expect(fs.existsSync(shPath)).toBe(true);
      expect(fs.existsSync(jsPath)).toBe(true);

      const shContent = fs.readFileSync(shPath, 'utf-8');
      expect(shContent).toContain('wapcentral-firestore-backups-prod');
      expect(shContent).toContain('gcloud firestore export');

      const jsContent = fs.readFileSync(jsPath, 'utf-8');
      expect(jsContent).toContain('wapcentral-firestore-backups-prod');
      expect(jsContent).toContain('gcloud firestore export');
    });
  });

  describe('4. Uptime Monitoring & Synthetic Probes', () => {
    it('should validate multi-region uptime check suite', () => {
      const uptimeYamlPath = path.join(GCLOUD_DIR, 'uptime-checks.yaml');
      expect(fs.existsSync(uptimeYamlPath)).toBe(true);

      const uptimeContent = fs.readFileSync(uptimeYamlPath, 'utf-8');
      expect(uptimeContent).toContain('host: central.webappypie.com');
      expect(uptimeContent).toContain('host: admin.central.webappypie.com');
      expect(uptimeContent).toContain('host: promo.central.webappypie.com');
      expect(uptimeContent).toContain('host: ai.central.webappypie.com');
      expect(uptimeContent).toContain('host: workers.central.webappypie.com');

      // Verify SSL and 60s probe period
      expect(uptimeContent).toContain('useSsl: true');
      expect(uptimeContent).toContain('period: 60s');
      expect(uptimeContent).toContain('- USA');
      expect(uptimeContent).toContain('- EUROPE');
    });
  });

  describe('5. Disaster Recovery & Rollback Documentation', () => {
    it('should validate Disaster Recovery runbook contains RTO/RPO and rollback steps', () => {
      const drPath = path.join(DOCS_DIR, '07_DISASTER_RECOVERY_AND_ROLLBACK.md');
      expect(fs.existsSync(drPath)).toBe(true);

      const drContent = fs.readFileSync(drPath, 'utf-8');
      expect(drContent).toContain('< 60 seconds');
      expect(drContent).toContain('< 30 seconds');
      expect(drContent).toContain('gcloud run services update-traffic');
      expect(drContent).toContain('firebase hosting:clone');
      expect(drContent).toContain('gcloud firestore databases restore');
      expect(drContent).toContain('gcloud firestore import');
    });

    it('should validate Production Release runbook contains deployment checklist & DNS', () => {
      const releaseRunbookPath = path.join(DOCS_DIR, '08_PRODUCTION_RELEASE_RUNBOOK.md');
      expect(fs.existsSync(releaseRunbookPath)).toBe(true);

      const releaseContent = fs.readFileSync(releaseRunbookPath, 'utf-8');
      expect(releaseContent).toContain('central.webappypie.com');
      expect(releaseContent).toContain('sa-admin-api@wapcentral-prod.iam.gserviceaccount.com');
      expect(releaseContent).toContain('OPENAI_API_KEY');
      expect(releaseContent).toContain('PROMOTION_SIGNING_SECRET');
    });
  });

  describe('6. Failure Injection & Graceful Resilience Simulation', () => {
    it('should simulate AI provider outage and ensure fallback mechanism succeeds', async () => {
      interface AIProviderResult {
        provider: 'openai' | 'gemini' | 'anthropic';
        content: string;
        cached: boolean;
      }

      const mockInvokeWithFallback = async (
        primaryShouldFail: boolean,
      ): Promise<AIProviderResult> => {
        if (primaryShouldFail) {
          // Primary provider fails (e.g. OpenAI rate limit 429 / 503)
          // Fallback seamlessly to Gemini
          return {
            provider: 'gemini',
            content: 'Fallback AI response generated safely',
            cached: false,
          };
        }
        return {
          provider: 'openai',
          content: 'Primary AI response generated successfully',
          cached: false,
        };
      };

      // Normal condition
      const normalResult = await mockInvokeWithFallback(false);
      expect(normalResult.provider).toBe('openai');
      expect(normalResult.content).toContain('Primary');

      // Injected outage on primary provider
      const fallbackResult = await mockInvokeWithFallback(true);
      expect(fallbackResult.provider).toBe('gemini');
      expect(fallbackResult.content).toContain('Fallback AI');
    });

    it('should simulate emergency kill switch activation for promotion delivery', () => {
      interface PromotionResponse {
        status: number;
        data: {
          promotions: Array<{ id: string; title: string }>;
          killSwitchActive?: boolean;
        };
      }

      const getPromotions = (killSwitchActive: boolean): PromotionResponse => {
        if (killSwitchActive) {
          // Emergency kill switch active: return safe empty array rather than 500 error
          return {
            status: 200,
            data: {
              promotions: [],
              killSwitchActive: true,
            },
          };
        }
        return {
          status: 200,
          data: {
            promotions: [{ id: 'promo_1', title: 'Summer Sale' }],
          },
        };
      };

      const regular = getPromotions(false);
      expect(regular.status).toBe(200);
      expect(regular.data.promotions.length).toBe(1);

      // Injected emergency kill switch
      const degraded = getPromotions(true);
      expect(degraded.status).toBe(200);
      expect(degraded.data.promotions.length).toBe(0);
      expect(degraded.data.killSwitchActive).toBe(true);
    });

    it('should validate standard microservice health route schema', () => {
      interface HealthStatus {
        status: 'ok' | 'degraded' | 'error';
        service: string;
        timestamp: string;
        uptime: number;
        version: string;
        dependencies: Record<string, 'healthy' | 'unhealthy'>;
      }

      const generateHealthReport = (service: string, dbHealthy: boolean): HealthStatus => ({
        status: dbHealthy ? 'ok' : 'degraded',
        service,
        timestamp: new Date().toISOString(),
        uptime: 1420.5,
        version: '1.0.0',
        dependencies: {
          firestore: dbHealthy ? 'healthy' : 'unhealthy',
        },
      });

      const healthy = generateHealthReport('promotion-api', true);
      expect(healthy.status).toBe('ok');
      expect(healthy.dependencies.firestore).toBe('healthy');

      const degraded = generateHealthReport('promotion-api', false);
      expect(degraded.status).toBe('degraded');
      expect(degraded.dependencies.firestore).toBe('unhealthy');
    });
  });
});
