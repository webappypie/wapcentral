# wap_promo_sdk

WebAppyPie Promotion SDK for Flutter — part of the WAPCentral platform.

## Overview

`wap_promo_sdk` delivers self-promotion and house-ad campaigns from the WAPCentral platform to your
Flutter apps. It is engineered with **strict non-blocking guarantees** — mobile apps always start
instantaneously from local cache, with campaigns refreshed silently in the background.

---

## Critical Design Guarantees

| Guarantee                      | Behavior                                                                                                           |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **Zero-Latency Startup**       | `init()` immediately resolves cached promotional state from local storage.                                         |
| **Non-Blocking Launch**        | Remote API calls run strictly in the background; never blocks Flutter startup or frame rendering.                  |
| **Graceful Degradation**       | Hierarchy: Local Cache → Safe Default → Hide Widget (`SizedBox.shrink()`). Never throws, never crashes.            |
| **HMAC-SHA256 Integrity**      | Every server response signature is validated before applying, preventing spoofing and man-in-the-middle tampering. |
| **Frequency Capping**          | Enforces per-device, per-period impression limits to maintain optimal user experience.                             |
| **Fire-and-Forget Telemetry**  | Dispatches impression and click events asynchronously in the background.                                           |
| **Platform-Agnostic Contract** | Communicates via standard versioned HTTP/JSON contracts consumable by Flutter and future native SDKs.              |

---

## Architecture

```
WapPromoSdk (Facade)
  ├── PromoConfig          — App identity, base URL, signing secret, timeouts
  ├── PromoPayload         — Versioned campaign data model with format variants
  ├── PromoCache           — SharedPreferences persistent storage + frequency tracking
  ├── CryptoValidator      — HMAC-SHA256 signature generation and timing-safe verification
  ├── PromoService         — Cache-first resolver, background fetch, telemetry dispatcher
  └── Widgets
      ├── WapPromoBanner       — Responsive bottom or inline banner
      ├── WapPromoInterstitial — Fullscreen modal takeover dialog
      ├── WapPromoNative       — Native feed card with 'PROMOTED' badge
      └── WapPromoBuilder      — Custom widget builder exposing active payload
```

---

## Quickstart & Integration

### 1. Add Dependency

In your app's `pubspec.yaml`:

```yaml
dependencies:
  wap_promo_sdk:
    path: path/to/sdks/wap_promo_sdk # or git dependency
```

### 2. Initialize in `main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Non-blocking initialization — loads cache immediately, refreshes in background
  await WapPromoSdk.init(
    const PromoConfig(
      appId: 'app_01',
      appKey: 'wap_app_key_notes_prod',
      baseUrl: 'https://promotion-api.webappypie.com',
      signingSecret: 'your_promotion_signing_secret',
      appVersion: '1.2.0',
      platform: 'android',
      environment: 'production',
      enableLogging: false,
    ),
  );

  runApp(const MyApp());
}
```

### 3. Display Promotions in UI

#### Banner Widget

```dart
// Place in your screen or bottom navigation bar
WapPromoBanner(
  onCtaTap: (storeUrl) {
    // Launch store URL (e.g. using url_launcher)
  },
)
```

#### Native Feed Card

```dart
// Insert inside ListView or feed items
WapPromoNative(
  onCtaTap: (storeUrl) {
    // Handle install
  },
)
```

#### Interstitial Takeover Dialog

```dart
// Show on milestone or level completion
await WapPromoInterstitial.show(
  context,
  onCtaTap: (storeUrl) {
    // Handle install
  },
);
```

#### Custom Layout Builder

```dart
WapPromoBuilder(
  builder: (context, promo) {
    if (promo == null || !promo.hasContent) {
      return const SizedBox.shrink();
    }
    return MyCustomPromoCard(promo: promo);
  },
)
```

---

## Testing

Run unit and widget tests:

```bash
flutter test
```
