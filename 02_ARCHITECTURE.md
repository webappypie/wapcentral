# Technical Architecture — WAPCentral

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────┐
│               ADMIN DASHBOARD (Browser)                  │
│         React + TypeScript + Vite + Tailwind             │
│              Firebase Hosting (CDN)                       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS (Firebase Auth token)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                BACKEND SERVICES (GCP)                    │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  admin-api   │ │  promotion-api  │ │  ai-gateway  │  │
│  │ (Cloud Run)  │ │  (Cloud Run)    │ │ (Cloud Run)  │  │
│  └──────┬───────┘ └────────┬────────┘ └──────┬───────┘  │
│         └─────────────────┬┘                 │          │
│  ┌──────────────────────── ▼─────────────────▼────────┐ │
│  │     Firebase / Google Cloud Data Layer              │ │
│  │  Firestore │ Storage │ Remote Config │ Secret Mgr  │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────────────────┐    │
│  │  usage-worker   │  │       health-worker         │    │
│  │ (Cloud Functions│  │    (Cloud Functions/Run)    │    │
│  └─────────────────┘  └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
         │                        │
         ▼ External AI            ▼ External Ads APIs
  OpenAI / Gemini /         AdMob Reporting /
  Anthropic / Self-hosted   Meta / AppLovin APIs

Mobile Apps (Flutter)
  ├── Boot → load wap_promo_sdk local cache (non-blocking)
  ├── Background refresh → promotion-api (app-key auth)
  ├── AI features → ai-gateway (Firebase Auth token)
  └── Ads → wap_ads_sdk → native AdMob/Meta/AppLovin SDKs
```

## Frontend

- React 18+, TypeScript, Vite
- Tailwind CSS + accessible component library (e.g. shadcn/ui + Radix)
- React Router v6+
- TanStack Query (React Query) for server state
- Zod for schema validation

## Backend

Use **Cloud Run** for long-running/high-control services and **Cloud Functions** for
event-driven/lightweight tasks. No unnecessary microservices in V1.

### Services

| Service         | Runtime         | Responsibility                                                  |
| --------------- | --------------- | --------------------------------------------------------------- |
| `admin-api`     | Cloud Run       | Dashboard API, RBAC, Secret Manager proxy, audit logging        |
| `promotion-api` | Cloud Run       | Campaign delivery, app-key auth, rate limiting, payload signing |
| `ai-gateway`    | Cloud Run       | AI routing, quota enforcement, usage recording, kill switch     |
| `usage-worker`  | Cloud Functions | Aggregate usageEvents → usageDaily                              |
| `health-worker` | Cloud Functions | Heartbeat checks, provider health snapshots                     |

## Firestore Collections

| Collection       | Owner         | Description                                                        |
| ---------------- | ------------- | ------------------------------------------------------------------ |
| `apps`           | admin-api     | App registry (name, packageId, platform, version, env, store URLs) |
| `environments`   | admin-api     | Per-app environment configs                                        |
| `providers`      | admin-api     | AI provider registry (non-secret metadata only)                    |
| `models`         | admin-api     | AI model allowlist per provider                                    |
| `aiPolicies`     | admin-api     | Routing, fallback, quotas, rate limits, kill switches              |
| `campaigns`      | admin-api     | Self-promotion campaigns                                           |
| `campaignAssets` | admin-api     | Creative metadata (refs to Firebase Storage)                       |
| `featureFlags`   | admin-api     | Dashboard-managed feature flags (primary source of truth)          |
| `usageDaily`     | usage-worker  | Aggregated daily AI usage + cost estimates                         |
| `usageEvents`    | ai-gateway    | Individual AI request events                                       |
| `healthChecks`   | health-worker | Provider and service health snapshots                              |
| `auditLogs`      | admin-api     | Append-only admin action log                                       |
| `roles`          | admin-api     | RBAC role assignments (viewer / editor / admin / super-admin)      |

**Rule:** Never store raw private credentials in any Firestore document.

## Secret Manager

All private credentials stored server-side only in Google Cloud Secret Manager:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `ADMOB_REPORTING_CREDENTIALS`
- `META_AAN_CREDENTIALS`
- `APPLOVIN_API_KEY`
- `PROMOTION_SIGNING_SECRET` (HMAC for campaign payload signing)
- `WEBHOOK_SECRETS`
- `SELF_HOSTED_AI_CREDENTIALS`

## Feature Flags — Dual-Layer Model

| Layer              | System                              | Purpose                                             |
| ------------------ | ----------------------------------- | --------------------------------------------------- |
| **Primary**        | Firestore `featureFlags` collection | Dashboard-managed, detailed configuration, admin UI |
| **Mobile runtime** | Firebase Remote Config              | Lightweight fast delivery to mobile, safe defaults  |

**Rules:**

- Firestore is the source of truth for admin-managed config
- Remote Config is for mobile runtime flags needing fast delivery with no server call
- Do NOT duplicate everything in both systems
- Remote Config values are a subset of what Firestore manages
- Precedence for mobile: Remote Config (fast/cached) → promotion-api response → hardcoded safe
  default

## Ad Networks Architecture

| Network               | Role                        | Config Location               | Private Credentials |
| --------------------- | --------------------------- | ----------------------------- | ------------------- |
| Google AdMob          | Primary ad network          | Firestore `apps.adConfig`     | Secret Manager      |
| Meta Audience Network | Secondary ad network        | Firestore `apps.adConfig`     | Secret Manager      |
| AppLovin MAX          | Mediation layer             | Firestore `apps.adConfig`     | Secret Manager      |
| WAPAds (own network)  | Cross-promotion / house ads | `campaigns` + `promotion-api` | Signing secret      |

- Ad unit IDs and placement IDs are **public config** (stored in Firestore, readable by app after
  auth)
- Private reporting/management API credentials are **backend-only** in Secret Manager
- No actual ad serving happens on the server — native SDKs handle rendering in Flutter apps

## Promotion Response Schema (Versioned)

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "campaignId": "campaign_123",
  "title": "Try App X",
  "description": "...",
  "imageUrl": "https://storage.googleapis.com/...",
  "animationUrl": "https://storage.googleapis.com/...",
  "ctaText": "Install",
  "storeUrl": "https://play.google.com/...",
  "layoutVariant": "banner",
  "expiresAt": "2026-10-01T00:00:00Z",
  "cacheTtlSeconds": 21600
}
```

Payload is HMAC-signed using `PROMOTION_SIGNING_SECRET` (backend-only). Mobile SDK validates
signature before applying.

## Promotion Client Behavior (wap_promo_sdk)

1. App boots → SDK reads from local cache immediately (zero latency)
2. App renders normally with cached/default state
3. Background: SDK fetches from `promotion-api` with app-key auth
4. Response validated (schema + HMAC signature)
5. Cache updated (TTL honored)
6. UI state updated safely
7. On failure: retain cache → use default → hide promo (never crash, never block)

## AI Gateway Flow

```
Mobile App → Firebase Auth token
  → ai-gateway authenticates token
  → validates appId + feature
  → checks quota (per-app, per-feature, optional per-user)
  → checks model allowlist
  → selects route (primary → fallback providers)
  → calls provider with timeout + retry
  → records usageEvent (async)
  → records cost estimate (async)
  → returns normalized response
```

### Provider Interface (packages/provider-sdk)

```typescript
interface IProvider {
  generate(params: GenerateParams): Promise<GenerateResponse>;
  analyzeImage(params: ImageParams): Promise<GenerateResponse>;
  embed(params: EmbedParams): Promise<EmbeddingResponse>;
  healthCheck(): Promise<HealthStatus>;
  estimateCost(params: CostParams): CostEstimate;
}
```

## Cost Controls

- Per-app budget caps
- Per-feature quotas
- Per-user quotas (optional, Phase 6)
- Model allowlist enforcement
- Input/output token limits
- Safe response caching
- Emergency kill switch (per provider or global)
- Cloud billing alerts + AI provider spending limits

## Environments

- `development` — local dev + Firebase dev project
- `staging` — pre-production testing + Firebase staging project
- `production` — live traffic + Firebase prod project (separate credentials)

Prefer separate Firebase projects per environment.

## Monorepo Structure

```
WAPCentral/
├── apps/
│   └── dashboard/          # React admin SPA
├── services/
│   ├── admin-api/          # Admin backend service
│   ├── promotion-api/      # Campaign delivery service
│   ├── ai-gateway/         # AI routing service
│   └── workers/            # Background workers
├── packages/
│   ├── ui/                 # Shared React components
│   ├── types/              # Shared TypeScript types/interfaces
│   ├── config/             # Shared constants and config
│   ├── provider-sdk/       # AI provider abstraction layer
│   └── validation/         # Shared Zod validation schemas
├── sdks/
│   ├── wap_promo_sdk/      # Flutter: own-app promotion SDK
│   └── wap_ads_sdk/        # Flutter: ad network wrapper SDK
├── infrastructure/
│   ├── firebase/           # Firebase config and rules
│   └── gcloud/             # Cloud Run / GCP configs
├── docs/                   # Architecture documentation
├── tests/                  # Integration / E2E tests
├── scripts/                # Utility and deployment scripts
└── .github/workflows/      # GitHub Actions CI/CD
```

**Tooling:** pnpm workspaces + Turborepo for task orchestration.

## Mobile SDK Architecture (Platform-Agnostic Contracts)

API contracts are platform-agnostic HTTP/JSON. V1 implements Flutter/Dart only. Future versions may
add native Android/iOS without changing backend contracts.

### wap_promo_sdk (Flutter)

- Cache-first, non-blocking startup
- Background refresh with timeout
- HMAC signature validation
- Frequency capping
- Banner/creative config rendering
- Analytics event dispatch (fire-and-forget)

### wap_ads_sdk (Flutter)

- AdMob integration
- Meta Audience Network integration
- AppLovin MAX mediation integration
- WAPAds (own promo) integration hook
- Decoupled from wap_promo_sdk

## CI/CD (GitHub Actions — Phase 0 Foundation)

Phase 0 establishes CI foundation:

- Lint checks (ESLint)
- Format checks (Prettier)
- Unit test execution (Vitest)
- TypeScript build validation
- Secret scanning (no credentials in code)

Production deployment pipelines added in Phase 13.

## Observability

- Request IDs on all service calls
- Latency + error rate per endpoint
- Provider failure rates + cost estimates
- Promotion impressions + clicks + cache hit rate
- Do NOT log sensitive payloads, auth headers, or secret values

## Promotion API Authentication

- Mobile apps use a **light app-key** (non-secret, identifies the app)
- App key stored in Firestore `apps` collection, readable by the app after registration
- Rate limiting per app-key (e.g. 60 req/min per key)
- Abuse protection: block/throttle suspicious patterns
- App key is NOT a security secret — sensitive operations remain server-side only
