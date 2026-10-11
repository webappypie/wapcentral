import 'dart:async';
import '../models/device_registration.dart';
import '../models/notification_config.dart';
import '../models/notification_preferences.dart';
import '../models/wap_notification.dart';
import '../service/notification_api_service.dart';
import '../service/notification_cache_service.dart';
import 'wap_notifications_options.dart';

/// Core engine managing state, token sync, bell notifications, and streams.
class WapNotificationsCore {
  WapNotificationsCore._();

  static final WapNotificationsCore instance = WapNotificationsCore._();

  WapNotificationsOptions? _options;
  NotificationApiService? _apiService;
  final NotificationCacheService _cache = NotificationCacheService();

  bool _isInitialized = false;
  String? _currentDeviceId;
  String? _currentUserId;

  // Stream Controllers
  final StreamController<int> _unreadCountController =
      StreamController<int>.broadcast();
  final StreamController<List<WapNotification>> _notificationsController =
      StreamController<List<WapNotification>>.broadcast();
  final StreamController<WapNotification> _notificationReceivedController =
      StreamController<WapNotification>.broadcast();
  final StreamController<WapNotification> _notificationTappedController =
      StreamController<WapNotification>.broadcast();

  // Public Getters & Streams
  bool get isInitialized => _isInitialized;
  WapNotificationsOptions? get options => _options;
  NotificationConfig? get currentConfig => _cache.config;
  NotificationPreferences? get currentPreferences => _cache.preferences;
  String? get currentDeviceId => _currentDeviceId;

  Stream<int> get unreadCountStream => _unreadCountController.stream;
  int get cachedUnreadCount => _cache.unreadCount;
  Stream<List<WapNotification>> get notificationsStream =>
      _notificationsController.stream;
  Stream<WapNotification> get onNotificationReceived =>
      _notificationReceivedController.stream;
  Stream<WapNotification> get onNotificationTapped =>
      _notificationTappedController.stream;

  /// Initializes the notification engine.
  Future<void> initialize(
    WapNotificationsOptions options, {
    NotificationApiService? apiService,
  }) async {
    _options = options;
    _apiService = apiService ?? NotificationApiService(options: options);
    _currentDeviceId = options.deviceId ?? 'device_${DateTime.now().millisecondsSinceEpoch}';

    // 1. Fetch effective config
    final config = await _apiService!.fetchConfig();
    _cache.cacheConfig(config);

    _isInitialized = true;

    // 2. Initial bell fetch if enabled and not killed
    if (options.autoFetchBell && config.isEffectiveActive) {
      await refreshBellNotifications();
    }
  }

  /// Refreshes the effective remote configuration and kill-switch states.
  Future<NotificationConfig> refreshConfig() async {
    if (!_isInitialized || _apiService == null) {
      return NotificationConfig.fallback;
    }
    final config = await _apiService!.fetchConfig();
    _cache.cacheConfig(config);
    return config;
  }

  /// Registers an FCM token with WAPCentral.
  Future<bool> registerDevice({
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
    if (!_isInitialized || _apiService == null) return false;

    if (deviceId != null) {
      _currentDeviceId = deviceId;
    }
    if (userId != null) {
      _currentUserId = userId;
    }

    final reg = DeviceRegistration(
      deviceId: _currentDeviceId!,
      fcmToken: fcmToken,
      platform: platform,
      deviceModel: deviceModel,
      osVersion: osVersion,
      appVersion: appVersion,
      userId: _currentUserId,
      language: language,
      timezone: timezone,
      metadata: metadata,
    );

    _cache.cacheRegistration(reg);
    return await _apiService!.registerDevice(reg);
  }

  /// Unregisters the current device (e.g., on logout).
  Future<bool> unregisterDevice() async {
    if (!_isInitialized || _apiService == null || _currentDeviceId == null) {
      return false;
    }

    final success = await _apiService!.unregisterDevice(
      deviceId: _currentDeviceId!,
      fcmToken: _cache.registration?.fcmToken,
    );

    _cache.clearRegistration();
    _currentUserId = null;
    return success;
  }

  /// Refreshes in-app bell notifications from WAPCentral.
  Future<List<WapNotification>> refreshBellNotifications({bool unreadOnly = false}) async {
    if (!_isInitialized || _apiService == null) return [];

    // Check kill-switch
    if (_cache.config != null && !_cache.config!.isEffectiveActive) {
      _cache.setNotifications([]);
      _unreadCountController.add(0);
      _notificationsController.add([]);
      return [];
    }

    final items = await _apiService!.fetchBellNotifications(
      deviceId: _currentDeviceId,
      userId: _currentUserId,
      unreadOnly: unreadOnly,
    );

    _cache.setNotifications(items);
    _unreadCountController.add(_cache.unreadCount);
    _notificationsController.add(_cache.notifications);

    return _cache.notifications;
  }

  /// Returns current bell notifications (cached or refreshed).
  Future<List<WapNotification>> notifications({
    bool refresh = false,
    bool unreadOnly = false,
  }) async {
    if (refresh || _cache.notifications.isEmpty) {
      return await refreshBellNotifications(unreadOnly: unreadOnly);
    }

    if (unreadOnly) {
      return _cache.notifications.where((n) => !n.isRead).toList();
    }
    return _cache.notifications;
  }

  /// Returns the unread notification count.
  Future<int> unreadCount({bool refresh = false}) async {
    if (!_isInitialized || _apiService == null) return 0;

    if (_cache.config != null && !_cache.config!.isEffectiveActive) {
      return 0;
    }

    if (refresh) {
      final count = await _apiService!.fetchUnreadCount(
        deviceId: _currentDeviceId,
        userId: _currentUserId,
      );
      _unreadCountController.add(count);
      return count;
    }

    return _cache.unreadCount;
  }

  /// Marks a notification as read and updates streams.
  Future<bool> markAsRead(String id) async {
    if (!_isInitialized || _apiService == null) return false;

    _cache.markAsRead(id);
    _unreadCountController.add(_cache.unreadCount);
    _notificationsController.add(_cache.notifications);

    return await _apiService!.markAsRead(
      id,
      deviceId: _currentDeviceId,
      userId: _currentUserId,
    );
  }

  /// Marks all notifications as read and updates streams.
  Future<bool> markAllAsRead() async {
    if (!_isInitialized || _apiService == null) return false;

    _cache.markAllAsRead();
    _unreadCountController.add(0);
    _notificationsController.add(_cache.notifications);

    return await _apiService!.markAllAsRead(
      deviceId: _currentDeviceId,
      userId: _currentUserId,
    );
  }

  /// Call this when an FCM notification arrives while app is in foreground.
  void handleForegroundMessage(Map<String, dynamic> fcmPayload) {
    if (_cache.config != null && !_cache.config!.isEffectiveActive) {
      return; // Kill switch active
    }

    final notification = WapNotification.fromFcmPayload(fcmPayload);

    // Check category kill-switch & user preferences
    if (_cache.config?.isCategoryKilled(notification.category.code) == true) {
      return;
    }
    if (_cache.preferences != null &&
        !_cache.preferences!.isCategoryEnabled(notification.category)) {
      return;
    }

    _cache.addOrUpdateNotification(notification);
    _unreadCountController.add(_cache.unreadCount);
    _notificationsController.add(_cache.notifications);
    _notificationReceivedController.add(notification);

    // Track delivery
    if (_currentDeviceId != null && notification.id.isNotEmpty) {
      _apiService?.trackEvent(
        notificationId: notification.id,
        deviceId: _currentDeviceId!,
        event: 'delivered',
      );
    }
  }

  /// Call this when user taps a notification (from push notification tray or in-app bell).
  void handleNotificationTapped(Map<String, dynamic> fcmPayload) {
    final notification = WapNotification.fromFcmPayload(fcmPayload);
    _notificationTappedController.add(notification);

    if (notification.id.isNotEmpty) {
      markAsRead(notification.id);
      trackNotificationOpened(notification.id);
    }
  }

  /// Tracks notification opened metric in WAPCentral.
  Future<void> trackNotificationOpened(String notificationId) async {
    if (_apiService == null || _currentDeviceId == null) return;
    await _apiService!.trackEvent(
      notificationId: notificationId,
      deviceId: _currentDeviceId!,
      event: 'opened',
    );
  }

  /// Gets user notification preferences.
  Future<NotificationPreferences> getPreferences({bool refresh = false}) async {
    if (!_isInitialized || _apiService == null) {
      return const NotificationPreferences();
    }
    if (!refresh && _cache.preferences != null) {
      return _cache.preferences!;
    }

    final prefs = await _apiService!.fetchPreferences(
      deviceId: _currentDeviceId,
      userId: _currentUserId,
    );
    _cache.cachePreferences(prefs);
    return prefs;
  }

  /// Updates user notification preferences in WAPCentral.
  Future<bool> updatePreferences(NotificationPreferences preferences) async {
    if (!_isInitialized || _apiService == null) return false;

    _cache.cachePreferences(preferences);
    return await _apiService!.updatePreferences(
      preferences: preferences,
      deviceId: _currentDeviceId,
      userId: _currentUserId,
    );
  }

  void reset() {
    _cache.clear();
    _isInitialized = false;
    _options = null;
    _apiService?.dispose();
    _apiService = null;
    _currentDeviceId = null;
    _currentUserId = null;
  }
}
