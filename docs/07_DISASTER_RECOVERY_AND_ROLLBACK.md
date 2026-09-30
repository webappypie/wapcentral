# 07 — Disaster Recovery & Rollback Runbook

**WAPCentral — Production Infrastructure & Reliability Engineering**  
**Phase:** Phase 13 — Production Release  
**Status:** Active Production Runbook  
**Last Updated:** 2026-09-30

---

## 1. Executive Summary & Recovery Objectives

This document establishes the operational procedures for mitigating incidents, executing emergency
rollbacks, and restoring data across all tiers of WAPCentral.

| Metric                             | Stateless Services (Cloud Run) | Web Hosting (Firebase) | Database (Firestore)  | Feature Flags (Remote Config) |
| ---------------------------------- | ------------------------------ | ---------------------- | --------------------- | ----------------------------- |
| **Recovery Time Objective (RTO)**  | **< 60 seconds**               | **< 30 seconds**       | **< 30 minutes**      | **< 10 seconds**              |
| **Recovery Point Objective (RPO)** | **0 (Zero)**                   | **0 (Zero)**           | **< 1 minute (PITR)** | **0 (Zero)**                  |

---

## 2. Incident Classification & Severity Levels

| Severity             | Definition                                                                 | Target Response | Escalation Path                         |
| -------------------- | -------------------------------------------------------------------------- | --------------- | --------------------------------------- |
| **SEV-1 (Critical)** | Promotion API down, AI Gateway offline, data corruption, security breach   | < 5 minutes     | On-Call Lead, Security Lead, CTO        |
| **SEV-2 (Major)**    | Single AI provider degraded, Admin Dashboard latency > 3s, analytics delay | < 15 minutes    | Service Owners, Infrastructure Engineer |
| **SEV-3 (Minor)**    | Non-critical UI glitch, worker task retry delay                            | < 2 hours       | Regular Engineering Queue               |

---

## 3. Rollback Procedures

### 3.1 Cloud Run Microservices (< 60 Seconds)

Every deployment to Cloud Run creates an immutable, tagged revision. Reverting to a previous healthy
revision does not require rebuilding container images and takes effect instantaneously.

#### Step 1: List Revisions to Identify Last Known Healthy Revision

```bash
# Example for admin-api, promotion-api, ai-gateway, or workers
gcloud run revisions list \
  --service=promotion-api \
  --region=us-central1 \
  --project=wapcentral-prod \
  --format="table(name,active,traffic_percent,creation_timestamp)"
```

#### Step 2: Instant 100% Traffic Shift to Healthy Revision

```bash
gcloud run services update-traffic promotion-api \
  --to-revisions=promotion-api-00042-xyz=100 \
  --region=us-central1 \
  --project=wapcentral-prod
```

#### Step 3: Validate Revision Health

```bash
curl -I https://promo.central.webappypie.com/v1/health
# Expected: HTTP/2 200 OK
```

---

### 3.2 Firebase Hosting (Admin Dashboard) (< 30 Seconds)

Firebase Hosting preserves the last 50 deploy releases.

#### Option A: Rollback via Firebase CLI

```bash
# List previous release versions
firebase hosting:clone wapcentral-prod:live wapcentral-prod:<PREVIOUS_VERSION_ID> \
  --project=wapcentral-prod
```

#### Option B: Rollback via Firebase Console

1. Navigate to **Firebase Console** → `wapcentral-prod` → **Hosting**.
2. Under **Release History**, locate the last healthy release.
3. Click the three dots `...` → **Rollback**.

---

### 3.3 Remote Config & Dual-Layer Feature Flags (< 10 Seconds)

If a bad configuration or faulty provider prompt causes system degradation, use the runtime kill
switch:

```bash
# Rollback Remote Config template to previous version
firebase remoteconfig:rollback \
  --version=<VERSION_NUMBER> \
  --project=wapcentral-prod
```

Or toggle emergency circuit-breaker parameters in the Firebase Console:

- `killswitch_all_promotions`: Set to `true` to immediately halt promotion delivery and return
  graceful default payloads.
- `ai_provider_primary`: Shift from degraded provider (e.g. `openai`) to fallback provider (`gemini`
  or `anthropic`).

---

### 3.4 Firestore Database Restoration

WAPCentral implements dual protection: **Point-In-Time Recovery (PITR)** (7-day retention with
continuous window) and **Daily Automated Backups** in Cloud Storage (30-day Nearline, 90-day
Coldline).

#### Scenario A: Point-in-Time Recovery (PITR) (< 15 Minutes)

Restores the database to any exact second within the last 7 days:

```bash
# Restore default database to state at 14:32:00 UTC
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='(default)' \
  --recovery-time='2026-09-30T14:32:00Z' \
  --project=wapcentral-prod
```

#### Scenario B: Cold Backup Import from Cloud Storage (< 30 Minutes)

To restore from daily Cloud Storage snapshots:

```bash
# 1. Identify backup timestamp
gsutil ls -l gs://wapcentral-firestore-backups-prod/exports/

# 2. Import all collections from backup snapshot
gcloud firestore import gs://wapcentral-firestore-backups-prod/exports/20260930_020000Z/ \
  --project=wapcentral-prod

# 3. Or import specific corrupted collection (e.g., campaigns)
gcloud firestore import gs://wapcentral-firestore-backups-prod/exports/20260930_020000Z/ \
  --collection-ids=campaigns \
  --project=wapcentral-prod
```

---

## 4. Emergency Secret Compromise & Key Rotation

If an external API key (OpenAI, Gemini, Anthropic) or signing secret is exposed:

1. **Rotate Secret in Google Secret Manager:**

   ```bash
   echo -n "sk-new-super-secure-key" | gcloud secrets versions add OPENAI_API_KEY \
     --data-file=- \
     --project=wapcentral-prod
   ```

2. **Force Cloud Run Services to Pick Up New Secret Version:**

   ```bash
   # Re-deploying configuration causes containers to restart with latest secret
   gcloud run services update ai-gateway \
     --update-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest \
     --region=us-central1 \
     --project=wapcentral-prod
   ```

3. **Revoke Old Key at Provider:** Immediately log into OpenAI/Anthropic/Google AI Studio and revoke
   the compromised key.

---

## 5. Post-Incident Review (PIR) Checklist

Within 24 hours of any SEV-1 or SEV-2 incident, the engineering team must conduct a blameless
post-mortem:

- [ ] **Timeline Construction:** Exact timestamps of detection, escalation, rollback, and
      resolution.
- [ ] **Root Cause Analysis (5 Whys):** What triggered the failure and why did existing guardrails
      not catch it?
- [ ] **Data Integrity Audit:** Verification of Firestore documents and audit logs.
- [ ] **Action Items:** Ticket creation for automated test additions, monitoring adjustments, or
      rule updates.
- [ ] **Documentation Update:** Record any newly discovered failure modes in this runbook.
