import 'dart:async';
import 'src/core/wap_notifications_core.dart';
import 'src/core/wap_notifications_options.dart';
import 'src/models/device_registration.dart';
import 'src/models/notification_config.dart';
import 'src/models/notification_preferences.dart';
import 'src/models/wap_notification.dart';
import 'src/service/notification_api_service.dart';

// Public model and widget exports
export 'src/core/wap_notifications_options.dart';
export 'src/models/wap_notification.dart';
export 'src/models/notification_category.dart';
export 'src/models/notification_type.dart';
export 'src/models/notification_priority.dart';
export 'src/models/notification_preferences.dart';
export 'src/models/notification_config.dart';
export 'src/models/device_registration.dart';
export 'src/widgets/wap_bell_badge.dart';

/// Developer-facing API Facade for WAPCentral Central Notification Platform.
///
/// Example Usage:
/// ```dart
/// // 1. Initialize SDK
/// await WapNotifications.initialize(
///   WapNotificationsOptions(
///     appId: 'filezen',
///     appKey: 'wap_key_filezen_prod',
///   ),
/// );
///
/// // 2. Register FCM Device Token
/// await WapNotifications.registerDevice(
///   fcmToken: fcmToken,
///   platform: 'android',
///   userId: currentUser?.uid,
/// );
///
/// // 3. In-App Bell notifications
/// final unread = await WapNotifications.unreadCount();
/// final items = await WapNotifications.notifications();
///
/// // 4. User actions
/// await WapNotifications.markAsRead(item.id);
/// await WapNotifications.markAllAsRead();
/// ```
class WapNotifications {
  /// Initializes the WAP Notifications SDK with application credentials.
  static Future<void> initialize(
    WapNotificationsOptions options, {
    NotificationApiService? apiService,
  }) async {
    await WapNotificationsCore.instance.initialize(options, apiService: apiService);
  }

  /// Whether the SDK is fully initialized.
  static bool get isInitialized => WapNotificationsCore.instance.isInitialized;

  /// The active effective notification configuration and kill switch state.
  static NotificationConfig? get currentConfig =>
      WapNotificationsCore.instance.currentConfig;

  /// The active user notification preferences.
  static NotificationPreferences? get currentPreferences =>
      WapNotificationsCore.instance.currentPreferences;

  /// The active device ID in this session.
  static String? get currentDeviceId => WapNotificationsCore.instance.currentDeviceId;

  /// Registers or refreshes the FCM push token for this device with WAPCentral.
  static Future<bool> registerDevice({
    required String fcmToken,
    String platform = 'android',
    String? deviceId,
    String? userId,
    String? deviceModel,
    String? osVersion,
    String? appVersion,
    String? language,
    String? timezone,
    Map<String, dynamic>? metadata,
  }) async {
    return await WapNotificationsCore.instance.registerDevice(
      fcmToken: fcmToken,
      platform: platform,
      deviceId: deviceId,
      userId: userId,
      deviceModel: deviceModel,
      osVersion: osVersion,
      appVersion: appVersion,
      language: language,
      timezone: timezone,
      metadata: metadata,
    );
  }

  /// Unregisters the current device on logout.
  static Future<bool> unregisterDevice() async {
    return await WapNotificationsCore.instance.unregisterDevice();
  }

  /// Fetches in-app bell notification items.
  static Future<List<WapNotification>> notifications({
    bool refresh = false,
    bool unreadOnly = false,
  }) async {
    return await WapNotificationsCore.instance.notifications(
      refresh: refresh,
      unreadOnly: unreadOnly,
    );
  }

  /// Fetches the count of unread bell notifications for badging.
  static Future<int> unreadCount({bool refresh = false}) async {
    return await WapNotificationsCore.instance.unreadCount(refresh: refresh);
  }

  /// The synchronous cached count of unread bell notifications.
  static int get cachedUnreadCount =>
      WapNotificationsCore.instance.cachedUnreadCount;

  /// Marks a specific notification as read.
  static Future<bool> markAsRead(String id) async {
    return await WapNotificationsCore.instance.markAsRead(id);
  }

  /// Marks all notifications as read.
  static Future<bool> markAllAsRead() async {
    return await WapNotificationsCore.instance.markAllAsRead();
  }

  /// Hook to forward incoming FCM notifications received in foreground.
  static void handleForegroundMessage(Map<String, dynamic> fcmPayload) {
    WapNotificationsCore.instance.handleForegroundMessage(fcmPayload);
  }

  /// Hook to forward notification tap events (push or bell item click).
  static void handleNotificationTapped(Map<String, dynamic> fcmPayload) {
    WapNotificationsCore.instance.handleNotificationTapped(fcmPayload);
  }

  /// Tracks a notification opened event for analytics.
  static Future<void> trackNotificationOpened(String notificationId) async {
    await WapNotificationsCore.instance.trackNotificationOpened(notificationId);
  }

  /// Retrieves user notification category preferences.
  static Future<NotificationPreferences> getPreferences({bool refresh = false}) async {
    return await WapNotificationsCore.instance.getPreferences(refresh: refresh);
  }

  /// Updates user notification category preferences.
  static Future<bool> updatePreferences(NotificationPreferences preferences) async {
    return await WapNotificationsCore.instance.updatePreferences(preferences);
  }

  /// Forces a refresh of the effective configuration and kill switches from WAPCentral.
  static Future<NotificationConfig> refreshConfig() async {
    return await WapNotificationsCore.instance.refreshConfig();
  }

  /// Broadcast stream of unread bell notification count changes.
  static Stream<int> get unreadCountStream =>
      WapNotificationsCore.instance.unreadCountStream;

  /// Broadcast stream of bell notification list updates.
  static Stream<List<WapNotification>> get notificationsStream =>
      WapNotificationsCore.instance.notificationsStream;

  /// Broadcast stream triggered whenever an eligible notification arrives in foreground.
  static Stream<WapNotification> get onNotificationReceived =>
      WapNotificationsCore.instance.onNotificationReceived;

  /// Broadcast stream triggered whenever a notification is tapped by the user.
  static Stream<WapNotification> get onNotificationTapped =>
      WapNotificationsCore.instance.onNotificationTapped;
}
