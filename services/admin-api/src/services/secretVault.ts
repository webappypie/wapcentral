import { ALLOWED_SECRET_NAMES, isAllowedSecretName, type AllowedSecretName } from '../config.js';
import { logAdminAction } from './auditService.js';

export interface SecretMetadata {
  name: AllowedSecretName;
  configured: boolean;
  version: number | null;
  lastUpdated: string | null;
}

export interface SecretWriteResult {
  name: AllowedSecretName;
  configured: true;
  version: number;
  lastUpdated: string;
}

interface StoredSecret {
  value: string;
  version: number;
  lastUpdated: string;
}

// In-memory credential vault (backed by Google Cloud Secret Manager in production)
const secretStore = new Map<AllowedSecretName, StoredSecret>();

// Seed with default signing secret if present in environment
if (process.env['PROMOTION_SIGNING_SECRET']) {
  secretStore.set('PROMOTION_SIGNING_SECRET', {
    value: process.env['PROMOTION_SIGNING_SECRET'],
    version: 1,
    lastUpdated: new Date().toISOString(),
  });
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
  return ALLOWED_SECRET_NAMES.map((name) => {
    const stored = secretStore.get(name);
    return {
      name,
      configured: !!stored && stored.value.length > 0,
      version: stored ? stored.version : null,
      lastUpdated: stored ? stored.lastUpdated : null,
    };
  });
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
 * Internal-only reader for server-side services (e.g. ai-gateway, promotion-api).
 * NEVER expose this function directly via HTTP route endpoints.
 */
export function getInternalSecret(name: AllowedSecretName): string | null {
  const stored = secretStore.get(name);
  return stored ? stored.value : null;
}

export function clearSecretStoreForTest(): void {
  secretStore.clear();
}
