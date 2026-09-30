# wap_ads_sdk

Unified advertising mediation and monetization SDK for Flutter applications across WebAppyPie.

`wap_ads_sdk` provides a resilient, decoupled mediation wrapper that orchestrates multiple external
ad networks (**Google AdMob**, **Meta Audience Network**, **AppLovin MAX**) and seamlessly
integrates first-party house promotions (**WAPAds**) as a guaranteed waterfall fallback.

---

## Key Features

1. **Decoupled House Ads Hook (`WapPromoHook`):**
   - Cleanly delegates house promotions to `wap_promo_sdk` without hard compile-time dependencies.
   - If external networks fail or experience low fill, the SDK automatically cascades to your own
     house campaigns.

2. **Resilient Waterfall Mediation:**
   - Evaluates ad networks sequentially based on priority (e.g. AdMob $\rightarrow$ Meta
     $\rightarrow$ AppLovin $\rightarrow$ WAPAds).
   - Enforces per-provider timeouts to prevent slow external networks from blocking or delaying app
     rendering.

3. **Safe UI Widgets & Zero Crashes:**
   - `WapAdBanner`: Automatically mounts mediated banners with automatic fallback.
   - `WapAdNative`: Cleanly renders native ad cards.
   - In the event of complete fill exhaustion across all networks, collapses to `SizedBox.shrink()`
     without throwing or breaking the user interface.

4. **Full Format Support:**
   - Adaptive & standard Banners
   - Full-screen Interstitials
   - Rewarded Video Ads
   - Custom In-Feed Native Ads

---

## Installation

Add `wap_ads_sdk` to your app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  wap_ads_sdk:
    path: ../../sdks/wap_ads_sdk
```

---

## Quickstart

### 1. Initialize the SDK

Initialize `WapAdsSdk` during app startup with configuration fetched from WAPCentral or loaded
locally:

```dart
import 'package:flutter/material.dart';
import 'package:wap_ads_sdk/wap_ads_sdk.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final adConfig = AdConfig(
    appId: 'com.webappypie.reader',
    admob: AdMobConfig(
      appId: 'ca-app-pub-3940256099942544~3347511713',
      enabled: true,
      adUnits: [
        AdUnitConfig(
          id: 'banner_main',
          name: 'Home Banner',
          type: AdFormat.banner,
          platform: 'android',
          adUnitId: 'ca-app-pub-3940256099942544/6300978111',
        ),
      ],
    ),
    meta: MetaConfig(
      appId: '102938475610293',
      enabled: true,
      placements: [
        AdPlacement(
          id: 'meta_b',
          name: 'Secondary Banner',
          type: AdFormat.banner,
          placementId: '102938475610293_102938475610294',
        ),
      ],
    ),
    wapads: WapAdsConfig(
      appKey: 'wap_key_reader_prod',
      enabled: true,
    ),
    mediationPriority: MediationPriority.defaultPriority,
  );

  await WapAdsSdk.init(adConfig);

  runApp(const MyApp());
}
```

### 2. Register WAPAds House Ads Hook (Decoupled Integration)

To connect first-party cross-promotions without tightly coupling SDK packages, register a
`WapPromoHook`:

```dart
import 'package:wap_ads_sdk/wap_ads_sdk.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

WapAdsSdk.registerPromoHook(
  DelegatePromoHook(
    availabilityChecker: () => WapPromoSdk.getCurrentPromo()?.hasContent ?? false,
    bannerBuilder: (context, {onAdClicked, onAdLoaded}) => const WapPromoBanner(),
    nativeBuilder: (context, {onAdClicked, onAdLoaded}) => const WapPromoNative(),
    interstitialHandler: (context, {onDismissed}) =>
        WapPromoInterstitial.show(context, onDismissed: onDismissed),
  ),
);
```

### 3. Display Banners & Native Ads

```dart
// Mediated Banner with Automatic Waterfall
class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My App')),
      body: Column(
        children: [
          Expanded(child: Center(child: Text('Content'))),
          const WapAdBanner(height: 50),
        ],
      ),
    );
  }
}

// Mediated Native Ad
class FeedScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        PostCard(),
        const WapAdNative(),
        PostCard(),
      ],
    );
  }
}
```

### 4. Present Interstitial & Rewarded Ads

```dart
// Show Interstitial with Waterfall Failover
final shown = await WapAdsSdk.showInterstitial(
  context,
  onDismissed: () => print('Ad closed'),
);

// Show Rewarded Video
final rewarded = await WapAdsSdk.showRewarded(
  context,
  onUserEarnedReward: (amount, type) {
    print('User earned $amount $type!');
  },
);
```

---

## Testing

Run tests in the SDK directory:

```bash
flutter test
```
