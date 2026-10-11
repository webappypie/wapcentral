# WAP App Setup Template

> **Security Notice**:  
> This file contains **safe environment variable templates and placeholders only**.  
> **NEVER** insert real production secrets, ad network private tokens, or backend service keys into client application repositories.

---

## 1. Client Environment Configuration (`.env.example` or Dart Defines)

Create an environment configuration file in your app project (or pass via Flutter `--dart-define` parameters):

```bash
# ==============================================================================
# WAPCentral Client Application Configuration Template
# ==============================================================================

# Application Identity (Registered in WAPCentral Console)
APP_NAME=MyApp
APP_ID=my-app-slug-android
APP_ENVIRONMENT=production

# WAPCentral Platform Service Endpoints
# Production: https://api.wapcentral.webappypie.com
# Staging:    https://staging-api.wapcentral.webappypie.com
WAPCENTRAL_BASE_URL=https://api.wapcentral.webappypie.com

# Public Client SDK Credential (Issued in WAPCentral Console)
# Format: wap_pub_live_<hash> or wap_pub_test_<hash>
# This key is client-safe and grants read-only access to public ad configs.
WAP_PUBLIC_APP_KEY=wap_pub_live_REPLACE_WITH_YOUR_PUBLIC_KEY

# Runtime Ad Behavior
WAP_ADS_TEST_MODE=false
WAP_ADS_AUTO_REFRESH=true
WAP_ADS_REFRESH_INTERVAL_MINUTES=15

# Runtime Notification Behavior
WAP_NOTIFICATIONS_ENABLED=true
WAP_NOTIFICATIONS_AUTO_FETCH_BELL=true
WAP_NOTIFICATIONS_REFRESH_INTERVAL_MINUTES=5
```

---

## 2. Flutter Run / Build Arguments

When building or launching your Flutter application, inject environment variables securely:

### Development / Staging:
```bash
flutter run \
  --dart-define=APP_ID=my-app-slug-android \
  --dart-define=APP_ENVIRONMENT=development \
  --dart-define=WAPCENTRAL_BASE_URL=https://staging-api.wapcentral.webappypie.com \
  --dart-define=WAP_PUBLIC_APP_KEY=wap_pub_test_staging_placeholder \
  --dart-define=WAP_ADS_TEST_MODE=true
```

### Production Release Build:
```bash
flutter build appbundle --release \
  --dart-define=APP_ID=my-app-slug-android \
  --dart-define=APP_ENVIRONMENT=production \
  --dart-define=WAPCENTRAL_BASE_URL=https://api.wapcentral.webappypie.com \
  --dart-define=WAP_PUBLIC_APP_KEY=wap_pub_live_REPLACE_WITH_YOUR_KEY \
  --dart-define=WAP_ADS_TEST_MODE=false
```

---

## 3. Platform Manifest Placeholders

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- Android 13+ Notification Permission -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <!-- Google Mobile Ads App ID (Placeholder - replace with your public App ID) -->
        <!-- Sample Test ID: ca-app-pub-3940256099942544~3347511713 -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-REPLACE_WITH_PUBLIC_APP_ID~REPLACE_ID" />

        <!-- Firebase Cloud Messaging Default Notification Channel -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="wap_default_channel" />
    </application>
</manifest>
```

### iOS (`ios/Runner/Info.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Google Mobile Ads App ID (Placeholder - replace with your public App ID) -->
    <!-- Sample Test ID: ca-app-pub-3940256099942544~1458002511 -->
    <key>GADApplicationIdentifier</key>
    <string>ca-app-pub-REPLACE_WITH_PUBLIC_APP_ID~REPLACE_ID</string>
    
    <key>SKAdNetworkItems</key>
    <array>
        <!-- Google AdMob SKAdNetwork Identifier -->
        <dict>
            <key>SKAdNetworkIdentifier</key>
            <string>cstr6suwn9.skadnetwork</string>
        </dict>
    </array>

    <!-- Remote Notifications Background Modes -->
    <key>UIBackgroundModes</key>
    <array>
        <string>fetch</string>
        <string>remote-notification</string>
    </array>
</dict>
</plist>
```

---

## 4. Initialization Code Snippet

```dart
// lib/core/platform_services.dart
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

Future<void> initWapPlatformServices() async {
  const appId = String.fromEnvironment('APP_ID', defaultValue: 'my-app-slug-android');
  const appKey = String.fromEnvironment('WAP_PUBLIC_APP_KEY', defaultValue: 'wap_pub_live_placeholder');
  const baseUrl = String.fromEnvironment('WAPCENTRAL_BASE_URL', defaultValue: 'https://api.wapcentral.webappypie.com');

  // 1. Initialize Ads SDK
  await WapAds.initialize(
    options: WapAdsOptions(
      appId: appId,
      appKey: appKey,
      baseUrl: baseUrl,
      testMode: const bool.fromEnvironment('WAP_ADS_TEST_MODE', defaultValue: false),
    ),
  );

  // 2. Initialize Central Notifications SDK
  await WapNotifications.initialize(
    const WapNotificationsOptions(
      appId: appId,
      appKey: appKey,
      baseUrl: baseUrl,
      autoFetchBell: true,
    ),
  );
}
```
