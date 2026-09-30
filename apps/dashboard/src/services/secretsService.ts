import { recordAuditLog } from './auditService.js';

export interface SecretItem {
  name: string;
  description: string;
  configured: boolean;
  version: number | null;
  lastUpdated: string | null;
  category: 'ai' | 'ads' | 'security';
}

let memorySecrets: SecretItem[] = [
  {
    name: 'OPENAI_API_KEY',
    description: 'Private API key for OpenAI GPT-4o models',
    configured: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    category: 'ai',
  },
  {
    name: 'GEMINI_API_KEY',
    description: 'Google AI Studio / Vertex AI Gemini API key',
    configured: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    category: 'ai',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude 3.5 Sonnet API key',
    configured: false,
    version: null,
    lastUpdated: null,
    category: 'ai',
  },
  {
    name: 'SELF_HOSTED_AI_CREDENTIALS',
    description: 'Bearer token/credentials for self-hosted LLM endpoints',
    configured: false,
    version: null,
    lastUpdated: null,
    category: 'ai',
  },
  {
    name: 'ADMOB_REPORTING_CREDENTIALS',
    description: 'Google AdMob Reporting API OAuth service credentials',
    configured: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    category: 'ads',
  },
  {
    name: 'META_AAN_CREDENTIALS',
    description: 'Meta Audience Network API access token',
    configured: false,
    version: null,
    lastUpdated: null,
    category: 'ads',
  },
  {
    name: 'APPLOVIN_API_KEY',
    description: 'AppLovin MAX Management & Reporting API key',
    configured: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString(),
    category: 'ads',
  },
  {
    name: 'PROMOTION_SIGNING_SECRET',
    description: 'HMAC-SHA256 master key for signing mobile promo payloads',
    configured: true,
    version: 3,
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    category: 'security',
  },
  {
    name: 'WEBHOOK_SECRETS',
    description: 'Secret for validating inbound webhooks and partner alerts',
    configured: false,
    version: null,
    lastUpdated: null,
    category: 'security',
  },
];

export async function fetchSecretStatusList(): Promise<SecretItem[]> {
  try {
    const res = await fetch('/api/admin/v1/secrets/status');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return memorySecrets.map((s) => {
          const apiItem = data.data.find((item: any) => item.name === s.name);
          return apiItem ? { ...s, ...apiItem } : s;
        });
      }
    }
  } catch {
    // Offline / demo fallback
  }

  return [...memorySecrets];
}

export async function rotateSecret(
  name: string,
  value: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const item = memorySecrets.find((s) => s.name === name);
  if (item) {
    item.configured = true;
    item.version = (item.version || 0) + 1;
    item.lastUpdated = new Date().toISOString();
  }

  try {
    await fetch(`/api/admin/v1/secrets/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  } catch {
    // Offline / demo fallback
  }

  await recordAuditLog({
    action: 'secret.write',
    actorUid: actor.uid,
    actorEmail: actor.email,
    resourceType: 'secret',
    resourceId: name,
    changes: {
      secret: {
        before: item ? `[CONFIGURED v${item.version ? item.version - 1 : 0}]` : null,
        after: `[CONFIGURED v${item?.version || 1}]`,
      },
    },
  });
}
