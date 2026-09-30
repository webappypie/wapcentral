# wap_promo_sdk

WebAppyPie Promotion SDK for Flutter — part of the WAPCentral platform.

## Overview

`wap_promo_sdk` delivers self-promotion campaigns from the WAPCentral platform to your Flutter app.
It is designed to be **completely non-blocking** — your app always starts immediately from local
cache, with promotions refreshed silently in the background.

## Critical Design Guarantees

| Guarantee                | Behavior                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| **Non-blocking startup** | `init()` returns immediately; network fetch happens in background |
| **Cache-first**          | App always renders from local cache (SharedPreferences)           |
| **Graceful degradation** | If network fails: cache → default → hide. Never crashes.          |
| **HMAC validation**      | Server signature validated before any payload is applied          |
| **Frequency capping**    | Per-device impression limits respected                            |
| **Analytics**            | Impression/click events sent fire-and-forget (non-blocking)       |

## Platform-Agnostic API Contract

The backend API contract is HTTP/JSON and platform-agnostic. This Flutter SDK is the V1
implementation. Future native Android/iOS SDKs will use the same endpoint and schema.

## Integration (Phase 8)

```dart
// In main.dart — non-blocking init
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Non-blocking — returns immediately, fetches in background
  unawaited(WapPromoSdk.init(
    appKey: 'your-app-key',
    appVersion: '1.0.0',
    environment: PromoEnvironment.production,
  ));

  runApp(MyApp());
}

// In your widget tree
WapPromoBanner(
  layoutVariant: LayoutVariant.banner,
  onInstall: () => launchUrl(Uri.parse(campaign.storeUrl)),
  onDismiss: () { /* optional */ },
)
```

## Status

**Phase 0 — Stub only.** Full implementation in Phase 8.

## Architecture

```
WapPromoSdk
  ├── PromoCache          — SharedPreferences persistence
  ├── PromoService        — HTTP client + HMAC validation + background refresh
  ├── FrequencyCapManager — Per-device frequency capping
  ├── AnalyticsDispatcher — Fire-and-forget impression/click events
  └── WapPromoBanner      — UI widget (banner / interstitial / native)
```

## Related

- `wap_ads_sdk` — Third-party ad network wrapper (AdMob, Meta, AppLovin MAX, WAPAds hook)
- WAPCentral Dashboard — Campaign management
- `promotion-api` — Backend delivery service
