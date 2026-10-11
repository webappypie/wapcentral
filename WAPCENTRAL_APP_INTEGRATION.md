# WAPCentral — Master Application Integration Guide

> **Core Monetization Principle**:  
> **Ad networks are centrally configured in WAPCentral. The consuming application should not directly manage provider configuration unless explicitly required by the SDK.**  
> Consuming apps (FileZen, OptiLens AI, games, utilities) must never store, bundle, or reference third-party ad network secrets (AdMob API tokens, Meta App Secrets, AppLovin SDK keys). All configuration, tier ordering, frequency caps, placement rules, content safety filters, and emergency kill switches are server-authoritative and dynamically fetched from WAPCentral.

---

## Table of Contents

- [Section A: What WAPCentral Is](#section-a-what-wapcentral-is)
- [Section B: What App Developers Need Before Integration](#section-b-what-app-developers-need-before-integration)
- [Section C: App Registration Process](#section-c-app-registration-process)
- [Section D: appId](#section-d-appid)
- [Section E: appKey / Public SDK Credential](#section-e-appkey--public-sdk-credential)
- [Section F: Flutter SDK Installation](#section-f-flutter-sdk-installation)
- [Section G: Initialization](#section-g-initialization)
- [Section H: Ads Integration Architecture](#section-h-ads-integration-architecture)
- [Section I: Supported Ad Formats](#section-i-supported-ad-formats)
  - [1. Banner Ads](#1-banner-ads)
  - [2. Native Ads](#2-native-ads)
  - [3. Interstitial Ads](#3-interstitial-ads)
  - [4. Rewarded Ads](#4-rewarded-ads)
  - [5. App Open Ads](#5-app-open-ads)
  - [6. Rewarded Interstitial Ads](#6-rewarded-interstitial-ads)
- [Section J: Central Notification System Integration](#section-j-central-notification-system-integration)
- [Section K: Dashboard Configuration](#section-k-dashboard-configuration)
- [Section L: What Can Be Controlled From WAPCentral](#section-l-what-can-be-controlled-from-wapcentral)
- [Section M: Firebase Requirements](#section-m-firebase-requirements)
- [Section N: Android Requirements](#section-n-android-requirements)
- [Section O: iOS Requirements](#section-o-ios-requirements)
- [Section P: Test Mode](#section-p-test-mode)
- [Section Q: Production Mode](#section-q-production-mode)
- [Section R: Offline Behavior & Resilience](#section-r-offline-behavior--resilience)
- [Section S: Kill Switches & Emergency Procedures](#section-s-kill-switches--emergency-procedures)
- [Section T: Troubleshooting & Diagnostic Guide](#section-t-troubleshooting--diagnostic-guide)
- [Section U: Security Rules](#section-u-security-rules)
- [Section V: Things Developers MUST NOT Hard-Code](#section-v-things-developers-must-not-hard-code)
- [Section W: Things Developers MUST NOT Modify](#section-w-things-developers-must-not-modify)
- [Section X: Production Release Checklist](#section-x-production-release-checklist)
- [Section Y: Complete Example Integration for a New App](#section-y-complete-example-integration-for-a-new-app)

---

## Section A: What WAPCentral Is

**WAPCentral** is the unified central command and platform intelligence service for all WebAppyPie mobile applications (FileZen, OptiLens, upcoming casual games, and utility apps). It centralizes:

1. **Ads & Monetization Control Center**: Server-authoritative ad mediation orchestration across Google AdMob, Meta Audience Network, AppLovin MAX, and WebAppyPie Custom Ads.
2. **Dynamic Configuration Delivery**: Real-time delivery of feature flags, mediation waterfalls, refresh intervals, frequency caps, and placement rules.
3. **Emergency Kill Switches**: Multi-tier instant ad suppression (Global, Network, App, Format, Placement, Custom Ads) taking effect within seconds without requiring client app store updates.
4. **House Promotion Engine**: Built-in zero-dependency cross-promotion system serving high-CTR WebAppyPie campaigns with end-to-end impression and click telemetry.
5. **AI Gateway & Cost Governance**: Centralized token routing, rate limits, and model governance for consumer apps leveraging AI models.

Consuming mobile apps do not directly connect to third-party ad network configuration dashboards. Instead, they interact solely with the `wap_ads_sdk`, which synchronizes runtime state with WAPCentral.

---

## Section B: What App Developers Need Before Integration

Before embedding `wap_ads_sdk` in your mobile application, ensure you have gathered the following prerequisites:

1. **WAPCentral App Registration**: An active app record in the WAPCentral Console (`apps` collection).
2. **Public Credentials**:
   - `appId` (e.g., `filezen-android`, `optilens-ios`)
   - `appKey` / Public Client Key (issued in WAPCentral Dashboard; e.g., `wap_pub_live_...`)
3. **Platform Environment Base URL**:
   - Production: `https://api.wapcentral.webappypie.com` (or Cloud Run platform endpoint)
   - Staging/Local: `https://staging-api.wapcentral.webappypie.com`
4. **Platform Tooling**:
   - Flutter SDK $\ge 3.19.0$
   - Dart SDK $\ge 3.3.0$
   - Android SDK API $\ge 21$ (target API $\ge 34$)
   - iOS $\ge 13.0$ / Xcode $\ge 15.0$
5. **Ad Network Public App IDs** (only client-level IDs required by OS manifests, never secret keys):
   - AdMob Application ID (e.g., `ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy`)
   - Meta Audience Network Client Token (if required in AndroidManifest)
   - AppLovin SDK Key (configured in manifest/info.plist if using standalone plugin)

---

## Section C: App Registration Process

1. **Access WAPCentral Dashboard**: Navigate to the WAPCentral Admin Console (`/apps` or `/ads`).
2. **Create New Application**:
   - Enter **App Name** (e.g., `FileZen`).
   - Enter **App Identifier / Slug** (e.g., `filezen-android`).
   - Enter **Bundle ID / Package Name** (e.g., `com.webappypie.filezen`).
   - Select **Target Platform** (`android`, `ios`, `all`).
3. **Generate Public App Key**:
   - In the App Details page, click **Generate Public Client Key**.
   - Note the generated `wap_pub_...` key.
4. **Configure Monetization Profile**:
   - Navigate to `/ads` $\rightarrow$ **App-Wise Ad Configuration**.
   - Enable Master Ads Toggle for the app.
   - Configure enabled formats (`banner`, `native`, `interstitial`, `rewarded`, `appOpen`, `rewardedInterstitial`).
   - Define network mediation waterfall tiers and ad unit mappings for each format.
   - Configure safe refresh intervals ($\ge 30\text{s}$, default $60\text{s}$) and frequency limits.
   - Set up WebAppyPie Custom Ads fallback creatives.
5. **Save and Deploy**: Configuration immediately becomes effective at `GET /api/platform/v1/ads/config`.

---

## Section D: appId

The `appId` is the unique, permanent platform slug identifying your application across the WAPCentral ecosystem:
- **Format**: Lowercase alphanumeric with hyphens (e.g., `filezen-android`, `optilens-ai`, `word-quest-ios`).
- **Purpose**: WAPCentral scopes all monetization rules, frequency cap limits, network tier mappings, and analytics rollups by `appId`.
- **Usage**: Provided to `WapAds.initialize(options: WapAdsOptions(appId: 'filezen-android', ...))` and transmitted in the `X-App-Id` HTTP header.

---

## Section E: appKey / Public SDK Credential

The `appKey` is a **public, client-safe token** granting read access to your app's public runtime configuration and write access to non-sensitive telemetry events:
- **Prefix**: `wap_pub_test_` (for staging/test environments) or `wap_pub_live_` (for production).
- **Security Boundary**: The `appKey` only exposes public ad unit IDs, mediation tier order, refresh intervals, and custom promo banners. It **never** provides administrative access and cannot modify server state.
- **Header**: Automatically included in SDK requests as `X-App-Key`.
- **Environment Separation**: Never use a `wap_pub_live_` key in internal debug builds or a `wap_pub_test_` key in release builds.

---

## Section F: Flutter SDK Installation

Add `wap_ads_sdk` to your app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  # WAP Ads SDK (path dependency in monorepo, or git/hosted package)
  wap_ads_sdk:
    path: ../../sdks/wap_ads_sdk
  # If using direct HTTP fallback
  http: ^1.2.0
```

Run `pub get`:
```bash
flutter pub get
```

---

## Section G: Initialization

Initialize `WapAds` inside your `main()` method before rendering the root application widget:

```dart
import 'package:flutter/material.dart';
import 'package:wap_ads_sdk/wap_ads.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize WAP Ads SDK
  await WapAds.initialize(
    options: WapAdsOptions(
      appId: 'filezen-android',
      appKey: const String.fromEnvironment(
        'WAP_PUBLIC_APP_KEY',
        defaultValue: 'wap_pub_live_sample_key',
      ),
      baseUrl: 'https://api.wapcentral.webappypie.com',
      environment: WapEnvironment.production,
      testMode: false,
      autoRefreshConfig: true,
      refreshInterval: const Duration(minutes: 15),
      telemetryListener: (event) {
        debugPrint('[WapAds Telemetry] ${event.eventType} on ${event.placementKey} (${event.provider})');
      },
    ),
  );

  runApp(const MyApp());
}
```

### Initialization Guarantees:
- **Non-blocking startup**: Configuration fetch errors never crash or block app launch.
- **Fail-safe offline state**: If network is unavailable on first launch, a safe disabled configuration is used until connectivity is established.
- **Background periodic sync**: Configuration automatically syncs every 15 minutes without user friction.

---

## Section H: Ads Integration Architecture

The consuming app interacts solely with the top-level `WapAds` facade and declarative widgets:

```
┌─────────────────────────────────────────────────────────────┐
│                       Your Flutter App                      │
│      (WapAds.banner, WapAds.showInterstitial, etc.)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         wap_ads_sdk                         │
│  ┌───────────────────────┐       ┌────────────────────────┐ │
│  │ WapAdsConfigService   │◄─────►│   FrequencyManager     │ │
│  │ (Sync, Cache, SHA256) │       │ (Cooldown, Daily Caps) │ │
│  └───────────┬───────────┘       └────────────────────────┘ │
│              ▼                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            AppLovin MAX Mediation Engine               │ │
│  │    (Automatic Mediation OR Single Demand Source)       │ │
│  └───────┬──────────────┬──────────────┬─────────────┬────┘ │
└──────────┼──────────────┼──────────────┼─────────────┼──────┘
           ▼              ▼              ▼             ▼
       AppLovin       Google AdMob     Meta      InMobi / Unity
     Demand Source    Adapter Demand  Audience     Adapter Demand
           ▲              ▲              ▲             ▲
           └──────────────┴──────────────┴─────────────┘
                                  ▲
                     WebAppyPie Custom Ads
                (First-Party Managed House Ads)
                                  ▲
                        Server-Authoritative
                    WAPCentral Ads Platform API
                  (/api/platform/v1/ads/config)
```

### Mediation Engine & Lightweight Adapter Strategy

1. **Sole Mediation Engine**: AppLovin MAX serves as the single unified mediation engine across all WebAppyPie mobile apps and games. Unity LevelPlay is not bundled or supported to avoid duplicate mediation platform complexity and app bloat.
2. **Supported Demand Sources via MAX**:
   - **AppLovin Demand**: Direct real-time bidding demand through MAX core SDK.
   - **Google AdMob**: High-fill bidding and waterfall demand via MAX AdMob adapter.
   - **Meta Audience Network**: Social bidding demand via MAX Meta adapter.
   - **InMobi**: Premium international demand via MAX InMobi adapter.
   - **Unity Ads**: Mobile game and rewarded video demand via MAX Unity adapter.
   - **WebAppyPie Custom Ads**: Centrally managed promotional campaigns for house apps, rendered directly and never misrepresented as third-party impressions.
3. **Ad Strategies**:
   - **Automatic Mediation**: AppLovin MAX orchestrates competition among all enabled, bundled demand sources in real time using unified bidding auctions and waterfalls.
   - **Single Demand Source**: Routes ad requests exclusively to one chosen demand partner through MAX, while preserving MAX as the underlying mediation engine.
4. **Lightweight SDK Principle**:
   - Apps bundle only the adapters required by their selected demand partners.
   - WAPCentral enforces strict build-time vs remote-activation isolation: if a network is enabled remotely while its required adapter is not compiled into the app, WAPCentral flags it as **Requires app update** and safely omits it from the client payload to protect app startup speed and binary size.

---

## Section I: Supported Ad Formats

### 1. Banner Ads

Declarative widget for embedded banner placements. Supports automatic safe timer refreshes, cooldown checks, and fallback cascades.

```dart
import 'package:flutter/material.dart';
import 'package:wap_ads_sdk/wap_ads.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FileZen')),
      body: const Center(child: Text('Home Content')),
      bottomNavigationBar: SafeArea(
        child: SizedBox(
          height: 60,
          child: WapAds.banner(
            placementKey: 'home_bottom_banner',
            onAdLoaded: () => debugPrint('Banner loaded successfully'),
            onAdFailedToLoad: (error) => debugPrint('Banner failed: $error'),
            onAdClicked: () => debugPrint('Banner clicked'),
          ),
        ),
      ),
    );
  }
}
```

*Policy Note*: The SDK enforces a minimum refresh interval of $\ge 30\text{s}$ (safe server default: $60\text{s}$). Faster refresh loops are strictly clamped to protect network policies.

---

### 2. Native Ads

Declarative native creative widget. Blends seamlessly into app lists and cards while respecting platform policies and mediation waterfalls.

```dart
WapAds.native(
  placementKey: 'file_list_feed_native',
  builder: (context, creative) {
    return Card(
      child: ListTile(
        leading: creative.iconUrl != null ? Image.network(creative.iconUrl!) : null,
        title: Text(creative.title),
        subtitle: Text(creative.body),
        trailing: ElevatedButton(
          onPressed: creative.performClick,
          child: Text(creative.callToAction),
        ),
      ),
    );
  },
  onAdLoaded: () => debugPrint('Native ad loaded'),
  onAdFailedToLoad: (err) => debugPrint('Native ad failed: $err'),
)
```

---

### 3. Interstitial Ads

Fullscreen break ads displayed during natural transition points (e.g., after completing a file export or level transition).

```dart
Future<void> onFileExportCompleted(BuildContext context) async {
  // Trigger interstitial through WAPCentral mediation
  final result = await WapAds.showInterstitial(
    placementKey: 'export_completion_interstitial',
  );

  if (result.success) {
    debugPrint('Interstitial served via ${result.provider}');
  } else {
    debugPrint('Interstitial suppressed or failed: ${result.error?.message}');
  }

  // Continue user flow regardless of ad fill
  navigateToNextScreen(context);
}
```

---

### 4. Rewarded Ads

User-initiated ads granting in-app perks (e.g., extra Cloud Storage, OCR credits, unlocks).

```dart
Future<void> onWatchAdForExtraStorage(BuildContext context) async {
  final result = await WapAds.showRewarded(
    placementKey: 'storage_bonus_rewarded',
  );

  if (result.rewardGranted) {
    // REWARD MUST ONLY BE GRANTED AFTER SDK VERIFIES VALID COMPLETION
    grantUserBonus(
      type: result.rewardType ?? 'storage_quota',
      amount: result.rewardAmount ?? 100, // MB
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Granted +${result.rewardAmount} MB storage!')),
    );
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Ad was not completed: ${result.error?.message ?? "Cancelled"}')),
    );
  }
}
```

---

### 5. App Open Ads

Fullscreen ads displayed when the user launches or returns to the application from the background.

```dart
// Typically triggered in your AppLifecycleState listener:
void onAppResumed() async {
  final result = await WapAds.showAppOpen(
    placementKey: 'cold_or_warm_app_open',
  );
  if (result.success) {
    debugPrint('App open ad displayed');
  }
}
```

*Policy Note*: The SDK verifies background duration ($\ge 30\text{s}$) and cooldown rules before showing an App Open ad to prevent annoying users switching apps briefly.

---

### 6. Rewarded Interstitial Ads

Pre-roll or naturally paced rewarded experiences where the user can opt-in to watch an interstitial to earn rewards without complete lock-in.

```dart
final result = await WapAds.showRewardedInterstitial(
  placementKey: 'level_clear_rewarded_interstitial',
);

if (result.rewardGranted) {
  grantRewardBonus();
}
```

---

## Section J: Central Notification System Integration

The **WAPCentral Central Notification Platform** allows every WebAppyPie mobile app to receive FCM push notifications and provide an in-app bell notification experience without managing server keys or Firebase Admin credentials inside the client app.

### Architecture

```
Mobile App (Flutter)
       ↓
 wap_notifications_sdk
       ↓
 WAPCentral Notification Platform API (/api/platform/v1/notifications/...)
       ↓
 Cloud Run + Firestore (Devices, Preferences, Campaigns, Bell Feed)
       ↓
 Firebase Cloud Messaging (FCM HTTP v1)
       ↓
 User Device (System Tray & Bell Center)
```

### 1. Add SDK Dependency

In your app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  wap_notifications_sdk:
    path: ../../sdks/wap_notifications_sdk
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
```

### 2. Initialize the Notification SDK

Initialize `WapNotifications` alongside `WapAds` during app bootstrap:

```dart
import 'package:flutter/material.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Notifications SDK
  await WapNotifications.initialize(
    const WapNotificationsOptions(
      appId: 'filezen', // Registered app ID in WAPCentral
      appKey: 'wap_key_filezen_prod', // Public app client credential
      baseUrl: 'https://api.wapcentral.io',
      environment: 'production',
      autoFetchBell: true,
      enableLogging: false,
    ),
  );

  runApp(const MyApp());
}
```

### 3. Register FCM Token with WAPCentral

Capture the device token using `firebase_messaging` and register it with WAPCentral:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

Future<void> setupPushNotifications(String? currentUserId) async {
  final messaging = FirebaseMessaging.instance;

  // Request system notification permissions
  final permission = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  if (permission.authorizationStatus == AuthorizationStatus.authorized) {
    // 1. Get FCM Token
    final token = await messaging.getToken();
    if (token != null) {
      await WapNotifications.registerDevice(
        fcmToken: token,
        platform: 'android', // or 'ios'
        userId: currentUserId,
        appVersion: '2.1.0',
      );
    }

    // 2. Listen for Token Rotations
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      WapNotifications.registerDevice(
        fcmToken: newToken,
        userId: currentUserId,
      );
    });
  }
}
```

### 4. Push Listeners & Deep Link Routing

Forward foreground notifications and handle push notification taps:

```dart
// Forward incoming foreground messages to WAP Notifications engine
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  WapNotifications.handleForegroundMessage(message.toMap());
});

// App launched/resumed from notification tap
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  WapNotifications.handleNotificationTapped(message.toMap());
});

// Global deep-link routing listener
WapNotifications.onNotificationTapped.listen((WapNotification item) {
  if (item.deepLink != null) {
    AppRouter.navigateTo(item.deepLink!);
  }
});
```

### 5. In-App Bell Notification System

The SDK provides ready-to-use models and streams so consuming apps can build custom bell interfaces:

#### A. Bell Icon with Unread Badge in AppBar:

```dart
AppBar(
  title: const Text('FileZen'),
  actions: [
    WapBellBadge(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
        );
      },
    ),
  ],
)
```

#### B. Notification Center Feed Screen:

```dart
class NotificationCenterScreen extends StatelessWidget {
  const NotificationCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark All Read',
            onPressed: () => WapNotifications.markAllAsRead(),
          ),
        ],
      ),
      body: FutureBuilder<List<WapNotification>>(
        future: WapNotifications.notifications(refresh: true),
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final items = snapshot.data!;
          if (items.isEmpty) return const Center(child: Text('No notifications'));

          return ListView.builder(
            itemCount: items.length,
            itemBuilder: (context, i) {
              final item = items[i];
              return ListTile(
                leading: Icon(
                  item.category == NotificationCategory.security
                      ? Icons.security
                      : Icons.notifications,
                  color: item.isRead ? Colors.grey : Colors.blue,
                ),
                title: Text(item.title, style: TextStyle(fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold)),
                subtitle: Text(item.message),
                onTap: () async {
                  await WapNotifications.markAsRead(item.id);
                  if (item.deepLink != null) {
                    AppRouter.navigateTo(item.deepLink!);
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}
```

### 6. Notification Categories & User Opt-Outs

The platform supports 8 standardized categories:

| Category | Description | Mandatory (Can Opt-out?) |
|---|---|---|
| `SYSTEM` | Operational notices | **Yes (Mandatory - Always delivered)** |
| `IMPORTANT` | Important account or security notices | No (Opt-out allowed) |
| `SECURITY` | Security alerts & password changes | **Yes (Mandatory - Always delivered)** |
| `UPDATE` | App updates and patch releases | No (Opt-out allowed) |
| `FEATURE` | Product feature announcements | No (Opt-out allowed) |
| `PROMOTION` | Special offers and discounts | No (Opt-out allowed) |
| `MAINTENANCE` | Downtime and scheduled maintenance | **Yes (Mandatory - Always delivered)** |
| `CUSTOM` | App-specific custom alerts | No (Opt-out allowed) |

Users can manage opt-outs in their app settings:

```dart
// Fetch preferences
final prefs = await WapNotifications.getPreferences();

// Toggle off promotional alerts
await WapNotifications.updatePreferences(
  prefs.copyWith(promotionalEnabled: false),
);
```

### 7. Emergency Kill Switches

WAPCentral provides multi-tier kill switches controlled in real-time from the Dashboard:
- **Global Kill Switch (`globalNotificationsOff`)**: Instantly silences all push notifications and clears the bell feed across all apps.
- **App Kill Switch (`appKillSwitches.<appId>`)**: Silences notifications exclusively for the affected app.
- **Category Kill Switch (`categoryKillSwitches.<category>`)**: Silences specific categories across all apps.

The SDK detects kill switch activations automatically without app updates or crashes.

### 8. User Logout

Unregister the device when a user logs out to prevent cross-account push leakage:

```dart
await WapNotifications.unregisterDevice();
```

---

## Section K: Dashboard Configuration

All ad parameters are configured in the WAPCentral Console:

1. Navigate to **https://wapcentral.webappypie.com** and log in with your Admin credentials.
2. Go to **Ads & Monetization Control Center** (`/ads`).
3. Select your application from the **App Selector** dropdown.
4. Customize each format independently:
   - **Tiers Waterfall**: Drag and drop AdMob, Meta, AppLovin, and Custom Ads to adjust priority.
   - **Ad Unit Mapping**: Enter provider placement IDs for Android and iOS.
   - **Frequency & Cooldown**: Set cooldown interval (seconds), session cap, and daily cap.
   - **Content Safety**: Enforce category exclusions (gambling, adult, violence, etc.).
   - **Fallback Creatives**: Configure active WebAppyPie Custom Ad campaigns.
5. Click **Save Configuration**. The changes are committed with an updated SHA-256 version hash and immediately pushed to mobile apps on their next sync cycle.

---

## Section L: What Can Be Controlled From WAPCentral

Everything critical to monetization is controlled remotely without app updates:

| Dimension | Control Capabilities |
|---|---|
| **Master Ads Switch** | Turn all ads ON or OFF across the entire application instantly. |
| **Format Switches** | Independently toggle Banner, Native, Interstitial, Rewarded, App Open, or Rewarded Interstitial. |
| **Mediation Priority** | Re-order provider waterfalls (e.g., promote AppLovin to Tier 1 during high eCPM campaigns). |
| **Provider Availability** | Disable a specific ad network (e.g., disable Meta if an SDK issue occurs). |
| **Refresh Intervals** | Modify banner refresh time (from 30s to 180s). |
| **Frequency Pacing** | Tighten or loosen session/daily impression caps and interstitial cooldowns. |
| **Content Safety** | Exclude prohibited advertising categories. |
| **Custom Ads Inventory** | Launch house campaigns, modify banner images, update CTA text, and change target URLs. |
| **Emergency Kill Switches** | Instant multi-layer kill switches taking effect in seconds. |

---

## Section M: Firebase Requirements

Consuming apps that also utilize Firebase for authentication or crash reporting must ensure:
1. **Google Services**: Include `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) in their standard locations.
2. **No Firestore Dependency for Ads**: `wap_ads_sdk` does **NOT** require Firebase Firestore or Firebase Auth on the client. It communicates with WAPCentral via standard HTTPS REST endpoints.
3. **No Credential Collisions**: Firebase API keys used for client apps must remain restricted to client scopes in Google Cloud Console.

---

## Section N: Android Requirements

1. **Minimum SDK**: In `android/app/build.gradle`:
   ```groovy
   minSdkVersion 21
   targetSdkVersion 34
   ```

2. **Internet Permission**: In `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.INTERNET"/>
   <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
   ```

3. **Google Mobile Ads App ID**:
   Add the public AdMob App ID inside the `<application>` tag:
   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-3940256099942544~3347511713"/> <!-- Test or registered App ID -->
   ```

4. **ProGuard / R8 Rules** (if code obfuscation is enabled):
   In `android/app/proguard-rules.pro`:
   ```proguard
   -keep class com.google.android.gms.ads.** { *; }
   -keep class com.facebook.ads.** { *; }
   -keep class com.applovin.** { *; }
   ```

---

## Section O: iOS Requirements

1. **Deployment Target**: iOS 13.0 or higher in `ios/Podfile`:
   ```ruby
   platform :ios, '13.0'
   ```

2. **Info.plist Configuration**: In `ios/Runner/Info.plist`:
   ```xml
   <key>GADApplicationIdentifier</key>
   <string>ca-app-pub-3940256099942544~1458002511</string> <!-- Test or registered App ID -->
   <key>SKAdNetworkItems</key>
   <array>
       <!-- AdMob SKAdNetwork identifiers -->
       <dict>
           <key>SKAdNetworkIdentifier</key>
           <string>cstr6suwn9.skadnetwork</string>
       </dict>
   </array>
   ```

3. **App Tracking Transparency (ATT)**:
   If your app requests IDFA tracking on iOS 14.5+, present the ATT dialog prior to requesting personalized ads.

---

## Section P: Test Mode

During development and QA testing:
1. Initialize `WapAds` with `testMode: true`:
   ```dart
   WapAdsOptions(
     appId: 'filezen-android',
     appKey: 'wap_pub_test_staging_credential',
     testMode: true,
     ...
   )
   ```
2. In test mode:
   - AdMob uses standard Google sample ad unit IDs (`ca-app-pub-3940256099942544/6300978111`, etc.).
   - Simulated views render distinct "TEST AD" badges.
   - Impressions and clicks do not generate real revenue and prevent account policy strikes.

---

## Section Q: Production Mode

For production App Store and Google Play releases:
1. Ensure `testMode: false` in `WapAdsOptions`.
2. Supply a production client key (`wap_pub_live_...`).
3. Ensure client manifest AdMob App IDs match your live Google AdMob console.
4. Verify WAPCentral mediation waterfalls are populated with live Ad Unit IDs.

---

## Section R: Offline Behavior & Resilience

`wap_ads_sdk` is engineered with an **offline-first resilience model**:

1. **Cached Configuration**: The last valid configuration is stored in local memory and disk cache. On subsequent launches without internet, the cached configuration governs ad behaviors.
2. **Graceful Fail-Safe**: If the app is launched in airplane mode with no cache, `WapAds` boots into a safe disabled state. No exceptions are thrown, and no blank visual spaces are rendered.
3. **No UI Disruption**: Ad widgets (`WapAds.banner`, `WapAds.native`) collapse safely (`SizedBox.shrink()`) if ads cannot be filled.
4. **Offline Telemetry**: Telemetry failures do not interrupt user interactions or crash background workers.

---

## Section S: Kill Switches & Emergency Procedures

WAPCentral provides five layers of emergency kill switches accessible via dashboard or API:

```
[Level 1] GLOBAL KILL SWITCH (globalAdsOff: true)
   └─► Overrides everything; suppresses all ads across all apps instantly.

[Level 2] APP KILL SWITCH (appEnabled: false / masterAdsOff: true)
   └─► Suppresses all ads for a specific application.

[Level 3] NETWORK KILL SWITCH (networkDisabled: true)
   └─► Removes a specific network (e.g. Meta) from all waterfalls; cascades to next tier.

[Level 4] FORMAT KILL SWITCH (formatEnabled: false)
   └─► Disables a single format (e.g., disable Interstitial while keeping Banner active).

[Level 5] PLACEMENT KILL SWITCH (placementEnabled: false)
   └─► Disables a specific placement key without affecting other placements.
```

When a kill switch activates, `WapAds` immediately suppresses ad rendering and rejects fullscreen requests with `AdErrorCode.globalKillSwitch` or `AdErrorCode.appKillSwitch`.

---

## Section T: Troubleshooting & Diagnostic Guide

### 1. Banner Shows Blank Space / Does Not Render
- **Check Master Toggle**: Verify in WAPCentral Dashboard that Ads Master and Banner toggles are ON.
- **Check Placement Key**: Verify `placementKey` matches the key configured in the dashboard.
- **Check Waterfall Exhaustion**: If all third-party networks return "No Fill", ensure a WebAppyPie Custom Ad fallback campaign is active.

### 2. Interstitial / Rewarded Ad Fails with `cooldownActive`
- **Cause**: The server-configured cooldown interval has not elapsed since the last ad impression.
- **Remedy**: Respect the cooldown period or adjust the cooldown duration in WAPCentral Dashboard $\rightarrow$ Format Frequency.

### 3. Rewarded Ad Does Not Grant Perk
- **Cause**: The user closed the ad before the completion threshold, or the provider callback did not verify completion.
- **Remedy**: Verify `result.rewardGranted == true` before awarding items. Never grant rewards on `onAdDismissed` alone.

### 4. SDK Throws 401 / 403 on Init
- **Check Headers**: Verify `appId` and `appKey` are valid and correspond to the targeted WAPCentral environment.

---

## Section U: Security Rules

1. **Client-Safe Public Keys Only**: Only use `wap_pub_...` tokens in client mobile code.
2. **Never Check In Secrets**: Provider API secrets, private keys, service account credentials, and Cloud Run admin tokens must **NEVER** exist in mobile repositories.
3. **HTTPS Enforcement**: All communication with WAPCentral occurs exclusively over TLS 1.3/1.2.
4. **No Sensitive Telemetry**: Telemetry events report strictly placement keys, provider names, and timestamps. Never include user PII, email addresses, or device identifiers.

---

## Section V: Things Developers MUST NOT Hard-Code

❌ **DO NOT** hard-code AdMob Unit IDs in Dart code.  
❌ **DO NOT** hard-code Meta Placement IDs in Dart code.  
❌ **DO NOT** hard-code AppLovin SDK keys in Dart code.  
❌ **DO NOT** hard-code mediation waterfall priority lists in Dart code.  
❌ **DO NOT** hard-code banner refresh intervals (e.g., `Timer.periodic(10s)`).  
❌ **DO NOT** hard-code ad frequency or cooldown limits in Dart code.  
❌ **DO NOT** hard-code house promo banners or destination URLs in Dart code.  

---

## Section W: Things Developers MUST NOT Modify

Consuming app developers must **NOT** alter the following core SDK behaviors:
- Do not bypass `FrequencyManager` checks to display rapid back-to-back interstitials.
- Do not bypass the $\ge 30\text{s}$ safe banner refresh clamp.
- Do not award rewarded perks without checking `rewardGranted == true`.
- Do not modify or spoof the `X-App-Id` or `X-App-Key` headers.
- Do not catch and suppress kill-switch events to force ad display.

---

## Section X: Production Release Checklist

Before submitting an app update to Google Play or Apple App Store:

- [ ] App is registered in WAPCentral Console with correct package name/bundle ID.
- [ ] Production public key (`wap_pub_live_...`) is configured via `--dart-define` or secure build config.
- [ ] `testMode` is set to `false`.
- [ ] WAPCentral Base URL points to live production endpoint (`https://api.wapcentral.webappypie.com`).
- [ ] AndroidManifest contains valid AdMob Application ID `<meta-data>`.
- [ ] iOS Info.plist contains valid `GADApplicationIdentifier` and `SKAdNetworkItems`.
- [ ] ProGuard rules are present in `android/app/proguard-rules.pro`.
- [ ] Fallback WebAppyPie Custom Ad campaigns are configured in WAPCentral.
- [ ] App Open ad background duration complies with platform policies ($\ge 30\text{s}$).
- [ ] Tested offline launch behavior: app starts cleanly without crashes when airplane mode is on.
- [ ] Verified kill-switch response: app instantly hides ads when kill switch is toggled.

---

## Section Y: Complete Example Integration for a New App

Here is an end-to-end, copy-pasteable example integrating `wap_ads_sdk` into a brand new application:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:wap_ads_sdk/wap_ads.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize WAP Ads SDK
  await WapAds.initialize(
    options: WapAdsOptions(
      appId: 'filezen-android',
      appKey: const String.fromEnvironment(
        'WAP_PUBLIC_APP_KEY',
        defaultValue: 'wap_pub_live_filezen_sample',
      ),
      baseUrl: 'https://api.wapcentral.webappypie.com',
      environment: WapEnvironment.production,
      testMode: false,
      autoRefreshConfig: true,
      refreshInterval: const Duration(minutes: 15),
    ),
  );

  runApp(const FileZenApp());
}

class FileZenApp extends StatelessWidget {
  const FileZenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FileZen',
      theme: ThemeData(primarySwatch: Colors.indigo, useMaterial3: true),
      home: const FileZenHomeScreen(),
    );
  }
}

class FileZenHomeScreen extends StatefulWidget {
  const FileZenHomeScreen({super.key});

  @override
  State<FileZenHomeScreen> createState() => _FileZenHomeScreenState();
}

class _FileZenHomeScreenState extends State<FileZenHomeScreen> with WidgetsBindingObserver {
  int _bonusStorageMb = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Trigger App Open ad on resume
      WapAds.showAppOpen(placementKey: 'app_resume_open');
    }
  }

  // Interstitial example
  Future<void> _handleFileCompress() async {
    // Show interstitial before or after file action
    final result = await WapAds.showInterstitial(
      placementKey: 'compress_done_interstitial',
    );
    debugPrint('Interstitial result: ${result.success}');

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('File compressed successfully!')),
    );
  }

  // Rewarded ad example
  Future<void> _handleGetBonusStorage() async {
    final result = await WapAds.showRewarded(
      placementKey: 'extra_storage_rewarded',
    );

    if (!mounted) return;

    if (result.rewardGranted) {
      setState(() {
        _bonusStorageMb += (result.rewardAmount ?? 100).toInt();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Reward granted! +${result.rewardAmount} MB added.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No reward: ${result.error?.message ?? "Ad was skipped"}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FileZen — My Files')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              title: const Text('Storage Balance'),
              subtitle: Text('Bonus Storage: $_bonusStorageMb MB'),
              trailing: ElevatedButton.icon(
                icon: const Icon(Icons.card_giftcard),
                label: const Text('Get +100MB'),
                onPressed: _handleGetBonusStorage,
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: const Icon(Icons.archive),
            label: const Text('Compress Files (Shows Interstitial)'),
            onPressed: _handleFileCompress,
          ),
          const SizedBox(height: 24),
          const Text(
            'Sponsored Recommendation',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          // Embedded Native Ad
          WapAds.native(
            placementKey: 'home_feed_native',
            builder: (context, creative) {
              return Card(
                color: Colors.grey.shade100,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (creative.iconUrl != null)
                            Image.network(creative.iconUrl!, width: 40, height: 40),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              creative.title,
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade200,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('AD', style: TextStyle(fontSize: 10)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(creative.body),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: ElevatedButton(
                          onPressed: creative.performClick,
                          child: Text(creative.callToAction),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
      // Embedded Banner Ad
      bottomNavigationBar: SafeArea(
        child: SizedBox(
          height: 60,
          child: WapAds.banner(
            placementKey: 'home_screen_footer_banner',
          ),
        ),
      ),
    );
  }
}
```
