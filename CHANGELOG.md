# Changelog — WAPCentral

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Phase 1: Firebase Foundation
- Firebase projects (dev/staging/prod) setup
- Firestore security rules
- Firebase Storage rules
- Firebase Authentication configuration
- Firebase Hosting configuration
- Firebase Emulator Suite local config

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
