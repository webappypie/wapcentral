# Changelog — WAPCentral

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Phase 2: Dashboard Shell

- React admin dashboard shell with Vite, TypeScript, Tailwind CSS, and Radix UI
- Sidebar navigation across all 10 core sections
- Firebase Auth guard and authentication flow
- Theme provider (light/dark mode)
- Standardized UI states (loading, empty, error, permission-denied)

---

## [0.2.0] — Phase 1: Firebase Foundation — 2026-09-30

### Added

- Three isolated Firebase environment configurations:
  - `infrastructure/firebase/environments/dev.json` (`wapcentral-dev`)
  - `infrastructure/firebase/environments/staging.json` (`wapcentral-staging`)
  - `infrastructure/firebase/environments/prod.json` (`wapcentral-prod`)
- Production-grade Firestore Security Rules (`infrastructure/firebase/firestore.rules`):
  - Complete RBAC coverage across all 13 collections (`roles`, `apps`, `environments`, `providers`,
    `models`, `aiPolicies`, `campaigns`, `campaignAssets`, `featureFlags`, `usageDaily`,
    `usageEvents`, `healthChecks`, `auditLogs`)
  - 4-level role hierarchy (`viewer`, `editor`, `admin`, `super_admin`) via custom claims or
    `/roles/{uid}` fallback
  - Secret leak prevention: client writes containing raw keys (`apiKey`, `secret`, `privateKey`,
    etc.) are rejected
  - Backend-only write protection: `usageDaily`, `usageEvents`, `healthChecks`, and `auditLogs` are
    write-protected against all client SDKs
  - Immutability checks: `id` and `createdAt` cannot be modified on update
- Production Firebase Storage Security Rules (`infrastructure/firebase/storage.rules`):
  - Public read for campaign creatives (`/campaign-assets/{campaignId}/{assetName}`) for
    non-blocking mobile app delivery
  - Write access restricted to staff with `editor` or higher roles
  - Content-type validation (PNG, JPEG, WebP, GIF, JSON/Lottie) and 5MB maximum file size limit
- Mobile runtime Remote Config template (`infrastructure/firebase/remoteconfig.template.json`):
  - 8 core parameters: `promotion_enabled`, `ai_enabled`, `ads_enabled`, `min_app_version`,
    `maintenance_mode`, `cache_ttl_seconds`, `request_timeout_ms`, `emergency_ai_kill_switch`
- Firestore Composite Indexes (`infrastructure/firebase/firestore.indexes.json`):
  - Optimized indexes for campaigns, daily usage history, raw usage event queries, and audit log
    search
- Emulator Suite and Root CLI integration:
  - Root `firebase.json` and `.firebaserc.example` for convenient developer workflow from repo root
  - `infrastructure/firebase/README.md` complete guide on environments, security rules, RBAC,
    emulators, and deployment
- Comprehensive automated test suites:
  - `tests/infrastructure/firebase-config.test.ts`: 16 automated tests validating environments,
    indexes, remote config, and rules structure
  - `tests/rules/firestore-rules.test.ts`: 20 live security rules tests running against the Firebase
    Firestore Emulator verifying unauthenticated, viewer, editor, admin, and super_admin scenarios

### Security

- Zero unauthenticated access to Firestore
- Private credentials completely blocked from Firestore client collections
- Client writes strictly forbidden on backend operational collections
- Storage rules enforce strict MIME and file size validation

### Tests

- All 15 package & service tasks passed (`pnpm test`)
- 16 infrastructure configuration unit tests passed
- 20 live Firestore security rules tests passed against Firebase emulator (`pnpm test:rules`)
- Prettier format checks passed (`pnpm format:check`)
- Monorepo full build passed (`pnpm build`)

---

## [0.1.0] — Phase 0: Repository & Documentation — 2026-09-30

### Added

- Monorepo initialized with pnpm workspaces + Turborepo
- Root tooling: ESLint (flat config v9), Prettier, TypeScript base config, Vitest
- `.gitignore` with comprehensive coverage (secrets, Firebase, Flutter, IDE)
- `.env.example` with all required environment variables documented
- GitHub Actions CI: lint, format check, type check, tests, build validation
- GitHub Actions Security: dependency audit, env file check, hardcoded secret scan
- Package stubs:
  - `packages/types` — shared TypeScript types (App, Campaign, AI, Ads, RBAC, etc.)
  - `packages/validation` — shared Zod schemas for all data types
  - `packages/config` — shared constants (collections, routes, feature flag keys)
  - `packages/provider-sdk` — AI provider interface stub (IProvider)
  - `packages/ui` — React component library stub
- Service stubs:
  - `services/admin-api` — Admin API stub (Phase 4)
  - `services/promotion-api` — Promotion delivery API stub (Phase 7)
  - `services/ai-gateway` — AI Gateway stub (Phase 6)
  - `services/workers` — Background workers stub (Phase 6 + 11)
- App stubs:
  - `apps/dashboard` — React admin dashboard stub (Phase 2)
- Flutter SDK stubs:
  - `sdks/wap_promo_sdk` — Promotion SDK stub (Phase 8)
  - `sdks/wap_ads_sdk` — Ads SDK stub (Phase 9)
- Infrastructure stubs:
  - `infrastructure/firebase/` — Firebase config, rules placeholders (locked-down defaults)
- Unit tests: `@wapcentral/types` and `@wapcentral/validation` fully tested

### Architecture Decisions Incorporated

- AppLovin MAX confirmed as 3rd external ad network
- WAPAds (own promo system) confirmed as 4th ad source
- Flutter-first mobile SDK with platform-agnostic API contracts
- `wap_promo_sdk` and `wap_ads_sdk` are decoupled packages
- Feature flags: Firestore (primary) + Remote Config (mobile runtime delivery)
- Promotion API: light app-key authentication + rate limiting
- CI/CD: GitHub Actions foundation (production deployment in Phase 13)
- RBAC: 4-level hierarchy (viewer / editor / admin / super_admin)

### Documentation Updated

- `00_MASTER_README.md` — complete rewrite with all decisions
- `01_MASTER_PRD.md` — expanded with all modules, success criteria
- `02_ARCHITECTURE.md` — full system diagram, all decisions, dual-layer flags
- `04_SECURITY_AND_SECRETS.md` — complete credential list, RBAC roles, .env.example
- `05_DEVELOPMENT_PHASES.md` — detailed deliverables per phase
- `07_SETUP_AND_CREDENTIALS_CHECKLIST.md` — comprehensive pre-phase checklist

### Security

- All Firestore rules default to DENY (fail-safe placeholder)
- Storage rules default to DENY
- No secrets in any committed file
- CI secret scan job using Gitleaks
- CI env file check job

### Tests

- `@wapcentral/types`: 7 type compilation tests — all pass
- `@wapcentral/validation`: 14 schema validation tests — all pass
