/**
 * Phase 1 — Firebase Foundation Infrastructure Tests
 *
 * Verifies that:
 * 1. Environment manifests (dev, staging, prod) are valid, complete, and properly isolated.
 * 2. Remote Config template matches dual-layer feature flags specifications.
 * 3. Firestore composite indexes are defined for all complex queries.
 * 4. Firestore security rules cover all 13 collections, enforce RBAC, deny unauthenticated
 *    access, prevent client writes to backend collections, and reject private credentials.
 * 5. Storage security rules enforce MIME type and file size constraints on campaign creatives.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FIREBASE_DIR = path.resolve(__dirname, '../../infrastructure/firebase');

describe('Phase 1 — Firebase Foundation', () => {
  describe('Environment Configurations', () => {
    const envs = ['dev', 'staging', 'prod'];

    it.each(envs)('should have valid configuration for %s environment', (env) => {
      const filePath = path.join(FIREBASE_DIR, `environments/${env}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.environment).toBeDefined();
      expect(content.projectId).toMatch(/^wapcentral-(dev|staging|prod)$/);
      expect(content.storageBucket).toBeDefined();
      expect(content.authDomain).toBeDefined();
      expect(content.region).toBe('us-central1');
      expect(Array.isArray(content.allowedOrigins)).toBe(true);
      expect(content.allowedOrigins.length).toBeGreaterThan(0);
    });

    it('should have separate, unique project IDs across all three environments', () => {
      const dev = JSON.parse(
        fs.readFileSync(path.join(FIREBASE_DIR, 'environments/dev.json'), 'utf-8'),
      );
      const staging = JSON.parse(
        fs.readFileSync(path.join(FIREBASE_DIR, 'environments/staging.json'), 'utf-8'),
      );
      const prod = JSON.parse(
        fs.readFileSync(path.join(FIREBASE_DIR, 'environments/prod.json'), 'utf-8'),
      );

      const projectIds = new Set([dev.projectId, staging.projectId, prod.projectId]);
      expect(projectIds.size).toBe(3);
    });
  });

  describe('Remote Config Template (Dual-Layer Feature Flags)', () => {
    it('should define all required runtime parameters with defaults and descriptions', () => {
      const filePath = path.join(FIREBASE_DIR, 'remoteconfig.template.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const template = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const params = template.parameters;
      expect(params).toBeDefined();

      const requiredParams: Record<string, string> = {
        promotion_enabled: 'BOOLEAN',
        ai_enabled: 'BOOLEAN',
        ads_enabled: 'BOOLEAN',
        min_app_version: 'STRING',
        maintenance_mode: 'BOOLEAN',
        cache_ttl_seconds: 'NUMBER',
        request_timeout_ms: 'NUMBER',
        emergency_ai_kill_switch: 'BOOLEAN',
      };

      for (const [key, expectedType] of Object.entries(requiredParams)) {
        expect(params[key]).toBeDefined();
        expect(params[key].valueType).toBe(expectedType);
        expect(params[key].defaultValue).toBeDefined();
        expect(params[key].description).toBeTruthy();
      }
    });
  });

  describe('Firestore Composite Indexes', () => {
    it('should define composite indexes for campaigns, usageDaily, usageEvents, and auditLogs', () => {
      const filePath = path.join(FIREBASE_DIR, 'firestore.indexes.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const indexesJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(Array.isArray(indexesJson.indexes)).toBe(true);

      const indexedCollections = indexesJson.indexes.map(
        (idx: { collectionGroup: string }) => idx.collectionGroup,
      );
      expect(indexedCollections).toContain('campaigns');
      expect(indexedCollections).toContain('usageDaily');
      expect(indexedCollections).toContain('usageEvents');
      expect(indexedCollections).toContain('auditLogs');
    });
  });

  describe('Firestore Security Rules Analysis', () => {
    let rulesContent: string;

    it('should exist and be non-empty', () => {
      const filePath = path.join(FIREBASE_DIR, 'firestore.rules');
      expect(fs.existsSync(filePath)).toBe(true);
      rulesContent = fs.readFileSync(filePath, 'utf-8');
      expect(rulesContent.length).toBeGreaterThan(100);
    });

    it('should cover all 18 core collections identified in PRD & Architecture', () => {
      const requiredCollections = [
        'roles',
        'apps',
        'environments',
        'providers',
        'models',
        'aiPolicies',
        'campaigns',
        'campaignAssets',
        'featureFlags',
        'usageDaily',
        'usageEvents',
        'healthChecks',
        'auditLogs',
        'promotionEvents',
        'costAlerts',
        'dataRetention',
        'infrastructureAlerts',
        'aiServerMetrics',
      ];

      for (const col of requiredCollections) {
        expect(rulesContent).toContain(`match /${col}/`);
      }
    });

    it('should forbid client writes to backend-only collections', () => {
      const backendOnlyCollections = [
        'usageDaily',
        'usageEvents',
        'healthChecks',
        'auditLogs',
        'promotionEvents',
        'aiServerMetrics',
      ];

      for (const col of backendOnlyCollections) {
        const regex = new RegExp(
          `match\\s+/${col}/\\{[^}]+\\}\\s*\\{[\\s\\S]*?allow\\s+write:\\s*if\\s*false;`,
        );
        expect(regex.test(rulesContent)).toBe(true);
      }
    });

    it('should define RBAC role helper functions and secret prevention', () => {
      expect(rulesContent).toContain('function isSignedIn()');
      expect(rulesContent).toContain('function getUserRole()');
      expect(rulesContent).toContain('function isSuperAdmin()');
      expect(rulesContent).toContain('function isAdmin()');
      expect(rulesContent).toContain('function isEditor()');
      expect(rulesContent).toContain('function isViewer()');
      expect(rulesContent).toContain('function hasNoPrivateSecrets(');
    });

    it('should prevent raw secrets from being stored in client collections', () => {
      expect(rulesContent).toContain("!('apiKey' in data.keys())");
      expect(rulesContent).toContain("!('secret' in data.keys())");
      expect(rulesContent).toContain("!('privateKey' in data.keys())");
      expect(rulesContent).toContain("!('serviceAccount' in data.keys())");
      expect(rulesContent).toContain("!('apiSecret' in data.keys())");
      expect(rulesContent).toContain("!('signingSecret' in data.keys())");
    });

    it('should have a catch-all default deny match', () => {
      expect(rulesContent).toContain('match /{document=**}');
      expect(rulesContent).toContain('allow read, write: if false;');
    });
  });

  describe('Storage Security Rules Analysis', () => {
    let storageRules: string;

    it('should exist and be non-empty', () => {
      const filePath = path.join(FIREBASE_DIR, 'storage.rules');
      expect(fs.existsSync(filePath)).toBe(true);
      storageRules = fs.readFileSync(filePath, 'utf-8');
      expect(storageRules.length).toBeGreaterThan(100);
    });

    it('should allow public read for campaign assets to support non-blocking mobile display', () => {
      expect(storageRules).toContain('match /campaign-assets/{campaignId}/{assetName}');
      expect(storageRules).toContain('allow read: if true;');
    });

    it('should restrict asset writes to editors and above with file validation', () => {
      expect(storageRules).toContain('isEditorOrAbove()');
      expect(storageRules).toContain('isValidCreativeContentType()');
      expect(storageRules).toContain('isValidFileSize()');
    });

    it('should have default deny for all other paths', () => {
      expect(storageRules).toContain('match /{allPaths=**}');
      expect(storageRules).toContain('allow read, write: if false;');
    });
  });
});
