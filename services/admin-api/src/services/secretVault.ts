import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ALLOWED_SECRET_NAMES, isAllowedSecretName, type AllowedSecretName } from '../config.js';
import { logAdminAction } from './auditService.js';

export interface SecretMetadata {
  name: AllowedSecretName | string;
  configured: boolean;
  version: number | null;
  lastUpdated: string | null;
}

export interface SecretWriteResult {
  name: AllowedSecretName | string;
  configured: true;
  version: number;
  lastUpdated: string;
}

interface StoredSecret {
  value: string;
  version: number;
  lastUpdated: string;
}

interface CachedSecret {
  value: string;
  expiresAt: number;
}

// In-memory credential vault (session write-overrides)
const secretStore = new Map<string, StoredSecret>();

// In-memory TTL cache for Secret Manager lookups
const secretCache = new Map<string, CachedSecret>();
export const SECRET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Seed with default secrets if present in environment (e.g. Secret Manager mounted env vars)
for (const secretName of ALLOWED_SECRET_NAMES) {
  if (process.env[secretName]) {
    secretStore.set(secretName, {
      value: process.env[secretName]!,
      version: 1,
      lastUpdated: new Date().toISOString(),
    });
  }
}

// Singleton Secret Manager client using Application Default Credentials (ADC)
let secretManagerClient: SecretManagerServiceClient | null = null;

function getSecretClient(): SecretManagerServiceClient | null {
  if (process.env['NODE_ENV'] === 'test' && !process.env['ENABLE_TEST_SECRET_MANAGER']) {
    return secretManagerClient;
  }
  if (!secretManagerClient) {
    try {
      secretManagerClient = new SecretManagerServiceClient();
    } catch {
      secretManagerClient = null;
    }
  }
  return secretManagerClient;
}

export function setSecretClientForTest(client: any): void {
  secretManagerClient = client;
}

/**
 * Sanitizes strings for logging, ensuring secret values never leak into log streams.
 */
export function redact(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.substring(0, 3)}...${value.substring(value.length - 3)}`;
}

/**
 * Write or rotate a secret credential.
 * Write-only: Never returns the raw secret in the response.
 */
export async function writeSecret(
  name: string,
  value: string,
  actor: { uid: string; email: string },
): Promise<SecretWriteResult> {
  if (!isAllowedSecretName(name)) {
    throw new Error(
      `Invalid secret name: '${name}'. Allowed secrets: ${ALLOWED_SECRET_NAMES.join(', ')}`,
    );
  }

  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Secret value must be a non-empty string');
  }

  const existing = secretStore.get(name);
  const nextVersion = (existing?.version ?? 0) + 1;
  const now = new Date().toISOString();

  secretStore.set(name, {
    value: value.trim(),
    version: nextVersion,
    lastUpdated: now,
  });

  // Clear any cached Secret Manager version so the new write takes immediate effect
  secretCache.delete(name);

  await logAdminAction({
    action: 'secret.write',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'secret',
    resourceId: name,
    changes: {
      secret: {
        before: existing ? `[CONFIGURED v${existing.version}]` : null,
        after: `[CONFIGURED v${nextVersion}]`,
      },
    },
  });

  return {
    name,
    configured: true,
    version: nextVersion,
    lastUpdated: now,
  };
}

/**
 * Lists the status of all allowed secrets.
 * Strictly metadata only (configured, version, lastUpdated).
 * NEVER returns actual secret strings.
 */
export async function getSecretStatusList(): Promise<SecretMetadata[]> {
  const list: SecretMetadata[] = [];
  for (const name of ALLOWED_SECRET_NAMES) {
    const stored = secretStore.get(name);
    const hasEnv = !!process.env[name];
    let isConfigured = (!!stored && stored.value.length > 0) || hasEnv;
    let version = stored ? stored.version : hasEnv ? 1 : null;
    let lastUpdated = stored ? stored.lastUpdated : hasEnv ? new Date().toISOString() : null;

    if (!isConfigured) {
      try {
        const val = await getInternalSecret(name);
        if (val) {
          isConfigured = true;
          version = 1;
          lastUpdated = new Date().toISOString();
        }
      } catch {
        // Not configured
      }
    }

    list.push({
      name,
      configured: isConfigured,
      version,
      lastUpdated,
    });
  }
  return list;
}

/**
 * Deletes or disables a secret. (Restricted to super_admin).
 */
export async function deleteSecret(
  name: string,
  actor: { uid: string; email: string },
): Promise<{ name: string; deleted: boolean }> {
  if (!isAllowedSecretName(name)) {
    throw new Error(`Invalid secret name: '${name}'`);
  }

  const existed = secretStore.delete(name);
  secretCache.delete(name);

  if (existed) {
    await logAdminAction({
      action: 'secret.write',
      actorUid: actor.uid,
      actorEmail: actor.email,
      resourceType: 'secret',
      resourceId: name,
      changes: {
        secret: { before: '[CONFIGURED]', after: null },
      },
    });
  }

  return { name, deleted: existed };
}

/**
 * Internal-only reader for server-side services (e.g. ai-gateway, promotion-api, provider health checks).
 * Order of resolution:
 * 1. In-memory session store (explicitly written/rotated secrets)
 * 2. In-memory TTL cache from Secret Manager
 * 3. Google Cloud Secret Manager via ADC (latest enabled version)
 * 4. Fallback to process.env
 *
 * Security:
 * - NEVER log the secret value.
 * - NEVER return the secret via HTTP responses.
 * - NEVER write the secret to Firestore.
 */
export async function getInternalSecret(name: string): Promise<string | null> {
  // 1. In-memory session write override
  const stored = secretStore.get(name);
  if (stored && stored.value) {
    return stored.value;
  }

  // 2. Memory TTL cache check
  const cached = secretCache.get(name);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // 3. Google Cloud Secret Manager retrieval
  const client = getSecretClient();
  if (client) {
    try {
      const projectId =
        process.env['GOOGLE_CLOUD_PROJECT'] ||
        process.env['FIREBASE_PROJECT_ID'] ||
        'wapcentral-prod';
      const secretResource = `projects/${projectId}/secrets/${name}/versions/latest`;
      try {
        const [version] = await client.accessSecretVersion({ name: secretResource });
        const payload = version.payload?.data?.toString();
        if (payload && payload.length > 0) {
          secretCache.set(name, {
            value: payload,
            expiresAt: Date.now() + SECRET_CACHE_TTL_MS,
          });
          return payload;
        }
      } catch {
        // Fallback for Claude/Anthropic naming variations in Secret Manager
        if (name === 'ANTHROPIC_API_KEY') {
          try {
            const fallbackResource = `projects/${projectId}/secrets/CLAUDE_API_KEY/versions/latest`;
            const [version] = await client.accessSecretVersion({ name: fallbackResource });
            const payload = version.payload?.data?.toString();
            if (payload && payload.length > 0) {
              secretCache.set(name, {
                value: payload,
                expiresAt: Date.now() + SECRET_CACHE_TTL_MS,
              });
              return payload;
            }
          } catch {
            // Ignore fallback failure
          }
        }
      }
    } catch {
      // Secret Manager not accessible, permission denied, or offline - fall back to env var
    }
  }

  // 4. Fallback to process.env
  if (process.env[name]) {
    return process.env[name]!;
  }
  if (name === 'ANTHROPIC_API_KEY' && process.env['CLAUDE_API_KEY']) {
    return process.env['CLAUDE_API_KEY']!;
  }

  return null;
}

export function clearSecretStoreForTest(): void {
  secretStore.clear();
  secretCache.clear();
  secretManagerClient = null;
}

