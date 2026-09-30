# Setup & Credentials Checklist — WAPCentral

**Do NOT store real secret values in this file.**
Use this as a checklist before starting each environment setup.

---

## Accounts Required

- [ ] Google/Firebase/Google Cloud account (with billing-capable payment method)
- [ ] GitHub account or GitHub Organization (`WebAppyPie`)
- [ ] OpenAI API account (for AI provider)
- [ ] Google Gemini API access (AI Studio or Vertex AI)
- [ ] Anthropic API account (if using Claude)
- [ ] Google AdMob account
- [ ] Meta Audience Network account
- [ ] AppLovin MAX account
- [ ] Custom domain / DNS provider (e.g. `central.webappypie.com`)
- [ ] Google Play Console account (for mobile app management)
- [ ] Apple Developer account (future iOS support)
- [ ] Canva Pro (for creative assets)

---

## Developer Tools Required

- [ ] Git ≥ 2.40
- [ ] Node.js ≥ 18 (use `.nvmrc` in repo)
- [ ] pnpm ≥ 9 (monorepo package manager)
- [ ] VS Code with extensions: ESLint, Prettier, TypeScript, Tailwind IntelliSense
- [ ] Android Studio (for Flutter mobile development)
- [ ] JDK 17+ (required by Android/Flutter)
- [ ] Flutter SDK ≥ 3.x
- [ ] Dart SDK (bundled with Flutter)
- [ ] Python 3.x (for utility scripts)
- [ ] Firebase CLI (`npm install -g firebase-tools`) + authenticated
- [ ] Google Cloud CLI (`gcloud`) + authenticated
- [ ] GitHub CLI (`gh`) + authenticated

---

## Firebase Projects (3 Required)

| Project | Project ID (example) | Purpose |
|---|---|---|
| Development | `wapcentral-dev` | Local dev and testing |
| Staging | `wapcentral-staging` | Pre-production validation |
| Production | `wapcentral-prod` | Live traffic |

Each project must have:
- [ ] Firebase Authentication enabled (Email/Password + Google)
- [ ] Firestore database created (in production mode)
- [ ] Firebase Storage bucket configured
- [ ] Firebase Hosting configured
- [ ] Firebase Remote Config enabled
- [ ] Firebase Analytics enabled (mobile apps)
- [ ] Firebase Crashlytics enabled (mobile apps)
- [ ] GCP billing enabled (required for Secret Manager, Cloud Run)

---

## Google Cloud Secret Manager
(One Secret Manager instance per GCP project/environment)

Secrets to create in each environment:
- [ ] `OPENAI_API_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `ADMOB_REPORTING_CREDENTIALS`
- [ ] `META_AAN_CREDENTIALS`
- [ ] `APPLOVIN_API_KEY`
- [ ] `PROMOTION_SIGNING_SECRET`
- [ ] `WEBHOOK_SECRETS`
- [ ] `SELF_HOSTED_AI_CREDENTIALS` (if using self-hosted models)

---

## CI/CD (GitHub Actions)

- [ ] GitHub repository created
- [ ] Firebase service account added to GitHub Secrets (per environment)
- [ ] Google Cloud service account with minimal permissions added to GitHub Secrets
- [ ] `FIREBASE_TOKEN` or Workload Identity Federation configured
- [ ] Branch protection rules: require PR + CI pass for `main` and `staging`

---

## Cost Controls

- [ ] Google Cloud billing alerts configured (per-environment thresholds)
- [ ] OpenAI usage limits set in OpenAI dashboard
- [ ] Gemini/Vertex AI quotas configured
- [ ] WAPCentral AI gateway per-app quotas configured
- [ ] Per-app monthly budget caps in WAPCentral dashboard
- [ ] Emergency AI kill switches tested
- [ ] Monthly cost review scheduled

---

## Ad Networks Configuration

### Google AdMob
- [ ] AdMob account created and verified
- [ ] Android App registered in AdMob
- [ ] iOS App registered in AdMob (future)
- [ ] Ad units created (banner, interstitial, rewarded, native)
- [ ] AdMob App IDs noted for Firestore config

### Meta Audience Network
- [ ] Meta Business account with AAN access
- [ ] App registered in Meta Business Manager
- [ ] Placement IDs created
- [ ] Private credentials stored in Secret Manager

### AppLovin MAX
- [ ] AppLovin account created
- [ ] MAX SDK configured
- [ ] Mediation adapters configured (AdMob + Meta + others)
- [ ] AppLovin API key stored in Secret Manager

---

## Mobile SDK Checklist (wap_promo_sdk + wap_ads_sdk)

- [ ] `wap_promo_sdk` Flutter package initialized
- [ ] `wap_ads_sdk` Flutter package initialized
- [ ] Both packages published to internal private pub.dev or bundled as path dependencies
- [ ] Platform-agnostic API contract documented
- [ ] Integration guide written (README per SDK)
- [ ] Cache storage tested on Android
- [ ] Background refresh tested on Android
- [ ] Frequency capping tested

---

## Promotion System Checklist

- [ ] Campaign schema defined and documented
- [ ] Creative storage bucket configured in Firebase Storage
- [ ] Public delivery endpoint deployed (`promotion-api`)
- [ ] App-key authentication implemented and tested
- [ ] HMAC signing tested
- [ ] Local cache validated (cold start + refresh scenarios)
- [ ] TTL enforcement tested
- [ ] Timeout/fallback tested
- [ ] Impression/click tracking tested
- [ ] Rate limiting tested

---

## Feature Flags Checklist

- [ ] Firestore `featureFlags` collection schema documented
- [ ] Firebase Remote Config initialized per environment
- [ ] Precedence model documented (Remote Config → promotion-api → safe default)
- [ ] Admin UI for flag management built (Phase 2+)
- [ ] Mobile SDK reads flags non-blocking
