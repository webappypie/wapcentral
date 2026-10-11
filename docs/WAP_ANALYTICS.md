# WAPCentral Analytics & Revenue Intelligence (Step 4)

## 1. Overview & Architecture

WAPCentral Analytics & Revenue Intelligence provides a centralized, privacy-first, production-ready observability and monetization control plane for all WebAppyPie applications (e.g., FileZen, OptiLens, and future apps).

### Architecture Flow

```
Mobile Application (FileZen / OptiLens)
         ↓
  wap_ads_sdk / wap_notifications_sdk
         ↓
  Platform API Gateway (/api/platform/v1/ads/analytics/events)
         ↓
  Anti-Fraud & Deduplication Layer (5000ms Sliding Window)
         ↓
  Partitioned Raw Collections (Firestore)
    ├── adImpressionEvents
    ├── adClickEvents
    ├── adRequestEvents
    ├── adFillEvents
    ├── adFailureEvents
    ├── adRewardEvents
    ├── adProviderEvents
    ├── customAdAnalytics
    └── notificationAnalytics
         ↓
  Incremental & Batch Aggregation Service
         ↓
  analyticsDailyAggregates ({date}_{appId}_{provider}_{format})
         ↓
  Admin API (/v1/analytics/*) & Dashboard (/analytics)
```

---

## 2. Event Data Model

Every telemetry event includes standardized metadata:

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique UUID generated on ingestion |
| `requestId` | `string` | SDK transaction request ID |
| `appId` | `string` | Application identifier (e.g. `filezen`) |
| `eventType` | `AdEventType` | `request` \| `fill` \| `impression` \| `click` \| `failure` \| `reward` \| `provider_selection` \| `fallback` |
| `adFormat` | `AdFormat` | `banner` \| `native` \| `interstitial` \| `rewarded` \| `app_open` \| `rewarded_interstitial` |
| `provider` | `string` | `admob` \| `meta` \| `applovin` \| `custom_ads` |
| `placementId` | `string?` | Placement key (e.g., `home_banner`) |
| `adUnitId` | `string?` | Provider ad unit ID |
| `campaignId` | `string?` | Internal campaign ID (for custom ads) |
| `latencyMs` | `number?` | Network load / fill latency in milliseconds |
| `environment` | `string` | `development` \| `staging` \| `production` |
| `platform` | `string` | `android` \| `ios` |
| `timestamp` | `string` | ISO 8601 UTC timestamp |

---

## 3. Anti-Fraud & Quality Protection

To protect analytics accuracy and system stability, incoming telemetry passes through `AntiFraudService`:

1. **Deduplication Sliding Window**:
   - Cache key: `${appId}:${requestId}:${eventType}`.
   - If an identical key arrives within `5,000ms`, the event is classified as duplicate and suppressed.
2. **Format & Type Verification**:
   - Rejects unapproved ad formats or malformed event types.
3. **Latency Sanity Check**:
   - Rejects negative latencies or unrealistic values (> 600,000ms).
4. **Timestamp Verification**:
   - Rejects events with timestamps more than 1 hour into the future.
5. **Burst Rate Dampening**:
   - Protects backend ingestion from client loop storms.

---

## 4. Daily Aggregation Model (`analyticsDailyAggregates`)

Document ID format: `{YYYY-MM-DD}_{appId}_{provider}_{format}`

### Tracked Counters:
- `requests`: Total ad requests initiated by SDK
- `fills`: Successful ad loads from network
- `impressions`: Verified renders on user device screen
- `clicks`: Verified user engagements
- `failures`: Ad load or render failures / timeouts
- `rewards`: User rewarded ad completions
- `fallbacks`: Mediation tier fallbacks triggered
- `revenue`: Actual synced provider earnings ($0.00 if unlinked)
- `revenueStatus`: Reporting connectivity state

---

## 5. Strict Revenue Honesty Principle

> **Accounting Rule**: WAPCentral **NEVER** fabricates, hardcodes, or estimates fake production revenue or eCPM.

Ad providers require server-to-server reporting API tokens:
- **Google AdMob**: Requires linked Publisher ID and AdMob Reporting API credentials in Secret Manager.
- **Meta Audience Network**: Requires Meta Graph API System User Token with `read_audience_network_insights`.
- **AppLovin MAX**: Requires AppLovin MAX Report Key (`APPLOVIN_REPORT_KEY`).
- **WebAppyPie Custom Ads**: Self-hosted cross-promotions with $0 spend.

Until reporting tokens are actively synced, the platform reports:
`"Not connected"`, `"Awaiting provider data"`, or `"Estimated / unavailable"` with $0.00 revenue.

---

## 6. Data Retention Standards

1. **Raw Telemetry Events** (`ad*Events`):
   - **90 Days Retention (TTL)**: Automatically cleaned up by `AnalyticsRetentionService` to minimize Firestore storage costs while retaining forensic details.
2. **Daily Aggregates** (`analyticsDailyAggregates`):
   - **730 Days (2 Years) Retention**: Compact historical summary for year-over-year business intelligence.
3. **Privacy**:
   - No PII (Personally Identifiable Information) stored. Hashed device identifiers only.

---

## 7. Dashboard Sections (9 Tabs)

1. **Overview**: Key metrics (Impressions, Clicks, CTR, Fill Rate, eCPM status, Fallback Rate, Active Apps, Active Networks) and daily progression chart.
2. **Apps**: Application performance table (FileZen, OptiLens) with top format and network.
3. **Ad Networks**: Network comparison table (AdMob, Meta, AppLovin, Custom Ads) with health status, fill rate, and failure rate.
4. **Ad Formats**: Performance across all 6 formats.
5. **Placements**: Granular placement-level performance metrics.
6. **Revenue & eCPM**: Provider reporting connectivity checklist and Cloud Billing cost intelligence.
7. **Custom Ads**: Cross-promotional campaign impressions, clicks, and CTR.
8. **Notifications**: Delivery performance, open rates, and category distribution.
9. **Events & Export**: CSV and JSON export with date range filters, plus manual rollup trigger.

---

## 8. API Reference

### Platform API (Mobile SDK / App Ingestion)
```http
POST /api/platform/v1/ads/analytics/events
Headers:
  x-wap-app-id: filezen
  x-wap-app-key: <app-key>
Content-Type: application/json

{
  "events": [
    {
      "requestId": "req_847291",
      "eventType": "impression",
      "adFormat": "banner",
      "provider": "admob",
      "placementId": "home_banner",
      "latencyMs": 140
    }
  ]
}
```

### Admin API (Dashboard / BI Querying)
- `GET /v1/analytics/overview?preset=7d&appId=filezen`
- `GET /v1/analytics/apps?preset=7d`
- `GET /v1/analytics/networks?preset=7d`
- `GET /v1/analytics/formats?preset=7d`
- `GET /v1/analytics/placements?preset=7d`
- `GET /v1/analytics/revenue?preset=7d`
- `GET /v1/analytics/custom-ads?preset=7d`
- `GET /v1/analytics/notifications?preset=7d`
- `GET /v1/analytics/timeseries?preset=7d`
- `GET /v1/analytics/export?type=csv&startDate=2026-10-01&endDate=2026-10-06`
- `GET /v1/analytics/cost-intelligence`
- `POST /v1/analytics/aggregate` (Body: `{ "date": "2026-10-06" }`)
