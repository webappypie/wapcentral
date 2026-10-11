import type { Response, NextFunction } from 'express';

import type { AppAuthenticatedRequest } from '../types/auth.js';

interface RegisteredApp {
  appId: string;
  appName: string;
  appKey: string;
}

// In-memory registered apps registry
const registeredApps = new Map<string, RegisteredApp>();

function initializeFromEnv(): void {
  registeredApps.clear();
  const envApps = process.env['APP_KEYS'];
  if (envApps) {
    try {
      const parsed = JSON.parse(envApps) as RegisteredApp[];
      if (Array.isArray(parsed)) {
        for (const app of parsed) {
          if (app.appId && app.appKey) {
            registeredApps.set(app.appKey, app);
          }
        }
      }
    } catch {
      // Ignored if invalid JSON
    }
  } else if (process.env['NODE_ENV'] === 'test') {
    // Only in automated test runner
    registeredApps.set('wap_app_key_notes_dev', {
      appId: 'app_01',
      appName: 'WAP Notes AI',
      appKey: 'wap_app_key_notes_dev',
    });
    registeredApps.set('wap_app_key_calc_dev', {
      appId: 'app_02',
      appName: 'Pie Calc Pro',
      appKey: 'wap_app_key_calc_dev',
    });
    registeredApps.set('wap_app_key_habits_dev', {
      appId: 'app_03',
      appName: 'Atomic Habits Tracker',
      appKey: 'wap_app_key_habits_dev',
    });
    registeredApps.set('test-app-key-123', {
      appId: 'test-app',
      appName: 'Test Mock App',
      appKey: 'test-app-key-123',
    });
  }
}

// Initialize on load
initializeFromEnv();

/**
 * Register or update an app key mapping (for testing or runtime registration).
 */
export function registerAppKey(appId: string, appKey: string, appName: string): void {
  registeredApps.set(appKey, { appId, appName, appKey });
}

/**
 * Reset registered apps.
 */
export function resetRegisteredApps(): void {
  initializeFromEnv();
}

/**
 * Light app-key authentication middleware for promotion-api.
 * Identifies the calling app, protects against open unauthenticated queries.
 */
export function authenticateAppKey(
  req: AppAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const headerKey = req.headers['x-app-key'];
  const queryKey = req.query.appKey;

  const rawKey =
    typeof headerKey === 'string' ? headerKey : typeof queryKey === 'string' ? queryKey : null;

  if (!rawKey?.trim()) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing app key. Provide X-App-Key header or appKey query parameter.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const appKey = rawKey.trim();
  const registered = registeredApps.get(appKey);

  if (!registered) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_APP_KEY',
        message: 'Invalid or unregistered app key.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // If query specifies appId, verify it matches the app key
  const requestedAppId = req.query.appId;
  if (typeof requestedAppId === 'string' && requestedAppId !== registered.appId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'APP_ID_MISMATCH',
        message: `App key '${appKey}' belongs to '${registered.appId}', not '${requestedAppId}'.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Attach caller identity
  req.appCaller = {
    appId: registered.appId,
    appName: registered.appName,
    appKey: registered.appKey,
  };

  next();
}
