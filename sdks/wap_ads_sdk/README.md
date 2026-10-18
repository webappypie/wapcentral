# WebAppyPie Ads SDK (`wap_ads_sdk`)

The official centralized Flutter Advertising & Monetization SDK for WebAppyPie mobile applications (FileZen, OptiLens AI, and future apps).

Consumes server-authoritative effective ad configurations from **WAPCentral** to mediate advertising demand via **AppLovin MAX** (sole mediation engine) across **AppLovin Demand**, **Google AdMob**, **Meta Audience Network**, **InMobi**, **Unity Ads**, and first-party **WebAppyPie Custom Ads** without hardcoding provider credentials in the mobile client.

---

## Architecture Overview

```
Mobile Application (FileZen / OptiLens / New App)
   ↓
wap_ads_sdk (Unified Flutter Facade)
   ↓
WAPCentral Platform API (GET /api/platform/v1/ads/config)
   ↓
AppLovin MAX Mediation Engine (Sole Mediation Platform)
   ├─► Strategy A: Automatic Mediation (Real-time unified auctions)
   └─► Strategy B: Single Demand Source (Exclusive routing through MAX)
   ↓
Supported Demand Sources & Mediation Adapters:
   ├─► AppLovin Demand (Built-in core bidding)
   ├─► Google AdMob (MAX AdMob Adapter)
   ├─► Meta Audience Network (MAX Meta Adapter)
   ├─► InMobi (MAX InMobi Adapter)
   ├─► Unity Ads (MAX Unity Adapter)
   └─► WebAppyPie Custom Ads (House Ads Fallback)
```

> **Unity LevelPlay Separation:** Unity LevelPlay is not supported or bundled in this architecture. AppLovin MAX is the sole mediation platform; Unity Ads is supported strictly as a demand source via the MAX Unity adapter.

> **WAPCentral Promotions Decoupling:** In-house sponsorships and cross-promotions are served via `wap_promo_sdk`, keeping first-party house campaigns completely decoupled from third-party advertising auctions.

### Core Guarantees
1. **Zero Secret Exposure**: Third-party provider secrets, API tokens, and credentials are never stored in or downloaded to the mobile app. Only public app credentials and server-resolved effective configurations are consumed.
2. **Authoritative Server Control**: Ad networks, format master toggles, placements, strategies, and emergency kill switches are managed entirely from the WAPCentral Dashboard.
3. **Pre-Bundled Adapter Strategy (Zero-Rebuild Switching)**: By pre-bundling supported mediation adapters in `build.gradle` and `Podfile`, administrators can switch active demand partners or mediation strategies remotely from the dashboard without requiring an app store release.
4. **Graceful Fallback & Offline Resilience**: Caches configuration locally; automatically cascades through the mediation waterfall to in-house custom ads if third-party providers fail; suppresses ads safely if WAPCentral is unreachable without valid cache.
5. **Ad Network Policy Compliance**: Strictly enforces minimum safe banner refresh intervals ($\ge 30\text{s}$, default $60\text{s}$) and prohibits artificial rapid cycling on full-screen formats.

---

## Provider & Adapter Roster

| Provider / Demand Source | Role & Architecture | Integration Status | Required Mobile SDK / Adapter | Supported Formats |
| :--- | :--- | :---: | :--- | :--- |
| **AppLovin MAX** | Primary Mediation Platform | `Implemented and Tested` | `applovin_max: ^4.0.1` | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial |
| **AppLovin Demand** | Direct Bidding Demand | `Implemented and Tested` | Built into MAX core SDK | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial |
| **Google AdMob** | Demand Partner via MAX Adapter | `Integrated but Not Configured` | `com.applovin.mediation:google-adapter:23.6.0.0` | Banner, Native, Interstitial, Rewarded, App Open, Rewarded Interstitial |
| **Meta Audience Network** | Demand Partner via MAX Adapter | `Integrated but Not Configured` | `com.applovin.mediation:facebook-adapter:6.18.0.0` | Banner, Native, Interstitial, Rewarded *(No App Open / Rewarded Interstitial)* |
| **InMobi** | Demand Partner via MAX Adapter | `Integrated but Not Configured` | `com.applovin.mediation:inmobi-adapter:10.8.0.0` | Banner, Native, Interstitial, Rewarded *(No App Open / Rewarded Interstitial)* |
| **Unity Ads** | Demand Partner via MAX Adapter | `Integrated but Not Configured` | `com.applovin.mediation:unityads-adapter:4.12.5.0` | Banner, Interstitial, Rewarded *(No Native / App Open)* |
| **WebAppyPie Custom Ads** | House Ads Fallback | `Implemented and Tested` | Built into `wap_ads_sdk` | Banner, Native, Interstitial, Rewarded |

---

## Remote Switching vs. App Rebuild Matrix

| Operation / Change | Takes Effect Remotely | Requires App Rebuild | Notes |
| :--- | :---: | :---: | :--- |
| Switching Strategy (`automatic` $\leftrightarrow$ `single_source`) | ✅ Yes | ❌ No | Fetched dynamically from WAPCentral |
| Switching Single Source Demand Partner | ✅ Yes | ❌ No | If partner adapter was pre-bundled in build |
| Enabling / Disabling Demand Sources | ✅ Yes | ❌ No | Adjusts active mediation waterfall dynamically |
| Environment Toggle (`testing` $\leftrightarrow$ `production`) | ✅ Yes | ❌ No | Injects official sandbox test IDs or live IDs |
| Updating Ad Unit IDs / Placements / Refresh Rates | ✅ Yes | ❌ No | Updated on next launch or config refresh |
| Emergency Kill Switches | ✅ Yes | ❌ No | Instant ad suppression across all client devices |
| Compiling in a New Adapter / SDK | ❌ No | ✅ Yes | Native binaries must be compiled into APK/IPA |
| Updating AndroidManifest / Info.plist IDs | ❌ No | ✅ Yes | OS manifest keys are baked into compiled binary |

Add `wap_ads_sdk` to your Flutter app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  wap_ads_sdk:
    path: ../WAPCentral/sdks/wap_ads_sdk # Or git / package path
```

Run:
```bash
flutter pub get
```

---

## Initialization

Initialize the SDK once during app startup (e.g. in `main()` before `runApp()`):

```dart
import 'package:flutter/material.dart';
import 'package:wap_ads_sdk/wap_ads.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await WapAds.initialize(
    const WapAdsOptions(
      appId: 'filezen', // Registered app ID in WAPCentral
      appKey: 'wap_key_filezen_prod', // Public SDK key generated by WAPCentral
      environment: 'production', // 'production' | 'staging' | 'development'
      // Optional: defaults to production WAPCentral API
      baseUrl: 'https://wapcentral-admin-api-174781611765.asia-south1.run.app',
      testMode: false,
    ),
  );

  runApp(const MyApp());
}
```

---

## Ad Formats Usage

### 1. Banner Ad (`WapAds.banner`)
Renders an adaptive, auto-refreshing banner ad adhering to the mediation waterfall and safe refresh interval:

```dart
Widget buildBannerSection() {
  return WapAds.banner(
    placementKey: 'home_bottom_banner',
    onLoaded: () => print('Banner displayed successfully'),
    onFailed: (error) => print('Banner failed: $error'),
    onClicked: () => print('Banner tapped'),
  );
}
```

### 2. Native Ad (`WapAds.native`)
Renders native ads styled to match your application's UI design:

```dart
Widget buildNativeSection() {
  return WapAds.native(
    placementKey: 'feed_inline_native',
    customBuilder: (context, data) {
      return Card(
        child: ListTile(
          title: Text(data['headline'] ?? ''),
          subtitle: Text(data['body'] ?? ''),
          trailing: ElevatedButton(
            onPressed: () {},
            child: Text(data['cta'] ?? 'Open'),
          ),
        ),
      );
    },
  );
}
```

### 3. Interstitial Ad (`WapAds.showInterstitial`)
Presents a full-screen transition ad with cooldown and session cap verification:

```dart
Future<void> onLevelComplete(BuildContext context) async {
  final shown = await WapAds.showInterstitial(
    context,
    placementKey: 'level_complete_interstitial',
  );
  if (!shown) {
    print('Interstitial suppressed by cooldown, cap, or kill-switch');
  }
}
```

### 4. Rewarded Video Ad (`WapAds.showRewarded`)
Presents a rewarded video ad and returns a verified result. **Rewards are only granted after verified provider completion callbacks.**

```dart
Future<void> onWatchRewardedAd(BuildContext context) async {
  final result = await WapAds.showRewarded(
    context,
    placementKey: 'earn_free_storage_rewarded',
  );

  if (result.rewardGranted) {
    // Reward verified by provider callback
    grantUserCredits(result.rewardAmount, result.rewardType);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Earned ${result.rewardAmount} ${result.rewardType}!')),
    );
  } else {
    print('User skipped, closed early, or ad failed: ${result.error}');
  }
}
```

### 5. App Open Ad (`WapAds.showAppOpen`)
Presents an App Open ad on cold start or when resuming from background:

```dart
Future<void> onAppResumed(BuildContext context) async {
  await WapAds.showAppOpen(
    context,
    placementKey: 'cold_start_open',
  );
}
```

### 6. Rewarded Interstitial (`WapAds.showRewardedInterstitial`)
Combines an interstitial flow with rewarded opt-in mechanics:

```dart
final result = await WapAds.showRewardedInterstitial(
  context,
  placementKey: 'game_over_save_streak',
);
```

---

## WebAppyPie Custom Ads
First-party cross-promotions are centrally configured in WAPCentral and automatically serve as waterfall fallbacks when third-party networks exhaust or fail:
* Automatically tracks impressions to `POST /api/platform/v1/ads/custom/track`.
* Automatically tracks user clicks and directs to destination URLs or deep links.

---

## Telemetry & Analytics

Register a custom telemetry listener to receive ad lifecycle events:

```dart
WapAds.addTelemetryListener((AdEvent event) {
  print('Ad Telemetry: ${event.type} for ${event.format?.name} via ${event.provider}');
});
```

Supported Events: `request`, `loaded`, `failed`, `displayed`, `clicked`, `rewarded`, `fallback`, `providerSelected`, `killSwitch`, `configRefresh`.

---

## Testing & Mocks

In your widget and unit tests, use `WapAdsOptions.test` and custom providers:

```dart
testWidgets('Renders banner test', (tester) async {
  await WapAds.initialize(
    WapAdsOptions.test(
      appId: 'test_app',
      initialConfig: EffectiveAdConfig.safeDisabled(),
    ),
  );

  await tester.pumpWidget(MaterialApp(home: Scaffold(body: WapAds.banner())));
  expect(find.byType(SizedBox), findsWidgets);
});
```

---

## Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `AdError(code: GLOBAL_KILL_SWITCH)` | Global ads disabled in WAPCentral. | Verify kill-switch status on dashboard (`/ads`). |
| `AdError(code: COOLDOWN_ACTIVE)` | Ad requested before cooldown elapsed. | Normal behavior. Ad suppressed to respect user experience. |
| `AdError(code: FREQUENCY_CAPPED)` | User reached session or daily cap. | Normal behavior. Configured from dashboard. |
| `HTTP 403 (SERVICE_NOT_AUTHORIZED)` | App not registered for `ads` service. | Update application registration in WAPCentral. |
| Ads display placeholder / blank | Simulator mode or test mode active. | Expected in development. Connect production app keys for live ads. |

---

## Production Release Checklist

- [ ] Registered App in WAPCentral with valid package ID.
- [ ] Added `ads` to `allowedServices` in WAPCentral.
- [ ] Generated Public SDK Key (`wap_key_*_prod`).
- [ ] Confirmed AdMob / Meta / AppLovin Ad Unit IDs configured in WAPCentral Dashboard.
- [ ] Verified banner refresh interval $\ge 30\text{s}$ (safe default: 60s).
- [ ] Tested Global Kill Switch suppression.
- [ ] Tested Rewarded Ad reward callback granting.
- [ ] Confirmed **Zero secrets** hardcoded in client application source code.
