# Security & Secrets — WAPCentral

## Golden Rule

**Private credentials are backend-only.** The dashboard uses write-only forms — secrets are never
read back or displayed to admins after saving.

## Credentials List

| Credential                    | Storage        | Purpose                              |
| ----------------------------- | -------------- | ------------------------------------ |
| `OPENAI_API_KEY`              | Secret Manager | OpenAI AI provider                   |
| `GEMINI_API_KEY`              | Secret Manager | Google Gemini AI provider            |
| `ANTHROPIC_API_KEY`           | Secret Manager | Anthropic AI provider                |
| `SELF_HOSTED_AI_CREDENTIALS`  | Secret Manager | Self-hosted/open-source model server |
| `ADMOB_REPORTING_CREDENTIALS` | Secret Manager | AdMob API reporting access           |
| `META_AAN_CREDENTIALS`        | Secret Manager | Meta Audience Network API access     |
| `APPLOVIN_API_KEY`            | Secret Manager | AppLovin MAX API access              |
| `PROMOTION_SIGNING_SECRET`    | Secret Manager | HMAC signing for campaign payloads   |
| `WEBHOOK_SECRETS`             | Secret Manager | Inbound webhook verification         |

## Public Configuration (Firestore — NOT secrets)

- AdMob App IDs and Ad Unit IDs
- Meta Placement IDs
- AppLovin SDK Key (public identifier)
- App package/bundle IDs
- Store URLs
- Feature flag values

## What Lives Where

```
Google Cloud Secret Manager (server-side only)
  └── All private API keys, signing secrets, webhook secrets

Firestore (rules-locked, no raw secrets)
  └── App metadata, ad unit IDs (public identifiers), feature flags,
      campaign data, AI policy config (non-secret), usage records

Firebase Remote Config
  └── Mobile runtime feature flags (subset of Firestore flags)

.env.example (committed to Git — EXAMPLE ONLY, no real values)
  └── Template of required environment variables

.env (NEVER committed — real values for local dev only)
  └── Real values injected at runtime from Secret Manager or local override
```

## Hard Rules — Never Violate

- ❌ Never commit `.env` files or service account JSON
- ❌ Never commit `google-services.json` (Firebase) to public repos — use CI secrets
- ❌ Never hard-code keys in Flutter (`wap_promo_sdk`, `wap_ads_sdk`) or React
- ❌ Never store private API keys in Firestore (any collection)
- ❌ Never return secrets from any API response
- ❌ Never log authorization headers, API keys, or signing secrets
- ❌ Never use the same credentials across dev/staging/prod environments

## RBAC Role Hierarchy

| Role          | Permissions                                                              |
| ------------- | ------------------------------------------------------------------------ |
| `viewer`      | Read dashboards, view logs, view configs                                 |
| `editor`      | All viewer + create/edit campaigns, manage apps, update flags            |
| `admin`       | All editor + manage providers, manage secrets (write-only), manage users |
| `super-admin` | All admin + manage roles, delete resources, access audit trail           |

## .env.example Template

```
# Firebase (dashboard)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Backend services (injected at runtime from Secret Manager)
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
ADMOB_REPORTING_CREDENTIALS=
META_AAN_CREDENTIALS=
APPLOVIN_API_KEY=
PROMOTION_SIGNING_SECRET=
WEBHOOK_SECRETS=

# Service config
FIREBASE_PROJECT_ID=
GOOGLE_CLOUD_PROJECT=
ENVIRONMENT=development
```

## Security Operations

- MFA enforced for `admin` and `super-admin` roles
- Least-privilege service accounts (separate per service)
- Separate credentials per environment (dev/staging/prod)
- Documented credential rotation procedure (rotate without downtime)
- Emergency disable procedure for each provider
- Secret scanning in GitHub Actions CI (Phase 0)
- Security hardening review in Phase 12

## Promotion Endpoint Security

- Light app-key authentication (public identifier, not a password)
- Rate limiting: configurable per app-key (default 60 req/min)
- Abuse detection and automatic throttling
- Campaign payload signed with HMAC (`PROMOTION_SIGNING_SECRET`)
- Mobile SDK validates HMAC before applying any payload
