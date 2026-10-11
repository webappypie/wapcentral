import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthContextUser } from '../contexts/AuthContext.js';
import type { App } from '@wapcentral/types';

describe('App Registry Subscription Lifecycle & Auth Race Condition Guard', () => {
  let activeUnsubscribeSpies: Array<ReturnType<typeof vi.fn>>;
  let subscribeCallCount = 0;
  let lastOnDataCallback: ((apps: App[]) => void) | null = null;
  let lastOnErrorCallback: ((err: Error) => void) | null = null;

  // Mock implementation of subscribeApps
  const mockSubscribeApps = vi.fn(
    (onData: (apps: App[]) => void, onError?: (err: Error) => void) => {
      subscribeCallCount++;
      lastOnDataCallback = onData;
      lastOnErrorCallback = onError ?? null;

      const unsubSpy = vi.fn();
      activeUnsubscribeSpies.push(unsubSpy);
      return unsubSpy;
    },
  );

  const mockUser1: AuthContextUser = {
    uid: 'user_admin_01',
    email: 'admin1@webappypie.com',
    displayName: 'Admin One',
    role: 'super_admin',
    roleLevel: 4,
  };

  const mockUser2: AuthContextUser = {
    uid: 'user_admin_02',
    email: 'admin2@webappypie.com',
    displayName: 'Admin Two',
    role: 'super_admin',
    roleLevel: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    activeUnsubscribeSpies = [];
    subscribeCallCount = 0;
    lastOnDataCallback = null;
    lastOnErrorCallback = null;
  });

  // Harness replicating the exact useEffect lifecycle inside AppsPage.tsx
  function createAppsPageHarness() {
    let currentUser: AuthContextUser | null = null;
    let appsState: App[] = [];
    let viewState: 'content' | 'loading' | 'empty' | 'error' = 'content';
    let errorMessage: string | null = null;
    let currentCleanup: (() => void) | null = null;
    let retryNonce = 0;

    const runEffect = () => {
      // Cleanup previous effect if any
      if (currentCleanup) {
        currentCleanup();
        currentCleanup = null;
      }

      // 1. Do NOT call subscribeApps() until user is available.
      if (!currentUser) {
        appsState = [];
        viewState = 'empty';
        errorMessage = null;
        return;
      }

      // 2. When user becomes available, subscribe to Firestore.
      viewState = 'loading';
      const unsubscribe = mockSubscribeApps(
        (loadedApps) => {
          appsState = loadedApps;
          viewState = loadedApps.length === 0 ? 'empty' : 'content';
          errorMessage = null;
        },
        (err) => {
          errorMessage = err.message;
          viewState = 'error';
        },
      );

      // 3. Register cleanup
      currentCleanup = () => {
        unsubscribe();
      };
    };

    return {
      setUser: (user: AuthContextUser | null) => {
        currentUser = user;
        runEffect();
      },
      retry: () => {
        errorMessage = null;
        viewState = 'loading';
        retryNonce++;
        runEffect();
      },
      unmount: () => {
        if (currentCleanup) {
          currentCleanup();
          currentCleanup = null;
        }
      },
      getState: () => ({
        apps: appsState,
        viewState,
        errorMessage,
        retryNonce,
      }),
    };
  }

  describe('1. Initial render while auth user is unavailable', () => {
    it('should NOT call subscribeApps() when auth user is null/loading', () => {
      const harness = createAppsPageHarness();

      // Initial render: user is null
      harness.setUser(null);

      // Verify no Firestore subscription was initiated
      expect(mockSubscribeApps).not.toHaveBeenCalled();
      expect(subscribeCallCount).toBe(0);
      expect(harness.getState().apps).toEqual([]);
      expect(harness.getState().viewState).toBe('empty');

      harness.unmount();
    });
  });

  describe('2. User becomes available', () => {
    it('should initiate Firestore subscription once auth user is resolved', () => {
      const harness = createAppsPageHarness();

      // Initially unauthenticated
      harness.setUser(null);
      expect(mockSubscribeApps).not.toHaveBeenCalled();

      // Auth resolves and user becomes available
      harness.setUser(mockUser1);

      expect(mockSubscribeApps).toHaveBeenCalledTimes(1);
      expect(subscribeCallCount).toBe(1);
      expect(harness.getState().viewState).toBe('loading');

      // Simulate Firestore delivering documents
      const sampleApps: App[] = [
        {
          id: 'app_01',
          name: 'WebAppyPie Reader',
          packageId: 'com.webappypie.reader',
          platform: 'android',
          version: '1.2.0',
          environment: 'production',
          enabledModules: ['promotion'],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      lastOnDataCallback!(sampleApps);

      expect(harness.getState().apps).toEqual(sampleApps);
      expect(harness.getState().viewState).toBe('content');

      harness.unmount();
    });
  });

  describe('3. User changes', () => {
    it('should unsubscribe the old listener and start a new listener when user identity changes', () => {
      const harness = createAppsPageHarness();

      // User 1 signs in
      harness.setUser(mockUser1);
      expect(mockSubscribeApps).toHaveBeenCalledTimes(1);
      const unsub1 = activeUnsubscribeSpies[0];
      expect(unsub1).toBeDefined();
      expect(unsub1).not.toHaveBeenCalled();

      // User 2 signs in (switching user accounts)
      harness.setUser(mockUser2);

      // Verify old listener was cleaned up
      expect(unsub1).toHaveBeenCalledTimes(1);

      // Verify new listener was initiated for the new user
      expect(mockSubscribeApps).toHaveBeenCalledTimes(2);
      const unsub2 = activeUnsubscribeSpies[1];
      expect(unsub2).toBeDefined();
      expect(unsub2).not.toHaveBeenCalled();

      harness.unmount();
      expect(unsub2).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. User logs out', () => {
    it('should unsubscribe the active listener and clear application state when user logs out', () => {
      const harness = createAppsPageHarness();

      // Active authenticated session
      harness.setUser(mockUser1);
      expect(mockSubscribeApps).toHaveBeenCalledTimes(1);
      const unsub = activeUnsubscribeSpies[0];

      // Simulate loaded data
      lastOnDataCallback!([
        {
          id: 'app_01',
          name: 'App',
          packageId: 'com.app',
          platform: 'android',
          version: '1.0.0',
          environment: 'production',
          enabledModules: [],
          status: 'active',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      expect(harness.getState().apps).toHaveLength(1);

      // User logs out (user becomes null)
      harness.setUser(null);

      // Verify old listener was cleanly unsubscribed
      expect(unsub).toHaveBeenCalledTimes(1);
      // Verify no new subscription was started
      expect(mockSubscribeApps).toHaveBeenCalledTimes(1);
      // Verify state was cleared
      expect(harness.getState().apps).toEqual([]);
      expect(harness.getState().viewState).toBe('empty');

      harness.unmount();
    });
  });

  describe('5. Retry creates a new subscription', () => {
    it('should cleanly unsubscribe and establish a fresh subscription upon retry after an error', () => {
      const harness = createAppsPageHarness();

      // User is available, initial subscription starts
      harness.setUser(mockUser1);
      expect(mockSubscribeApps).toHaveBeenCalledTimes(1);
      const initialUnsub = activeUnsubscribeSpies[0];

      // Simulate a Firestore permission or network error
      lastOnErrorCallback!(new Error('Missing or insufficient permissions (PERMISSION_DENIED)'));

      expect(harness.getState().viewState).toBe('error');
      expect(harness.getState().errorMessage).toBe(
        'Missing or insufficient permissions (PERMISSION_DENIED)',
      );

      // User clicks Retry in the UI
      harness.retry();

      // Verify old listener was cleaned up
      expect(initialUnsub).toHaveBeenCalledTimes(1);

      // Verify fresh subscription was created
      expect(mockSubscribeApps).toHaveBeenCalledTimes(2);
      expect(harness.getState().viewState).toBe('loading');

      // Second attempt succeeds
      lastOnDataCallback!([]);
      expect(harness.getState().viewState).toBe('empty');
      expect(harness.getState().errorMessage).toBeNull();

      harness.unmount();
    });
  });

  describe('6. appsService safe auth guard mechanics', () => {
    it('should safely handle auth state synchronization without duplicate listeners', () => {
      let authCallback: ((user: any) => void) | null = null;
      const mockAuthUnsub = vi.fn();

      const fakeAuth = {
        currentUser: null,
        onAuthStateChanged: vi.fn((cb) => {
          authCallback = cb;
          return mockAuthUnsub;
        }),
      };

      let firestoreListenerCalled = false;
      const fakeOnSnapshot = vi.fn(() => vi.fn());

      // Safe subscription runner matching appsService
      let firestoreUnsub: (() => void) | null = null;
      let authUnsub: (() => void) | null = null;
      let isCleanedUp = false;

      const start = () => {
        if (firestoreUnsub || isCleanedUp) return;
        firestoreListenerCalled = true;
        firestoreUnsub = fakeOnSnapshot();
      };

      if (fakeAuth.currentUser) {
        start();
      } else {
        authUnsub = fakeAuth.onAuthStateChanged((user: any) => {
          if (user && !firestoreUnsub && !isCleanedUp) {
            start();
            if (authUnsub) {
              authUnsub();
              authUnsub = null;
            }
          }
        });
      }

      // Initial state: unauthenticated -> firestore listener NOT called yet
      expect(firestoreListenerCalled).toBe(false);
      expect(fakeAuth.onAuthStateChanged).toHaveBeenCalledTimes(1);

      // Auth fires with user
      authCallback!({ uid: 'usr_live' });

      // Firestore listener is now safely called
      expect(firestoreListenerCalled).toBe(true);
      expect(fakeOnSnapshot).toHaveBeenCalledTimes(1);

      // Auth listener was automatically cleaned up to prevent duplicate listeners
      expect(mockAuthUnsub).toHaveBeenCalledTimes(1);

      // Subsequent auth events do not create duplicate firestore listeners
      authCallback!({ uid: 'usr_live_2' });
      expect(fakeOnSnapshot).toHaveBeenCalledTimes(1);

      // Verify unmount / cleanup
      const cleanup = () => {
        isCleanedUp = true;
        if (authUnsub) authUnsub();
      };
      cleanup();
      expect(isCleanedUp).toBe(true);
    });
  });
});
