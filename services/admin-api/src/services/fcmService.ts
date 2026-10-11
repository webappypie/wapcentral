import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging, type MulticastMessage } from 'firebase-admin/messaging';
import { config } from '../config.js';
import { getInternalSecret } from './secretVault.js';
import { getFirestoreDb } from './firestore.js';
import { COLLECTIONS } from '@wapcentral/config';

export interface FcmDispatchOptions {
  tokens: string[];
  title: string;
  body: string;
  imageUrl?: string | undefined;
  data?: Record<string, string> | undefined;
  priority?: 'normal' | 'high' | 'urgent' | undefined;
  ttlSeconds?: number | undefined;
  sound?: string | undefined;
  badge?: number | undefined;
  isMandatory?: boolean | undefined;
  appId?: string | undefined;
  firebaseProjectId?: string | undefined;
  fcmCredentialsSecretName?: string | undefined;
}

export interface FcmTokenResult {
  token: string;
  success: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
  errorCode?: string | undefined;
}

export interface FcmDispatchResult {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: FcmTokenResult[];
}

// In-memory cache of initialized Firebase Admin apps by instance name
const initializedFirebaseApps = new Map<string, App>();

export function clearFirebaseAppsForTest(): void {
  initializedFirebaseApps.clear();
}

/**
 * Resolves the appropriate Firebase Messaging instance for a given application
 * by inspecting per-app credentials stored server-side in Secret Manager.
 */
export async function getMessagingForApp(options: {
  appId?: string | undefined;
  firebaseProjectId?: string | undefined;
  fcmCredentialsSecretName?: string | undefined;
}): Promise<{ messaging: Messaging; projectId?: string }> {
  const { appId, firebaseProjectId, fcmCredentialsSecretName } = options;

  // In automated test without real FCM, use default or mock
  if (config.isTest && process.env['USE_REAL_FCM'] !== 'true') {
    if (getApps().length > 0) {
      return { messaging: getMessaging(), projectId: config.firebaseProjectId };
    }
  }

  // 1. Gather app metadata if appId is provided
  let resolvedProjectId = firebaseProjectId;
  let appName: string | undefined;
  let customSecretName = fcmCredentialsSecretName;

  if (appId) {
    try {
      const db = getFirestoreDb();
      const appDoc = await db.collection(COLLECTIONS.APPS).doc(appId).get();
      if (appDoc.exists) {
        const appData = appDoc.data() || {};
        appName = appData['name'];
        if (!resolvedProjectId && appData['firebaseProjectId']) {
          resolvedProjectId = appData['firebaseProjectId'];
        }
        if (!customSecretName && appData['fcmCredentialsSecretName']) {
          customSecretName = appData['fcmCredentialsSecretName'];
        }
      }
    } catch {
      // In-memory or error reading app doc
    }
  }

  // 2. Build candidate secret names in Secret Manager
  const candidateSecretNames: string[] = [];
  if (customSecretName) candidateSecretNames.push(customSecretName);

  if (appId) {
    const cleanAppId = appId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    candidateSecretNames.push(`FCM_CREDENTIALS_${cleanAppId}`);
    candidateSecretNames.push(`FCM_SERVICE_ACCOUNT_${cleanAppId}`);
  }

  if (appName) {
    const cleanAppName = appName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    candidateSecretNames.push(`FCM_CREDENTIALS_${cleanAppName}`);
    candidateSecretNames.push(`FCM_SERVICE_ACCOUNT_${cleanAppName}`);
  }

  if (resolvedProjectId) {
    const cleanProjectId = resolvedProjectId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    candidateSecretNames.push(`FCM_CREDENTIALS_${cleanProjectId}`);
    candidateSecretNames.push(`FCM_SERVICE_ACCOUNT_${cleanProjectId}`);
    candidateSecretNames.push(`FIREBASE_SERVICE_ACCOUNT_${cleanProjectId}`);
  }

  // 3. Query Secret Manager for credentials
  let credentialsJson: string | null = null;
  let matchedSecretName: string | null = null;

  for (const candidate of candidateSecretNames) {
    credentialsJson = await getInternalSecret(candidate);
    if (credentialsJson && credentialsJson.trim().length > 0) {
      matchedSecretName = candidate;
      break;
    }
  }

  // 4. If credentials JSON found in Secret Manager, initialize/retrieve named App
  if (credentialsJson) {
    try {
      const credentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
      const targetProjectId = credentials.project_id || resolvedProjectId;
      const appInstanceName = `fcm_app_${targetProjectId || appId || 'custom'}`;

      const existingApps = getApps();
      const existing = existingApps.find((a) => a.name === appInstanceName);
      if (existing) {
        return { messaging: getMessaging(existing), projectId: targetProjectId };
      }

      const newApp = initializeApp(
        {
          credential: cert(credentials),
          projectId: targetProjectId,
        },
        appInstanceName,
      );
      initializedFirebaseApps.set(appInstanceName, newApp);
      return { messaging: getMessaging(newApp), projectId: targetProjectId };
    } catch (parseErr) {
      console.error(
        `[FcmService] Failed to parse FCM credentials secret '${matchedSecretName}' for app '${appId}':`,
        parseErr,
      );
      throw new Error(`Invalid FCM credentials JSON in Secret Manager for secret '${matchedSecretName}'`);
    }
  }

  // 5. If no specific secret found, check project alignment
  const defaultProjectId =
    process.env['GOOGLE_CLOUD_PROJECT'] ||
    process.env['FIREBASE_PROJECT_ID'] ||
    config.firebaseProjectId ||
    'wapcentral-prod';

  if (resolvedProjectId && resolvedProjectId !== defaultProjectId) {
    console.warn(
      `[FcmService] Warning: Application '${appId}' belongs to Firebase project '${resolvedProjectId}', but no credentials were found in Secret Manager (checked: ${candidateSecretNames.join(', ')}). FCM dispatch may fail with SENDER_ID_MISMATCH unless cross-project permissions are active.`,
    );
  }

  // Fall back to default app
  if (getApps().length > 0) {
    return { messaging: getMessaging(), projectId: defaultProjectId };
  }

  return { messaging: getMessaging(), projectId: defaultProjectId };
}

/**
 * Dispatches push notifications via Firebase Cloud Messaging (FCM).
 * Dynamically routes to the correct per-app Firebase project credentials from Secret Manager.
 * Automatically falls back to safe mock mode during automated tests.
 */
export async function dispatchFcmMulticast(
  options: FcmDispatchOptions,
): Promise<FcmDispatchResult> {
  const { tokens, title, body, imageUrl, data, priority, ttlSeconds, sound, badge } = options;

  if (!tokens || tokens.length === 0) {
    return {
      totalRequested: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  // De-duplicate tokens
  const uniqueTokens = Array.from(new Set(tokens.filter((t) => typeof t === 'string' && t.trim().length > 0)));

  // If in automated test, emulator, or mock mode, safely mock delivery
  const isMockMode =
    (config.isTest && process.env['USE_REAL_FCM'] !== 'true') ||
    process.env['MOCK_FCM'] === 'true' ||
    Boolean(process.env['FIRESTORE_EMULATOR_HOST']);

  if (isMockMode) {
    const results: FcmTokenResult[] = uniqueTokens.map((token) => ({
      token,
      success: true,
      messageId: `mock_fcm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }));

    return {
      totalRequested: uniqueTokens.length,
      successCount: uniqueTokens.length,
      failureCount: 0,
      results,
    };
  }

  try {
    const { messaging, projectId } = await getMessagingForApp({
      appId: options.appId,
      firebaseProjectId: options.firebaseProjectId,
      fcmCredentialsSecretName: options.fcmCredentialsSecretName,
    });

    const results: FcmTokenResult[] = [];
    let overallSuccessCount = 0;
    let overallFailureCount = 0;

    // FCM Multicast limit is 500 tokens per call
    const BATCH_SIZE = 500;
    for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
      const batchTokens = uniqueTokens.slice(i, i + BATCH_SIZE);

      const messagePayload: MulticastMessage = {
        tokens: batchTokens,
        notification: {
          title,
          body,
          ...(imageUrl ? { imageUrl } : {}),
        },
        data: data || {},
        android: {
          priority: priority === 'urgent' || priority === 'high' ? 'high' : 'normal',
          ttl: (ttlSeconds || 604800) * 1000,
          notification: {
            sound: sound || 'default',
            defaultSound: !sound,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound || 'default',
              ...(badge !== undefined ? { badge } : {}),
            },
          },
        },
      };

      const response = await messaging.sendEachForMulticast(messagePayload);
      overallSuccessCount += response.successCount;
      overallFailureCount += response.failureCount;

      response.responses.forEach((res, idx) => {
        const token = batchTokens[idx]!;
        if (res.success) {
          results.push({
            token,
            success: true,
            messageId: res.messageId,
          });
        } else {
          const errCode = res.error?.code || 'FCM_DELIVERY_FAILED';
          const errMsg = res.error?.message || 'FCM delivery failed';
          results.push({
            token,
            success: false,
            error: errMsg,
            errorCode: errCode,
          });
          console.error(
            `[FcmService] Push delivery failed for token '${token.substring(0, 10)}...' (app=${options.appId || 'default'}, project=${projectId}): [${errCode}] ${errMsg}`,
          );
        }
      });
    }

    if (overallFailureCount > 0) {
      console.warn(
        `[FcmService] Multicast dispatch completed with ${overallFailureCount} failure(s) out of ${uniqueTokens.length} token(s) (app=${options.appId || 'default'}, project=${projectId}).`,
      );
    } else {
      console.log(
        `[FcmService] Multicast dispatch succeeded: ${overallSuccessCount}/${uniqueTokens.length} token(s) delivered (app=${options.appId || 'default'}, project=${projectId}).`,
      );
    }

    return {
      totalRequested: uniqueTokens.length,
      successCount: overallSuccessCount,
      failureCount: overallFailureCount,
      results,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown FCM error';
    console.error(`[FcmService] Fatal error during dispatchFcmMulticast (app=${options.appId || 'default'}):`, err);
    return {
      totalRequested: uniqueTokens.length,
      successCount: 0,
      failureCount: uniqueTokens.length,
      results: uniqueTokens.map((token) => ({
        token,
        success: false,
        error: errorMsg,
        errorCode: 'FATAL_DISPATCH_ERROR',
      })),
    };
  }
}
