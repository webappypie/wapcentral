# WebAppyPie Central Infrastructure (WAPCentral)

Reusable central control platform for all current and future WebAppyPie apps, games, and launchers.

## Purpose
- App registry and management
- Firebase/GCP environment configuration
- Secure AI provider management and routing
- AI usage and cost monitoring
- Ads configuration (AdMob, Meta Audience Network, AppLovin MAX, WAPAds)
- Central self-promotion campaign delivery
- Remote configuration and feature flags
- Infrastructure health and audit monitoring

## Technology Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + accessible component library
- **Backend:** Cloud Functions (event-driven) + Cloud Run (long-running services)
- **Database:** Firestore
- **Auth:** Firebase Authentication
- **Storage:** Firebase Storage
- **Hosting:** Firebase Hosting
- **Secrets:** Google Cloud Secret Manager
- **Remote Config:** Firebase Remote Config (mobile runtime flags)
- **Source Control:** GitHub
- **Mobile SDKs:** Flutter/Dart (platform-agnostic API contracts)
- **Monorepo Tooling:** pnpm workspaces + Turborepo

## Ad Networks
1. **Google AdMob** — primary mobile ad network
2. **Meta Audience Network** — secondary mobile ad network
3. **AppLovin MAX** — mediation layer (wraps AdMob + Meta + others)
4. **WAPAds (WebAppyPie Ads)** — proprietary cross-promotion / house-ad network

## Repository Structure
```
WAPCentral/
├── apps/dashboard/          # React admin dashboard
├── services/admin-api/      # Admin backend (Cloud Run)
├── services/promotion-api/  # Campaign delivery (Cloud Run)
├── services/ai-gateway/     # AI routing gateway (Cloud Run)
├── services/workers/        # Background workers (Cloud Functions)
├── packages/ui/             # Shared React component library
├── packages/types/          # Shared TypeScript types
├── packages/config/         # Shared configuration
├── packages/provider-sdk/   # AI provider abstraction
├── packages/validation/     # Shared Zod schemas
├── sdks/wap_promo_sdk/      # Flutter promotion SDK
├── sdks/wap_ads_sdk/        # Flutter ads SDK (AdMob/Meta/AppLovin/WAPAds)
├── infrastructure/          # Firebase + GCP config
├── docs/                    # Architecture documentation
├── tests/                   # Integration/E2E tests
├── scripts/                 # Utility scripts
└── .github/workflows/       # CI/CD pipelines
```

## Critical Rules
1. **Mobile apps must NEVER depend on this dashboard or promotion API for startup.**
   Use local cache/safe defaults and background refresh. Never block app startup.
2. **Never store private API keys in the frontend, mobile apps, GitHub, or client-readable Firestore.**
   All private credentials go to Google Cloud Secret Manager.
3. **Promotion API uses light app-key auth** — the key identifies the app, not a security secret.
   Rate limiting and abuse protection are mandatory.
4. **Feature flags dual-layer:** Firestore = primary (admin-managed). Remote Config = mobile runtime delivery.
5. **Ads SDK (`wap_ads_sdk`) is decoupled from Promo SDK (`wap_promo_sdk`).**
   Do not tightly couple promotion logic with third-party ad network SDKs.

## Environment Strategy
- Three separate Firebase projects: `development`, `staging`, `production`
- Separate credentials and Secret Manager instances per environment
- Production requires explicit human approval for deployment

## Phase Lifecycle
```
READ DOCS → PLAN → IMPLEMENT → TEST → FIX → REVIEW → UPDATE DOCS → GIT COMMIT → GIT PUSH → STOP
```
Never start a future phase automatically. Each phase requires explicit authorization.
