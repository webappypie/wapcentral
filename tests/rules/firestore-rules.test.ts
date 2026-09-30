/**
 * Firestore Security Rules Unit Tests
 *
 * Uses @firebase/rules-unit-testing against the Firebase Firestore emulator.
 * Tests RBAC permissions across all key collections:
 * 1. Unauthenticated access denied
 * 2. Viewer permissions (read allowed, write denied)
 * 3. Editor permissions (create/update apps/campaigns allowed, secret injection rejected, backend collections denied)
 * 4. Admin permissions (provider/model/policy management allowed, delete allowed, audit write denied)
 * 5. Super Admin permissions (roles management allowed, backend write protection preserved)
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'demo-wapcentral-test';
const RULES_PATH = path.resolve(__dirname, '../../infrastructure/firebase/firestore.rules');

describe('Firestore Security Rules — RBAC & Data Protection', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(RULES_PATH, 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // Helper context generators
  const getUnauthedDb = () => testEnv.unauthenticatedContext().firestore();
  const getViewerDb = () =>
    testEnv.authenticatedContext('user_viewer', { role: 'viewer' }).firestore();
  const getEditorDb = () =>
    testEnv.authenticatedContext('user_editor', { role: 'editor' }).firestore();
  const getAdminDb = () =>
    testEnv.authenticatedContext('user_admin', { role: 'admin' }).firestore();
  const getSuperAdminDb = () =>
    testEnv.authenticatedContext('user_super', { role: 'super_admin' }).firestore();

  describe('1. Unauthenticated Requests', () => {
    it('should deny unauthenticated read and write on apps collection', async () => {
      const db = getUnauthedDb();
      await assertFails(getDoc(doc(db, 'apps/test-app')));
      await assertFails(setDoc(doc(db, 'apps/test-app'), { name: 'Hack' }));
    });

    it('should deny unauthenticated access to campaigns, roles, and featureFlags', async () => {
      const db = getUnauthedDb();
      await assertFails(getDoc(doc(db, 'campaigns/camp-1')));
      await assertFails(getDoc(doc(db, 'roles/user-1')));
      await assertFails(getDoc(doc(db, 'featureFlags/flag-1')));
    });

    it('should deny unauthenticated writes to backend-only collections', async () => {
      const db = getUnauthedDb();
      await assertFails(setDoc(doc(db, 'usageEvents/evt-1'), { test: true }));
      await assertFails(setDoc(doc(db, 'auditLogs/log-1'), { test: true }));
    });
  });

  describe('2. Viewer Role', () => {
    it('should allow viewer to read apps, campaigns, and feature flags', async () => {
      // Seed data with admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'apps/app-1'), { id: 'app-1', name: 'App One' });
        await setDoc(doc(context.firestore(), 'campaigns/camp-1'), { id: 'camp-1', title: 'Sale' });
        await setDoc(doc(context.firestore(), 'featureFlags/flag-1'), {
          key: 'feat_ai',
          enabled: true,
        });
      });

      const db = getViewerDb();
      await assertSucceeds(getDoc(doc(db, 'apps/app-1')));
      await assertSucceeds(getDoc(doc(db, 'campaigns/camp-1')));
      await assertSucceeds(getDoc(doc(db, 'featureFlags/flag-1')));
    });

    it('should deny viewer from writing to apps or campaigns', async () => {
      const db = getViewerDb();
      await assertFails(setDoc(doc(db, 'apps/app-2'), { name: 'Viewer App' }));
      await assertFails(setDoc(doc(db, 'campaigns/camp-2'), { title: 'Viewer Campaign' }));
    });

    it('should deny viewer from reading another user role document', async () => {
      const db = getViewerDb();
      await assertFails(getDoc(doc(db, 'roles/other_user')));
    });
  });

  describe('3. Editor Role', () => {
    it('should allow editor to create valid app without secrets', async () => {
      const db = getEditorDb();
      await assertSucceeds(
        setDoc(doc(db, 'apps/app-valid'), {
          id: 'app-valid',
          name: 'Valid App',
          packageId: 'com.webappypie.valid',
          platform: 'android',
          version: '1.0.0',
        }),
      );
    });

    it('should REJECT editor write if document contains private secrets (Secret Leak Prevention)', async () => {
      const db = getEditorDb();
      await assertFails(
        setDoc(doc(db, 'apps/app-leaked'), {
          id: 'app-leaked',
          name: 'Leaked App',
          apiKey: 'AIzaSyPrivateSecretKey123', // Forbidden secret field!
        }),
      );
      await assertFails(
        setDoc(doc(db, 'apps/app-leaked-2'), {
          id: 'app-leaked-2',
          secret: 'shh-dont-tell', // Forbidden secret field!
        }),
      );
    });

    it('should allow editor to create campaigns and featureFlags', async () => {
      const db = getEditorDb();
      await assertSucceeds(
        setDoc(doc(db, 'campaigns/camp-edit'), {
          id: 'camp-edit',
          title: 'Editor Promo',
          targetAppIds: ['app-1'],
        }),
      );
      await assertSucceeds(
        setDoc(doc(db, 'featureFlags/flag-edit'), {
          key: 'promo_banner',
          enabled: true,
        }),
      );
    });

    it('should deny editor from deleting an app (requires admin)', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'apps/app-to-del'), {
          id: 'app-to-del',
          name: 'Delete Me',
        });
      });

      const db = getEditorDb();
      await assertFails(deleteDoc(doc(db, 'apps/app-to-del')));
    });

    it('should deny editor from writing to backend-only collections', async () => {
      const db = getEditorDb();
      await assertFails(setDoc(doc(db, 'usageDaily/day-1'), { requests: 10 }));
      await assertFails(setDoc(doc(db, 'auditLogs/log-1'), { action: 'hacked' }));
      await assertFails(setDoc(doc(db, 'healthChecks/check-1'), { status: 'ok' }));
    });
  });

  describe('4. Admin Role', () => {
    it('should allow admin to manage AI providers, models, and policies', async () => {
      const db = getAdminDb();
      await assertSucceeds(
        setDoc(doc(db, 'providers/openai'), {
          id: 'openai',
          name: 'OpenAI',
          type: 'openai',
          enabled: true,
        }),
      );
      await assertSucceeds(
        setDoc(doc(db, 'models/gpt4o'), {
          id: 'gpt4o',
          providerId: 'openai',
          modelId: 'gpt-4o',
          enabled: true,
        }),
      );
      await assertSucceeds(
        setDoc(doc(db, 'aiPolicies/policy-1'), {
          id: 'policy-1',
          feature: 'chat',
          primaryProviderId: 'openai',
        }),
      );
    });

    it('should REJECT admin if attempting to store raw API keys in providers collection', async () => {
      const db = getAdminDb();
      await assertFails(
        setDoc(doc(db, 'providers/openai-leak'), {
          id: 'openai-leak',
          name: 'OpenAI',
          apiKey: 'sk-proj-raw-secret-leaked', // Raw secrets must only be in Secret Manager!
        }),
      );
    });

    it('should allow admin to delete apps and campaigns', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'apps/app-delete-admin'), { id: 'app-delete-admin' });
      });

      const db = getAdminDb();
      await assertSucceeds(deleteDoc(doc(db, 'apps/app-delete-admin')));
    });

    it('should allow admin to read audit logs and usage events', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'auditLogs/log-seeded'), { action: 'app.create' });
        await setDoc(doc(context.firestore(), 'usageEvents/evt-seeded'), { appId: 'app-1' });
      });

      const db = getAdminDb();
      await assertSucceeds(getDoc(doc(db, 'auditLogs/log-seeded')));
      await assertSucceeds(getDoc(doc(db, 'usageEvents/evt-seeded')));
    });

    it('should FORBID admin from modifying audit logs (Immutable guarantee)', async () => {
      const db = getAdminDb();
      await assertFails(setDoc(doc(db, 'auditLogs/tampered-log'), { action: 'fake' }));
    });

    it('should deny admin from modifying roles (requires super_admin)', async () => {
      const db = getAdminDb();
      await assertFails(setDoc(doc(db, 'roles/user-target'), { role: 'super_admin' }));
    });
  });

  describe('5. Super Admin Role', () => {
    it('should allow super_admin to manage user roles', async () => {
      const db = getSuperAdminDb();
      await assertSucceeds(
        setDoc(doc(db, 'roles/new-admin-user'), {
          uid: 'new-admin-user',
          role: 'admin',
          email: 'admin@webappypie.com',
        }),
      );
    });

    it('should allow super_admin to delete providers', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'providers/prov-to-delete'), {
          id: 'prov-to-delete',
        });
      });

      const db = getSuperAdminDb();
      await assertSucceeds(deleteDoc(doc(db, 'providers/prov-to-delete')));
    });

    it('should STILL forbid super_admin from direct client writes to auditLogs (Integrity Guarantee)', async () => {
      const db = getSuperAdminDb();
      await assertFails(
        setDoc(doc(db, 'auditLogs/client-write-attempt'), {
          action: 'fake-super-action',
        }),
      );
    });
  });
});
