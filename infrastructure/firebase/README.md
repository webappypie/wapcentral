# Firebase Foundation — WebAppyPie Central (WAPCentral)

This directory contains the production-grade Firebase architecture, configurations, security rules,
indexes, and environment specifications for WAPCentral.

---

## Directory Structure

```text
infrastructure/firebase/
├── environments/
│   ├── dev.json                  # Development environment specification
│   ├── staging.json              # Staging environment specification
│   └── prod.json                 # Production environment specification
├── .firebaserc.example           # Project alias template (dev/staging/prod)
├── firebase.json                 # Firebase CLI service configuration
├── firestore.rules               # Production RBAC security rules (13 collections)
├── firestore.indexes.json        # Composite indexes for queries
├── storage.rules                 # Storage security rules (campaign creatives)
├── remoteconfig.template.json    # Mobile runtime feature flags template
└── README.md                     # This documentation
```

---

## 1. Environments Overview

WAPCentral operates across three completely isolated Firebase projects:

| Environment     | Project ID           | Purpose                                       | Access URL                               |
| --------------- | -------------------- | --------------------------------------------- | ---------------------------------------- |
| **Development** | `wapcentral-dev`     | Local development, emulator testing, CI tests | `http://localhost:3000`                  |
| **Staging**     | `wapcentral-staging` | Pre-production validation & QA                | `https://staging.central.webappypie.com` |
| **Production**  | `wapcentral-prod`    | Live production control plane                 | `https://central.webappypie.com`         |

---

## 2. Security Rules & RBAC Matrix

### Role-Based Access Control (RBAC)

User roles are assigned either via Firebase Auth **Custom Claims** (`token.role`) or stored in the
`/roles/{userId}` Firestore collection:

| Role          | Hierarchy | Capabilities                                                                                                        |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `viewer`      | Level 1   | Read-only access to apps, campaigns, feature flags, health status, and aggregated usage metrics.                    |
| `editor`      | Level 2   | All `viewer` permissions + create/update apps, campaigns, upload campaign assets, and toggle feature flags.         |
| `admin`       | Level 3   | All `editor` permissions + manage AI providers, models, policies, delete resources, view raw events and audit logs. |
| `super_admin` | Level 4   | All `admin` permissions + manage RBAC role assignments and delete providers/critical infrastructure.                |

### Firestore Collections Security Matrix

| Collection                  | Read Permission           | Write Permission                                 | Notes                                |
| --------------------------- | ------------------------- | ------------------------------------------------ | ------------------------------------ |
| `/roles/{userId}`           | Own role or `super_admin` | `super_admin` only                               | Controls RBAC permissions            |
| `/apps/{appId}`             | `viewer`+                 | `editor`+ (create/update), `admin`+ (delete)     | Protected against raw secrets        |
| `/environments/{envId}`     | `viewer`+                 | `admin`+                                         | Environment configurations           |
| `/providers/{providerId}`   | `viewer`+                 | `admin`+ (create/update), `super_admin` (delete) | Metadata only; secrets in Secret Mgr |
| `/models/{modelId}`         | `viewer`+                 | `admin`+                                         | Model allowlists and costs           |
| `/aiPolicies/{policyId}`    | `viewer`+                 | `admin`+                                         | Routing and quota policies           |
| `/campaigns/{campaignId}`   | `viewer`+                 | `editor`+ (create/update), `admin`+ (delete)     | House ad campaigns                   |
| `/campaignAssets/{assetId}` | `viewer`+                 | `editor`+ (create/update), `admin`+ (delete)     | Asset metadata                       |
| `/featureFlags/{flagId}`    | `viewer`+                 | `editor`+ (create/update), `admin`+ (delete)     | Dashboard primary flags              |
| `/usageDaily/{dailyId}`     | `viewer`+                 | **FORBIDDEN (false)**                            | Backend `usage-worker` only          |
| `/usageEvents/{eventId}`    | `admin`+                  | **FORBIDDEN (false)**                            | Backend `ai-gateway` only            |
| `/healthChecks/{checkId}`   | `viewer`+                 | **FORBIDDEN (false)**                            | Backend `health-worker` only         |
| `/auditLogs/{logId}`        | `admin`+                  | **FORBIDDEN (false)**                            | Immutable backend logging only       |

> 🔒 **Security Guarantee**: Collections containing raw operational data (`usageDaily`,
> `usageEvents`, `healthChecks`, `auditLogs`) cannot be written to by any client SDK, even with
> admin privileges. Only the backend Admin SDK (Cloud Functions / Cloud Run) can write to them.

---

## 3. Storage Rules

Campaign creatives are served from Firebase Storage under
`campaign-assets/{campaignId}/{assetName}`:

- **Read**: Public (`allow read: if true;`) to enable non-blocking CDN delivery to mobile apps
  (`wap_promo_sdk`).
- **Write**: Restricted to authenticated staff with `editor` role or above.
- **Constraints**: Enforces MIME types (`image/png`, `image/jpeg`, `image/webp`, `image/gif`,
  `application/json` for Lottie) and a 5 MB maximum file size.

---

## 4. Remote Config Template

Firebase Remote Config provides the mobile runtime layer for the dual-layer feature flags
architecture:

- `promotion_enabled`: Boolean (default `true`)
- `ai_enabled`: Boolean (default `true`)
- `ads_enabled`: Boolean (default `true`)
- `min_app_version`: String (default `"1.0.0"`)
- `maintenance_mode`: Boolean (default `false`)
- `cache_ttl_seconds`: Number (default `21600` / 6 hours)
- `request_timeout_ms`: Number (default `5000` / 5 seconds)
- `emergency_ai_kill_switch`: Boolean (default `false`)

---

## 5. Local Development with Firebase Emulator

To start the local emulator suite:

```bash
# 1. Copy project aliases template
cp .firebaserc.example .firebaserc

# 2. Start emulators from repository root
pnpm firebase emulators:start
```

Emulators will bind to:

- Auth: `http://127.0.0.1:9099`
- Firestore: `http://127.0.0.1:8080`
- Storage: `http://127.0.0.1:9199`
- Hosting: `http://127.0.0.1:5000`
- Emulator UI: `http://127.0.0.1:4000`

---

## 6. Deployment Commands

```bash
# Select environment
firebase use development # or staging, production

# Deploy security rules and indexes only
firebase deploy --only firestore:rules,firestore:indexes,storage

# Deploy Remote Config template
firebase remoteconfig:set infrastructure/firebase/remoteconfig.template.json

# Deploy Hosting (after apps/dashboard build)
pnpm build
firebase deploy --only hosting
```
