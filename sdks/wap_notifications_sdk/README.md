# WAP Notifications SDK (`wap_notifications_sdk`)

> **Production-grade Centralized Push & Bell Notification Package for WebAppyPie Flutter Applications.**

`wap_notifications_sdk` connects WebAppyPie mobile apps (FileZen, OptiLens AI, and future apps) with **WAPCentral** for unified push delivery (via Firebase Cloud Messaging) and in-app bell notification management.

---

## 🚀 Key Features

- **Decoupled Architecture**: No Firebase Admin credentials or server secrets in client applications.
- **FCM Device Registration**: Automatic token sync, token refresh, and user ID association.
- **In-App Bell System**: Unread count badges, notification feeds, mark as read, mark all read.
- **Stream Reactive State**: Realtime broadcast streams for unread badge counters, new push items, and notification taps.
- **Category-Based Opt-outs**: Supports granular notification categories (SYSTEM, IMPORTANT, SECURITY, UPDATE, FEATURE, PROMOTION, MAINTENANCE, CUSTOM) with mandatory category bypass protection.
- **Deep Link Navigation**: Universal routing for rich push actions.
- **Multi-Level Kill Switches**: Global, app-level, and category-level suppression without crashing apps.
- **Offline Resilient**: Local caching ensures UI responsiveness even if WAPCentral or the network is momentarily unavailable.

---

## 📦 Installation

Add `wap_notifications_sdk` to your Flutter app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  wap_notifications_sdk:
    path: ../../sdks/wap_notifications_sdk # or hosted package version
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
```

---

## 🛠 Platform Setup

### 1. Android Configuration (`android/app/src/main/AndroidManifest.xml`)

Add the required permissions and notification channel metadata:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <application ...>
        <!-- Default Notification Channel -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="wap_default_channel" />
    </application>
</manifest>
```

### 2. iOS Configuration (`ios/Runner/Info.plist`)

Enable Remote Notifications in Capabilities:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
</array>
```

---

## 🚀 Usage Guide

### 1. Initialize the SDK

Call `WapNotifications.initialize` in your app's `main()` function:

```dart
import 'package:flutter/material.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await WapNotifications.initialize(
    const WapNotificationsOptions(
      appId: 'filezen', // Registered app ID in WAPCentral
      appKey: 'wap_key_filezen_prod', // Public app client credential
      baseUrl: 'https://api.wapcentral.io',
      environment: 'production',
      enableLogging: false,
    ),
  );

  runApp(const MyApp());
}
```

---

### 2. Register FCM Device Token

When FCM yields a registration token (or on token refresh):

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

Future<void> setupPushNotifications(String? currentUserId) async {
  final messaging = FirebaseMessaging.instance;

  // Request permissions (iOS & Android 13+)
  final settings = await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  if (settings.authorizationStatus == AuthorizationStatus.authorized) {
    final token = await messaging.getToken();
    if (token != null) {
      await WapNotifications.registerDevice(
        fcmToken: token,
        platform: Theme.of(context).platform == TargetPlatform.iOS ? 'ios' : 'android',
        userId: currentUserId,
        appVersion: '2.1.0',
      );
    }

    // Handle token refresh
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
      WapNotifications.registerDevice(
        fcmToken: newToken,
        userId: currentUserId,
      );
    });
  }
}
```

---

### 3. Handle Incoming Push Notifications

Forward FCM messages to `WapNotifications`:

```dart
// Foreground messages
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  WapNotifications.handleForegroundMessage(message.toMap());
});

// App opened from notification tap
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  WapNotifications.handleNotificationTapped(message.toMap());
});

// Listen to tap stream for deep linking
WapNotifications.onNotificationTapped.listen((WapNotification notification) {
  if (notification.deepLink != null) {
    AppRouter.navigateTo(notification.deepLink!);
  }
});
```

---

### 4. In-App Bell Notification System

#### A. Add the Bell Badge to your AppBar:

```dart
AppBar(
  title: const Text('FileZen'),
  actions: [
    WapBellBadge(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        );
      },
    ),
  ],
)
```

#### B. Display the Notification List:

```dart
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all as read',
            onPressed: () => WapNotifications.markAllAsRead(),
          ),
        ],
      ),
      body: FutureBuilder<List<WapNotification>>(
        future: WapNotifications.notifications(refresh: true),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final list = snapshot.data!;
          if (list.isEmpty) {
            return const Center(child: Text('No notifications yet.'));
          }

          return ListView.builder(
            itemCount: list.length,
            itemBuilder: (context, index) {
              final item = list[index];
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: item.isRead ? Colors.grey[300] : Colors.blue[100],
                  child: Icon(
                    item.category == NotificationCategory.security
                        ? Icons.security
                        : Icons.notifications,
                    color: item.isRead ? Colors.grey : Colors.blue,
                  ),
                ),
                title: Text(
                  item.title,
                  style: TextStyle(
                    fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold,
                  ),
                ),
                subtitle: Text(item.message),
                trailing: Text(
                  item.createdAt != null
                      ? '${item.createdAt!.hour}:${item.createdAt!.minute.toString().padLeft(2, '0')}'
                      : '',
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
                ),
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

---

### 5. Notification Preferences & Opt-outs

Let users control which categories they receive:

```dart
// Fetch preferences
final prefs = await WapNotifications.getPreferences();

// Update preferences (promotions toggled off)
await WapNotifications.updatePreferences(
  prefs.copyWith(
    promotionalEnabled: false,
    categories: {
      'PROMOTION': false,
      'UPDATE': true,
    },
  ),
);

// Note: Mandatory categories (SYSTEM, SECURITY, MAINTENANCE) are always enforced.
```

---

### 6. User Logout

Unregister device when user logs out:

```dart
await WapNotifications.unregisterDevice();
```

---

## 🔒 Security Principles

1. **No Admin Credentials**: The SDK communicates only with WAPCentral Platform API (`/api/platform/v1/notifications/...`) using the app's public client key.
2. **Server-Side FCM Authority**: FCM access tokens and server credentials remain strictly on WAPCentral Cloud Run.
3. **Emergency Kill Switches**: If `globalNotificationsOff` or `appKillSwitch` is activated in the WAPCentral Dashboard, notifications are silenced immediately on devices.

---

## 🧪 Testing

Run automated tests:

```bash
flutter test
```
