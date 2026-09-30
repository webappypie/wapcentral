# Changelog — WAPCentral

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Phase 6: AI Gateway & Usage

- `services/ai-gateway/` Cloud Run service with request authentication (Firebase Auth tokens)
- Model routing, circuit-breaker failover execution, and timeout/retry handling
- Quota and rate-limit enforcement engine
- Non-blocking asynchronous Firestore `usageEvents` telemetry logging
- `usageDaily` aggregation worker and cost estimation tracking

---

## [0.6.0] — Phase 5: AI Provider Management — 2026-09-30

### Added

- **AI Provider Abstraction Layer (`packages/provider-sdk`):**
  - Platform-agnostic `IProvider` interface defining standard contracts for `generate`,
    `analyzeImage`, `embed`, `healthCheck`, and `estimateCost`.
  - `OpenAIProvider`: Chat completions, GPT-4o multimodal vision, embeddings
    (`text-embedding-3-small`), and models health check.
  - `GeminiProvider`: Google Generative Language REST integration with `generateContent`, multimodal
    inlineData, embeddings, and models endpoint probe.
  - `AnthropicProvider`: Anthropic Claude messages integration with multimodal base64 image blocks
    and latency checks.
  - `SelfHostedProvider`: Support for self-hosted LLM endpoints via OpenAI-compatible API (vLLM/TGI)
    or Ollama native API (`/api/generate`) with zero cloud cost estimation.
  - `costEstimator`: Dynamic cost estimation engine with default rate cards for `gpt-4o`,
    `gpt-4o-mini`, `gemini-1.5-flash`, `gemini-1.5-pro`, `claude-3-5-sonnet`, `llama-3.1-8b`, and
    custom overrides, strictly tagged `isEstimate: true`.
  - `ProviderError`: Standardized error taxonomy mapping HTTP error codes to `AUTH_ERROR`,
    `RATE_LIMITED`, `QUOTA_EXCEEDED`, `TIMEOUT`, `INVALID_REQUEST`, `CONTEXT_TOO_LONG`, and
    `PROVIDER_ERROR` with retryable flags.
  - `ProviderRegistry`: In-memory provider registry for managing active adapter instances.
  - 19 automated unit and mock integration tests
    (`packages/provider-sdk/src/tests/provider-sdk.test.ts`).
- **Validation Schemas & Shared Types (`packages/validation`, `packages/types`):**
  - Updated `AiProvider`, `AiModel`, and `AiPolicy` models with optional `baseUrl` and
    `description`.
  - Added `CreateAiProviderSchema`, `UpdateAiProviderSchema`, `AiModelSchema`,
    `CreateAiPolicySchema`, `UpdateAiPolicySchema`, and `FallbackEntrySchema`.
  - Added new audit action types: `provider.delete`, `policy.create`, `policy.update`,
    `policy.delete`, `policy.toggle`.
- **Admin API AI Routes (`services/admin-api`):**
  - `aiProvidersRouter` (`/v1/ai/providers`): Provider list, get details, create with write-only
    Secret Manager key vault integration, update, delete (super_admin), and active connection health
    check trigger (`POST /:id/health-check`).
  - `aiPoliciesRouter` (`/v1/ai/policies`): Routing policies list, create, update, quick status
    toggle (`PATCH /:id/toggle`), and delete.
  - All mutating provider and policy operations automatically write structured entries to the audit
    trail.
  - 5 new integration tests in `services/admin-api/src/tests/api.test.ts` (21 tests total passing).
- **Dashboard AI Management Console (`apps/dashboard`):**
  - `services/aiService.ts`: Client service managing providers, policies, health checks, and audit
    logging with offline fallback resilience.
  - `AiProviderModal.tsx`: Modal for registering and configuring AI providers, managing model
    allowlists, and safely storing credentials in Secret Manager.
  - `AiPolicyModal.tsx`: Modal for configuring feature-level routing policies, multi-tier fallback
    chains, and daily/request quota caps.
  - `pages/AiPage.tsx`: Revamped interface with tabbed views:
    - Provider cards with active status, latency badges, and live "Test Connection" trigger buttons.
    - Routing Policies table with emergency kill switches and fallback chain visualizations.
    - Model catalog with reference rate card per 1,000,000 tokens and context limit indicators.
  - 2 new unit tests in `apps/dashboard/src/services.test.ts` (14 tests total passing).

### Tests & Validation

- 19/19 tests passing in `packages/provider-sdk`.
- 21/21 tests passing in `services/admin-api`.
- 14/14 tests passing in `apps/dashboard`.
- 16/16 tests passing in root infrastructure.
- 20/20 Firestore security rules tests passing on local emulator.
- 10/10 monorepo packages building cleanly in Turborepo.
- 100% Prettier code formatting verified.

---

## [0.5.0] — Phase 4: Secure Backend & Key Vault — 2026-09-30

### Added

- **Admin API Service (`services/admin-api`):**
  - Express + TypeScript architecture with production security headers (`nosniff`, `frameguard`,
    `XSS protection`), configurable CORS, and centralized error handling.
  - Health check endpoints (`/health` and `/v1/health`) for Cloud Run / container liveness probes.
  - Strict RBAC middleware (`viewer` < `editor` < `admin` < `super_admin`) enforcing role-level
    authorization with HTTP 401/403 responses.
  - Bearer token authentication supporting JWT validation and local development mock tokens.
  - Audit logging middleware recording every mutating administrative operation (`logAdminAction`)
    with actor, resource, action, and timestamp.
- **Secret Manager Key Vault (`services/admin-api/src/services/secretVault.ts`):**
  - Google Cloud Secret Manager abstraction with write-only credentials management.
  - Zero-lag in-memory fallback for local development and test isolation with zero external cloud
    dependencies.
  - Strict key allowlist (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
    `SELF_HOSTED_AI_CREDENTIALS`, `ADMOB_REPORTING_CREDENTIALS`, `META_AAN_CREDENTIALS`,
    `APPLOVIN_API_KEY`, `PROMOTION_SIGNING_SECRET`, `WEBHOOK_SECRETS`).
  - Zero-leakage guarantee: secret values are never returned by any endpoint or log statement; only
    metadata (`name`, `configured`, `version`, `lastUpdated`) is exposed.
  - Built-in redaction helper sanitizing credentials in error messages and logs.
- **REST API Routes (`services/admin-api/src/routes/`):**
  - Secrets Vault management (`GET /v1/secrets/status`, `POST /v1/secrets/:name`,
    `DELETE /v1/secrets/:name`).
  - Apps CRUD management (`GET /v1/apps`, `POST /v1/apps`, `PUT /v1/apps/:id`,
    `DELETE /v1/apps/:id`).
  - Campaigns CRUD management (`GET /v1/campaigns`, `POST /v1/campaigns`,
    `PATCH /v1/campaigns/:id/status`, `DELETE /v1/campaigns/:id`).
  - Feature Flags management (`GET /v1/flags`, `POST /v1/flags`, `PATCH /v1/flags/:id/toggle`,
    `DELETE /v1/flags/:id`).
  - Audit Logs query endpoint (`GET /v1/audit-logs`).
- **Dashboard Key Vault UI Integration:**
  - `apps/dashboard/src/services/secretsService.ts`: Client service for `/api/admin/v1/secrets` with
    offline fallback.
  - `apps/dashboard/src/components/modals/SecretModal.tsx`: Secure write-only credential rotation
    modal with password reveal toggle and security reminders.
  - `apps/dashboard/src/pages/SettingsPage.tsx`: Dedicated "Secret Manager Vault (Write-Only)" tab
    with credential status table, version tracking, and modal integration.

### Tests & Validation

- 16 new automated integration tests in `services/admin-api/src/tests/api.test.ts` covering RBAC
  gates, vault zero-leakage, health probes, and CRUD endpoints.
- Full monorepo validation: 15/15 Turbo tasks passing.
- 20/20 Firestore security rules tests passing on local emulator.
- Clean build across all 10 monorepo packages.

---

## [0.4.0] — Phase 3: Core Dashboard Features — 2026-09-30

### Added

- **Live Firestore Client & Resilience Architecture (`apps/dashboard/src/lib/firestore.ts`):**
  - Firestore and Storage client setup with emulator auto-discovery.
  - Zero-lag in-memory fallback strategy (`isOfflineMode`) ensuring complete test and development
    resilience without network blocking.
- **Core Dashboard Services (`apps/dashboard/src/services/`):**
  - `appsService`: App registration, update, delete/archive, and real-time subscription
    (`subscribeApps`) using Zod schemas (`CreateAppSchema`, `UpdateAppSchema`).
  - `campaignsService`: Promotion campaign CRUD, real-time subscription (`subscribeCampaigns`), and
    status toggles (`published`, `paused`, `draft`) with frequency capping.
  - `featureFlagsService`: Remote config flag upsert, boolean quick toggling, and real-time
    subscription (`subscribeFeatureFlags`) using `UpsertFeatureFlagSchema`.
  - `auditService`: Immutable audit event recording (`recordAuditLog`) and real-time feed
    (`subscribeAuditLogs`) tracking administrative actions across apps, campaigns, and flags.
- **Interactive Device Preview Component (`apps/dashboard/src/components/DevicePreview.tsx`):**
  - Realistic smartphone bezel with dynamic island / notch, status bar, and home indicator.
  - Placement rendering modes:
    - `banner`: Top or bottom docked banner with app icon, headline, body copy, and CTA button.
    - `interstitial`: Fullscreen takeover overlay with background artwork, close button, and CTA
      bar.
    - `native`: In-feed sponsored card blending seamlessly with mock content feeds.
- **Production Modals (`apps/dashboard/src/components/modals/`):**
  - `AppModal`: App registration and configuration with platform selection, package ID validation,
    versioning, store URLs, and modular SDK checkboxes.
  - `CampaignModal`: 2-column campaign builder featuring live interactive `DevicePreview` updating
    in real time as creative fields (title, description, CTA, image URL, layout) change.
  - `FeatureFlagModal`: Remote flag creator supporting boolean, string, and numeric types with
    global, per-app, and per-environment scopes.
- **Page Data Wiring:**
  - `AppsPage`: Real-time subscription to registered apps, search by name/package ID, platform
    filtering, add/edit modal integration, and delete confirmation.
  - `PromotionsPage`: Real-time subscription to campaigns, status filtering, one-click Publish/Pause
    toggles, standalone full-screen mobile preview modal, and CampaignModal integration.
  - `ConfigPage`: Real-time subscription to feature flags, quick-toggle boolean switches, dual-layer
    Firestore + Remote Config explanation, and FeatureFlagModal integration.
  - `OverviewPage`: Dynamic KPI metrics driven by live app counts, active campaign counts, and
    feature flag counts.
  - `AuditLogsPage`: Real-time admin audit stream with action categorization and actor/resource
    search filtering.

### Tests & Validation

- 3 new unit tests in `DevicePreview.test.tsx` verifying banner, interstitial, and native rendering
  in SSR.
- 7 new service tests in `services.test.ts` verifying CRUD operations, Zod validation rejections,
  and audit event emission.
- All 15 monorepo test suites passing (`pnpm test`): 12 dashboard tests, 13 UI tests, 16
  infrastructure tests.
- 20 live Firestore security rules tests passing on Firestore emulator (`pnpm test:rules`).
- Entire monorepo builds cleanly with zero TypeScript errors (`pnpm build`).
- Prettier code style validated cleanly (`pnpm format:check`).

---

## [0.3.0] — Phase 2: Dashboard Shell — 2026-09-30

### Added

- `@wapcentral/ui` component library:
  - Accessible, customizable components: `Button`, `Card`, `Badge`, `Spinner`, `StatusIndicator`,
    `EmptyState`, `ErrorState`, `Modal`, `Table`, `PageHeader`
  - Utility styling helper `cn` combining conditional classes
  - Full unit test suite with 13 component tests
- `@wapcentral/dashboard` application:
  - React 18 + Vite 5 + TypeScript + Tailwind CSS setup
  - Responsive layout shell: `DashboardLayout`, `Sidebar`, and `Header`
  - Sidebar navigation across all 10 core sections: Overview, Apps, AI Gateway, Ad Networks,
    Promotions, Feature Flags, Infrastructure, Analytics, Audit Logs, Settings
  - Theme management: `ThemeProvider` supporting light, dark, and system preference with
    localStorage persistence
  - Authentication: `AuthProvider` integrating Firebase Auth, role resolution, and quick demo role
    switcher for local testing
  - Route Guards: `AuthGuard` (session authentication check) and `RoleGuard` (RBAC level
    authorization gate)
  - All 10 section pages with standard states (content, loading spinner, empty placeholder, error
    alert, permission-denied preview)
  - Public authentication page (`LoginPage`), 403 Forbidden page (`UnauthorizedPage`), and 404 page
    (`NotFoundPage`)
  - Full production Vite build bundling cleanly into `apps/dashboard/dist`
  - Guards unit test suite

### Security

- Protected routing architecture ensures unauthenticated users are redirected to `/login`
- RoleGuard enforces least-privilege RBAC on sensitive views (e.g. Audit Logs requiring `admin`
  level)
- Demo testing roles strictly isolated to client memory/sessionStorage and bypassable in production

### Tests

- 13 component unit tests passed in `@wapcentral/ui`
- 2 route/role guard integration tests passed in `@wapcentral/dashboard`
- All 15 package & service tasks passed in monorepo test runner (`pnpm test`)
- 16 infrastructure tests passed
- 20 live Firestore security rules tests passed against emulator (`pnpm test:rules`)
- Full production bundle build passed for all 10 monorepo packages (`pnpm build`)

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
