import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@wapcentral/types';

// In-memory simulation of Firestore database
const mockFirestoreStore = new Map<string, any>();
let snapshotListeners: Array<(snapshot: any) => void> = [];
let snapshotErrorListeners: Array<(err: Error) => void> = [];
let mockSetDocFail = false;
let mockDeleteDocFail = false;

function triggerSnapshots() {
  const docs = Array.from(mockFirestoreStore.entries()).map(([id, data]) => ({
    id,
    data: () => ({ ...data }),
  }));
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

// 2. Mock firebase/firestore to intercept and assert on all Firestore operations
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _type: 'collection', name })),
  doc: vi.fn((_db, colName, id) => ({ _type: 'doc', colName, id })),
  query: vi.fn((colRef, ...filters) => ({ _type: 'query', colRef, filters })),
  orderBy: vi.fn((field, dir) => ({ _type: 'orderBy', field, dir })),
  limit: vi.fn((count) => ({ _type: 'limit', count })),
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  deleteField: vi.fn(() => ({ _methodName: 'deleteField' })),
  setDoc: vi.fn(async (docRef, data, options) => {
    if (mockSetDocFail) {
      throw new Error('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');
    }
    // Mirror real Firestore behavior: reject undefined values!
    const checkUndefined = (obj: any, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${k}` : k;
        if (v === undefined) {
          throw new Error(`Function setDoc() called with invalid data. Unsupported field value: undefined (found in field ${fullPath} in document ${docRef.colName}/${docRef.id})`);
        }
        if (typeof v === 'object' && v !== null && !('_methodName' in v)) {
          checkUndefined(v, fullPath);
        }
      }
    };
    checkUndefined(data);

    const current = mockFirestoreStore.get(docRef.id) || {};
    const updated = options?.merge ? { ...current } : {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && (v as any)._methodName === 'deleteField') {
        delete updated[k];
      } else {
        updated[k] = v;
      }
    }
    mockFirestoreStore.set(docRef.id, updated);
    triggerSnapshots();
  }),
  deleteDoc: vi.fn(async (docRef) => {
    if (mockDeleteDocFail) {
      throw new Error('Firestore: Network unavailable (UNAVAILABLE)');
    }
    mockFirestoreStore.delete(docRef.id);
    triggerSnapshots();
  }),
  onSnapshot: vi.fn((_q, onNext, onError) => {
    snapshotListeners.push(onNext);
    if (onError) snapshotErrorListeners.push(onError);

    // Initial snapshot delivery
    if (_q && _q._type === 'doc') {
      const docData = mockFirestoreStore.get(_q.id);
      onNext({
        id: _q.id,
        exists: () => docData !== undefined,
        data: () => (docData ? { ...docData } : undefined),
      });
    } else {
      const docs = Array.from(mockFirestoreStore.entries()).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
      }));
      onNext({
        empty: docs.length === 0,
        docs,
      });
    }

    return () => {
      snapshotListeners = snapshotListeners.filter((l) => l !== onNext);
      if (onError) {
        snapshotErrorListeners = snapshotErrorListeners.filter((l) => l !== onError);
      }
    };
  }),
}));

// Import services after mocks
const { subscribeApps, createApp, updateApp, deleteApp, regenerateAppKey, subscribeApp } = await import('./appsService.js');

const mockActor = {
  uid: 'usr_admin_123',
  email: 'admin@webappypie.com',
};

describe('App Registry Firestore Production Integration', () => {
  beforeEach(() => {
    mockFirestoreStore.clear();
    snapshotListeners = [];
    snapshotErrorListeners = [];
    mockSetDocFail = false;
    mockDeleteDocFail = false;
  });

  describe('1. Firestore app loading', () => {
    it('should subscribe and load apps directly from Firestore documents', () => {
      // Seed mock Firestore with migrated apps
      mockFirestoreStore.set('app_01', {
        name: 'WebAppyPie Reader',
        packageId: 'com.webappypie.reader',
        platform: 'android',
        version: '1.2.0',
        environment: 'production',
        enabledModules: ['promotion', 'ads', 'analytics'],
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });
      mockFirestoreStore.set('app_02', {
        name: 'Pie Calc Pro',
        packageId: 'com.webappypie.calc',
        bundleId: 'com.webappypie.calc',
        platform: 'ios',
        version: '2.0.4',
        environment: 'production',
        enabledModules: ['ads', 'promotion'],
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      let loadedApps: App[] = [];
      const unsubscribe = subscribeApps((apps) => {
        loadedApps = apps;
      });

      expect(loadedApps).toHaveLength(2);
      expect(loadedApps[0]?.id).toBe('app_01');
      expect(loadedApps[0]?.name).toBe('WebAppyPie Reader');
      expect(loadedApps[1]?.id).toBe('app_02');
      expect(loadedApps[1]?.platform).toBe('ios');

      unsubscribe();
    });
  });

  describe('2. App creation in Firestore', () => {
    it('should persist a new application document into Firestore', async () => {
      const created = await createApp(
        {
          name: 'Super Scanner',
          packageId: 'com.webappypie.scanner',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
          enabledModules: ['promotion'],
        },
        mockActor,
      );

      expect(created.id).toMatch(/^app_\d+$/);
      expect(created.name).toBe('Super Scanner');

      // Verify the document exists in Firestore
      const stored = mockFirestoreStore.get(created.id);
      expect(stored).toBeDefined();
      expect(stored.name).toBe('Super Scanner');
      expect(stored.packageId).toBe('com.webappypie.scanner');
      expect(stored.platform).toBe('android');
    });
  });

  describe('3. App update in Firestore', () => {
    it('should persist updates into existing Firestore document with merge', async () => {
      mockFirestoreStore.set('app_test_update', {
        name: 'Initial Name',
        packageId: 'com.webappypie.init',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: ['promotion'],
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      await updateApp(
        'app_test_update',
        {
          name: 'Renamed Application',
          version: '1.1.0',
        },
        mockActor,
      );

      const updated = mockFirestoreStore.get('app_test_update');
      expect(updated.name).toBe('Renamed Application');
      expect(updated.version).toBe('1.1.0');
      // Preserves original fields
      expect(updated.packageId).toBe('com.webappypie.init');
      expect(updated.platform).toBe('android');
    });

    it('should not fail when input has undefined fields and should never pass undefined to setDoc', async () => {
      mockFirestoreStore.set('app_undefined_test', {
        name: 'Defined App',
        packageId: 'com.webappypie.defined',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: ['ads'],
      });

      // Calling updateApp with explicit undefined fields (must NOT throw)
      await updateApp(
        'app_undefined_test',
        {
          name: 'Defined App Renamed',
          bundleId: undefined,
          firebaseProjectId: undefined,
          firebaseAndroidAppId: undefined,
          firebaseIosAppId: undefined,
          fcmSenderId: undefined,
        },
        mockActor,
      );

      const updated = mockFirestoreStore.get('app_undefined_test');
      expect(updated.name).toBe('Defined App Renamed');
      expect(updated.bundleId).toBeUndefined();
    });

    it('should remove field in Firestore when null is passed to updateApp', async () => {
      mockFirestoreStore.set('app_delete_field_test', {
        name: 'App With Bundle',
        packageId: 'com.webappypie.bundle',
        bundleId: 'com.webappypie.bundle.old',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: ['ads'],
      });

      // Pass null for bundleId to clear it
      await updateApp(
        'app_delete_field_test',
        {
          bundleId: null,
        },
        mockActor,
      );

      const updated = mockFirestoreStore.get('app_delete_field_test');
      expect(updated.name).toBe('App With Bundle');
      expect('bundleId' in updated).toBe(false);
    });
  });

  describe('4. Persistence after reload', () => {
    it('should retain edited values when a new subscription is established after reload', async () => {
      // 1. App initially exists in Firestore
      mockFirestoreStore.set('app_reload_test', {
        name: 'Original App Title',
        packageId: 'com.webappypie.reload',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: ['ads'],
        status: 'active',
      });

      // 2. User edits app name
      await updateApp(
        'app_reload_test',
        {
          name: 'Updated App Title (Persisted)',
        },
        mockActor,
      );

      // 3. User refreshes page: old component unmounts, new component subscribes
      let reloadedApps: App[] = [];
      const unsubscribe = subscribeApps((apps) => {
        reloadedApps = apps;
      });

      const found = reloadedApps.find((a) => a.id === 'app_reload_test');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Updated App Title (Persisted)');
      // Must NOT revert to "Original App Title"
      expect(found?.name).not.toBe('Original App Title');

      unsubscribe();
    });
  });

  describe('5. Failed write showing an error (no silent catch)', () => {
    it('should throw an error on createApp when Firestore write fails', async () => {
      mockSetDocFail = true;

      await expect(
        createApp(
          {
            name: 'Will Fail App',
            packageId: 'com.webappypie.fail',
            platform: 'android',
            version: '1.0.0',
            environment: 'production',
            enabledModules: [],
          },
          mockActor,
        ),
      ).rejects.toThrow('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');
    });

    it('should throw an error on updateApp when Firestore write fails', async () => {
      mockFirestoreStore.set('app_fail_update', {
        name: 'Existing App',
        packageId: 'com.webappypie.existing',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: [],
      });

      mockSetDocFail = true;

      await expect(
        updateApp(
          'app_fail_update',
          {
            name: 'Attempted Update',
          },
          mockActor,
        ),
      ).rejects.toThrow('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');

      // Verify data in Firestore was NOT modified
      const app = mockFirestoreStore.get('app_fail_update');
      expect(app.name).toBe('Existing App');
    });

    it('should throw an error on deleteApp when Firestore delete fails', async () => {
      mockFirestoreStore.set('app_fail_delete', {
        name: 'Do Not Delete',
        packageId: 'com.webappypie.nodelete',
      });

      mockDeleteDocFail = true;

      await expect(deleteApp('app_fail_delete', mockActor)).rejects.toThrow(
        'Firestore: Network unavailable (UNAVAILABLE)',
      );

      // App must still exist in Firestore
      expect(mockFirestoreStore.has('app_fail_delete')).toBe(true);
    });
  });

  describe('6. No mock fallback', () => {
    it('should deliver empty array when Firestore collection is empty, without falling back to mock apps', () => {
      mockFirestoreStore.clear();

      let emittedApps: App[] | null = null;
      const unsubscribe = subscribeApps((apps) => {
        emittedApps = apps;
      });

      expect(emittedApps).not.toBeNull();
      expect(emittedApps).toHaveLength(0);
      expect(emittedApps).toEqual([]);

      unsubscribe();
    });

    it('should trigger onError callback when Firestore listener fails, and never emit mock apps', () => {
      let receivedError: Error | null = null;
      let receivedData: App[] | null = null;

      const unsubscribe = subscribeApps(
        (apps) => {
          receivedData = apps;
        },
        (err) => {
          receivedError = err;
        },
      );

      // Simulate a Firestore snapshot error event
      const firestoreErr = new Error('Permission denied: rules evaluation failed');
      for (const errListener of snapshotErrorListeners) {
        errListener(firestoreErr);
      }

      expect(receivedError).toBe(firestoreErr);
      // Ensure mock apps are never emitted on error
      expect(receivedData).toEqual([]);

      unsubscribe();
    });
  });

  describe('7. UI and Form error propagation', () => {
    it('should simulate modal submission failure and surface error message to user without showing saved', async () => {
      mockSetDocFail = true;

      let modalClosed = false;
      let errorState: string | null = null;

      const mockOnClose = () => {
        modalClosed = true;
      };

      const handleModalSubmit = async (data: any) => {
        try {
          await createApp(data, mockActor);
          mockOnClose();
        } catch (err: unknown) {
          errorState = err instanceof Error ? err.message : 'Failed to save application';
        }
      };

      await handleModalSubmit({
        name: 'Faulty App',
        packageId: 'com.webappypie.faulty',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        enabledModules: [],
      });

      // Assert modal did NOT close
      expect(modalClosed).toBe(false);
      // Assert error was surfaced
      expect(errorState).toBe('Firestore: Missing or insufficient permissions (PERMISSION_DENIED)');
    });
  });

  describe('8. Application Credentials (App ID & X-App-Key)', () => {
    it('should auto-generate a secure appKey when creating an application and persist it to Firestore', async () => {
      const created = await createApp(
        {
          name: 'Cred Test App',
          packageId: 'com.webappypie.credtest',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
          enabledModules: ['ai', 'ads'],
        },
        mockActor,
      );

      expect(created.id).toMatch(/^app_\d+$/);
      expect(created.appKey).toBeDefined();
      expect(created.appKey).toMatch(/^wap_key_[a-f0-9]{40}$/);

      // Verify stored in Firestore
      const stored = mockFirestoreStore.get(created.id);
      expect(stored).toBeDefined();
      expect(stored.appKey).toBe(created.appKey);
    });

    it('should deliver appKey via subscribeApps and subscribeApp', async () => {
      mockFirestoreStore.set('app_cred_1', {
        name: 'FileZen Secure',
        packageId: 'com.webappypie.filezen',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_test_filezen_prod',
        enabledModules: ['ads'],
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      let loadedList: App[] = [];
      const unsubList = subscribeApps((apps) => {
        loadedList = apps;
      });
      expect(loadedList).toHaveLength(1);
      expect(loadedList[0]?.appKey).toBe('wap_key_test_filezen_prod');
      unsubList();

      let loadedSingle: App | null = null;
      const unsubSingle = subscribeApp('app_cred_1', (app) => {
        loadedSingle = app;
      });
      expect(loadedSingle).not.toBeNull();
      expect((loadedSingle as App | null)?.appKey).toBe('wap_key_test_filezen_prod');
      unsubSingle();
    });

    it('should regenerate appKey, invalidate previous key, and update Firestore', async () => {
      mockFirestoreStore.set('app_cred_2', {
        name: 'OptiLens',
        packageId: 'com.webappypie.optilens',
        platform: 'android',
        version: '1.0.0',
        environment: 'production',
        appKey: 'wap_key_old_credential',
        enabledModules: ['ai'],
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      });

      const newKey = await regenerateAppKey('app_cred_2', mockActor);
      expect(newKey).toMatch(/^wap_key_[a-f0-9]{40}$/);
      expect(newKey).not.toBe('wap_key_old_credential');

      const updatedDoc = mockFirestoreStore.get('app_cred_2');
      expect(updatedDoc.appKey).toBe(newKey);
    });
  });
});
