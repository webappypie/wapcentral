# Development Phases — WAPCentral

## Phase Contract (All Phases)
```
READ DOCS → PLAN → IMPLEMENT → TEST → FIX → REVIEW → UPDATE DOCS → GIT COMMIT → GIT PUSH → STOP
```
**No phase starts automatically. Each phase requires explicit authorization.**

---

## Phase 0 — Repository & Documentation
**Objective:** Establish the monorepo foundation, tooling, CI, and finalized documentation.

Deliverables:
- Git repository initialized in `WAPCentral/`
- Monorepo structure: pnpm workspaces + Turborepo
- All package stubs created (apps/, services/, packages/, sdks/)
- ESLint + Prettier + TypeScript base configs
- Vitest test runner configured
- GitHub Actions CI: lint, format, test, build, secret scan
- `.gitignore`, `.env.example`, `.nvmrc`
- All documentation updated with approved architectural decisions
- Git commit + push

**Test:** `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build` all pass.

---

## Phase 1 — Firebase Foundation
**Objective:** Create 3 Firebase environments, configure all Firebase services, and write Firestore security rules.

Deliverables:
- Firebase projects: `wapcentral-dev`, `wapcentral-staging`, `wapcentral-prod`
- Firebase Authentication configured (email/password + Google)
- Firestore database created with initial security rules
- Firebase Storage configured with security rules
- Firebase Hosting configured
- Firebase Remote Config initialized
- Service account keys stored in Secret Manager (not in repo)
- `infrastructure/firebase/` configs for each environment

**Test:** Rules tested with Firebase Emulator Suite.

---

## Phase 2 — Dashboard Shell
**Objective:** Build the React admin dashboard shell with authentication, routing, layout, and base component system.

Deliverables:
- `apps/dashboard/` React + TypeScript + Vite project
- Tailwind CSS + accessible component library setup
- React Router layout with sidebar navigation (10 sections)
- Firebase Auth integration + auth guard
- Light/dark mode theme system
- Reusable components: Button, Card, Table, Badge, Toast, Modal, Spinner, EmptyState, ErrorState
- All 10 sidebar sections with placeholder pages
- Every page has loading/empty/error/permission-denied states

**Test:** Unit tests for components, auth guard integration test.

---

## Phase 3 — App Registry
**Objective:** Full CRUD for the app registry — create, read, update, archive apps with metadata and environment references.

Deliverables:
- App list table with search, filter, pagination
- App creation/edit form (name, package ID, platform, version, env, store links, Firebase ref)
- App detail view with tabs (Overview, Config, AI, Ads, Promotion, Analytics, Health)
- Firestore `apps` and `environments` collections wired
- RBAC permission checks on all operations
- Audit log entry on create/update/archive

**Test:** CRUD flows, permission tests, audit log verification.

---

## Phase 4 — Secure Backend
**Objective:** Deploy admin-api with Secret Manager integration, RBAC enforcement, and audit logging.

Deliverables:
- `services/admin-api/` Node.js service (Cloud Run)
- Secret Manager integration (write-only credential management)
- RBAC middleware (viewer/editor/admin/super-admin)
- Audit log middleware (every mutating operation logged)
- Health check endpoint
- Local development setup with Firebase Emulator

**Test:** RBAC tests, secret write/read test, audit log tests, health check.

---

## Phase 5 — AI Provider Management
**Objective:** Provider registry, model allowlist, routing policies, quota configuration, and health check system.

Deliverables:
- `packages/provider-sdk/` with IProvider interface + OpenAI, Gemini, Anthropic, Self-hosted implementations
- AI provider list UI with status cards
- Provider create/edit/disable form (write-only secret input)
- Model allowlist management
- Policy editor (routing priority, fallback chain, quotas, rate limits)
- Provider health check (connection test from backend)

**Test:** Provider interface unit tests, policy enforcement tests, mock provider integration tests.

---

## Phase 6 — AI Gateway & Usage
**Objective:** Deploy ai-gateway service with full routing, quota enforcement, usage recording, and cost estimation.

Deliverables:
- `services/ai-gateway/` service (Cloud Run)
- Request authentication (Firebase Auth token)
- Quota + rate limit enforcement
- Model routing + fallback logic
- `usageEvents` Firestore writes (async, non-blocking)
- `usageDaily` aggregation via usage-worker
- Cost estimation (clearly labeled as estimates)
- Emergency kill switch (per provider + global)

**Test:** Gateway routing tests, quota enforcement tests, kill switch tests, fallback tests.

---

## Phase 7 — Promotion System
**Objective:** Full campaign lifecycle, creative asset management, promotion-api delivery endpoint, and analytics.

Deliverables:
- `services/promotion-api/` service (Cloud Run)
- App-key authentication + rate limiting + abuse protection
- HMAC payload signing (`PROMOTION_SIGNING_SECRET`)
- Campaign CRUD UI (draft → preview → published → paused → ended)
- Creative/banner upload to Firebase Storage
- Campaign editor with live banner preview
- Delivery endpoint: `GET /v1/promotion?appId=X`
- Impression/click analytics tracking
- Cache-control headers (cacheTtlSeconds)

**Test:** Delivery endpoint tests, HMAC validation tests, cache behavior tests, campaign lifecycle tests.

---

## Phase 8 — Mobile Promotion Module (wap_promo_sdk)
**Objective:** Flutter SDK that delivers non-blocking, cache-first promotion display.

Deliverables:
- `sdks/wap_promo_sdk/` Flutter package
- PromoCache (SharedPreferences, local persistence)
- PromoService (boot from cache, background refresh, HMAC validation)
- PromoWidget (banner, interstitial, native variants — all graceful fallback)
- Frequency capping implementation
- Analytics event dispatch (fire-and-forget)
- Platform-agnostic API contract (HTTP/JSON — no Flutter-specific backend coupling)
- README with integration guide

**Test:** Cache-first startup test, network failure test, HMAC validation test, frequency cap test.

---

## Phase 9 — Ads Management (wap_ads_sdk)
**Objective:** Dashboard configuration for all ad networks + Flutter ads SDK wrapper.

Deliverables:
- `sdks/wap_ads_sdk/` Flutter package
- AdMob integration (banner, interstitial, rewarded, native)
- Meta Audience Network integration
- AppLovin MAX mediation integration
- WAPAds integration hook (delegates to wap_promo_sdk)
- Dashboard: ad provider registry, per-app ad unit config
- Reporting integration stubs (where Ad APIs allow)
- Fully decoupled from wap_promo_sdk

**Test:** SDK unit tests, ad unit config delivery tests, mediation priority tests.

---

## Phase 10 — Analytics & Cost
**Objective:** Usage/cost dashboards, app/provider breakdowns, cost alerts, and data retention.

Deliverables:
- AI usage charts (by provider, by app, by feature, by day/month)
- Cost estimation dashboard (clearly labeled as estimates)
- Promotion analytics (impressions, clicks, CTR by campaign)
- Configurable cost alerts and quota alerts
- Data retention policy (configurable TTL on usageEvents)

**Test:** Aggregation accuracy tests, alert trigger tests.

---

## Phase 11 — Infrastructure Health
**Objective:** Heartbeat monitoring, latency/error tracking, AI provider health, and alerting.

Deliverables:
- health-worker scheduled heartbeat checks
- Provider health status cards with latency
- Error rate tracking per service/provider
- AI server metric collection (self-hosted)
- Alert system (configurable thresholds)

**Test:** Health check tests, failure detection tests, alert tests.

---

## Phase 12 — Security Hardening
**Objective:** Comprehensive security review, penetration testing, and remediation.

Deliverables:
- Firestore security rules audit + penetration test
- Secret exposure audit (no keys in client code, logs, or git history)
- RBAC coverage audit
- Dependency vulnerability scan
- Security test suite
- Remediation of all findings

**Test:** Full security test suite must pass with zero critical issues.

---

## Phase 13 — Production Release
**Objective:** Production deployment, domain setup, monitoring, backup, rollback, and release documentation.

Deliverables:
- Production Firebase project fully configured
- Custom domain for dashboard (e.g. `central.webappypie.com`)
- Full production deployment pipeline (GitHub Actions)
- Uptime monitoring
- Automated backup strategy for Firestore
- Rollback procedures documented
- Release documentation and runbook

**Test:** Full production smoke test + failure injection tests.

---

## Notes
- No phase starts automatically
- Each phase ends with: commit, push, stop
- Phase completion report includes: implemented, tests, security notes, docs updated, git hash, push result, known limitations, next phase name (NOT STARTED)
