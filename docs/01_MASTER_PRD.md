# Master PRD — WebAppyPie Central

## Vision
One secure control plane for all current and future WebAppyPie apps, games, launchers and AI products.

## Core Modules
1. **Overview Dashboard** — KPI cards, charts, health summary
2. **Apps Registry** — register and manage all owned apps
3. **Firebase/Environment Registry** — per-app Firebase project references and env configs
4. **AI Providers** — provider registry, model allowlist, enable/disable, health
5. **AI Gateway Policies** — routing, fallback, quotas, rate limits, kill switches
6. **AI Usage & Cost** — usage events, daily aggregation, cost estimates, alerts
7. **Ads Manager** — ad network configs for AdMob, Meta, AppLovin MAX, WAPAds
8. **Self-Promotion Campaigns** — create/manage/deliver cross-promotion campaigns
9. **Creative/Banner Manager** — upload, preview, manage campaign assets
10. **Remote Configuration** — feature flags, maintenance mode, emergency switches
11. **Infrastructure Health** — heartbeat, latency, error rates, provider health
12. **Analytics** — usage/cost charts, promotion impressions/clicks, CTR
13. **Audit Logs** — append-only admin action log
14. **Settings/Roles** — RBAC, user management, MFA enforcement

## Apps Registry
Store: app name, package/bundle ID, platform (Android/iOS), version, environment (dev/staging/prod), store links, Firebase project reference, enabled modules, ad config, status.

## AI Providers
Support: OpenAI, Gemini, Anthropic, and self-hosted/open-source models via a provider abstraction interface.
Controls: enable/disable, model allowlist, routing priority, fallback chain, quotas, rate limits, health checks.
Secrets: backend-only in Google Cloud Secret Manager.

## AI Gateway
```
Mobile App → authenticated gateway → policy/router → provider → normalized response
```
Controls: Firebase Auth, rate limits, quotas, model routing, timeout, retries, safe caching, usage accounting, estimated cost, fallback, emergency kill switch.

## Ads Networks
| Network | Role | Notes |
|---|---|---|
| Google AdMob | Primary ad network | AdUnit IDs in Firestore; private creds in Secret Manager |
| Meta Audience Network | Secondary ad network | Placement IDs in Firestore; private creds in Secret Manager |
| AppLovin MAX | Mediation layer | Wraps AdMob + Meta + others; config in Firestore |
| WAPAds | Proprietary cross-promo | Delivered via promotion-api + campaigns system |

Dashboard manages ad configuration metadata. Actual ad rendering is done by native SDKs in Flutter apps.

## Self-Promotion (WAPAds)
Create campaigns to promote owned apps within other owned apps.

Campaign fields:
- campaign name, promoted app, target app(s)
- title, description, CTA text, store URL
- image URL, animation/Lottie URL
- layout variant (banner / interstitial / native)
- schedule (start/end), priority, enabled flag
- frequency cap, targeting rules
- analytics (impressions, clicks, CTR)

## Mobile SDK Packages
### wap_promo_sdk (Flutter)
- Own-app promotion display
- Campaign/config delivery from promotion-api
- Local caching (cache-first, non-blocking)
- Background refresh with timeout
- Frequency capping
- Banner/creative rendering configuration
- Analytics event dispatch (fire-and-forget)

### wap_ads_sdk (Flutter)
- Google AdMob integration
- Meta Audience Network integration
- AppLovin MAX mediation integration
- WAPAds integration hook
- Fully decoupled from wap_promo_sdk
- Platform-agnostic API contracts for future native Android/iOS support

## Promotion Reliability (Non-Negotiable)
App starts normally from local state. Promotion config refreshes in background.
Use cache → safe default → hide if service is slow or unavailable. Never block startup.

## Feature Flags (Dual-Layer)
| Layer | System | Scope |
|---|---|---|
| Primary | Firestore `featureFlags` | Admin-managed, detailed configuration, all platforms |
| Mobile runtime | Firebase Remote Config | Lightweight, fast delivery to mobile, safe defaults |

- Firestore is the source of truth for all admin-managed configuration
- Remote Config delivers a subset of flags to mobile with automatic safe defaults
- Do NOT duplicate all flags in both systems
- Documented precedence: Remote Config → promotion-api response → hardcoded safe default

## Remote Configuration
Feature flags, promotion enable/disable, AI enable/disable, routing, cache TTL, timeout values, maintenance mode, minimum app version, emergency kill switches.

## Promotion API Authentication
- Light app-key authentication (identifies the calling app, not a security secret)
- Rate limiting per app-key (abuse protection mandatory)
- Sensitive operations remain server-side only
- App keys are registered in Firestore and not treated as passwords

## Cost Monitoring
Track: provider, model, app, request count, tokens (where available), estimated cost, daily/monthly totals, quota usage, errors. Clearly label all cost values as estimates.

## Security
- MFA for privileged admin users
- RBAC with four roles: viewer / editor / admin / super-admin
- Least privilege service accounts
- Google Cloud Secret Manager for all private credentials
- Firestore security rules (no client access to private data)
- HTTPS everywhere
- Credential rotation procedures
- Separate dev/staging/prod credentials
- Audit logs for all admin actions
- No secret logging

## UX
Premium technical admin UI, responsive desktop-first, light/dark mode, searchable/paginated tables, charts, filters, confirmations, toast notifications, loading/empty/error/offline/permission-denied states, accessibility.

## V1 Success Criteria
- [ ] Admin login works with MFA
- [ ] Apps can be registered and managed
- [ ] All secrets remain server-side (never exposed to client)
- [ ] AI provider policies work (routing, fallback, kill switch)
- [ ] AI usage and estimated cost are visible in dashboard
- [ ] Campaigns can be created, previewed, and published
- [ ] App-facing promotion delivery is cache-first and non-blocking
- [ ] wap_promo_sdk and wap_ads_sdk packages installable in Flutter apps
- [ ] Feature flags and kill switches work
- [ ] Audit logs capture all admin actions
- [ ] Production deployment passes failure tests (offline, slow API, malformed response)
