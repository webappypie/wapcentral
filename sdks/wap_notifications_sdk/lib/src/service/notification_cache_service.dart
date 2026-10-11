import '../models/device_registration.dart';
import '../models/notification_config.dart';
import '../models/notification_preferences.dart';
import '../models/wap_notification.dart';

/// In-memory and offline caching service for WAP Notifications SDK.
class NotificationCacheService {
  NotificationConfig? _cachedConfig;
  NotificationPreferences? _cachedPreferences;
  DeviceRegistration? _cachedRegistration;
  final List<WapNotification> _notifications = [];

  NotificationConfig? get config => _cachedConfig;
  NotificationPreferences? get preferences => _cachedPreferences;
  DeviceRegistration? get registration => _cachedRegistration;
  List<WapNotification> get notifications => List.unmodifiable(_notifications);

  void cacheConfig(NotificationConfig config) {
    _cachedConfig = config;
  }

  void cachePreferences(NotificationPreferences preferences) {
    _cachedPreferences = preferences;
  }

  void cacheRegistration(DeviceRegistration registration) {
    _cachedRegistration = registration;
  }

  void clearRegistration() {
    _cachedRegistration = null;
  }

  void setNotifications(List<WapNotification> items) {
    _notifications.clear();
    _notifications.addAll(items);
  }

  void addOrUpdateNotification(WapNotification notification) {
    final idx = _notifications.indexWhere((n) => n.id == notification.id);
    if (idx != -1) {
      _notifications[idx] = notification;
    } else {
      _notifications.insert(0, notification);
    }
  }

  void markAsRead(String id) {
    final idx = _notifications.indexWhere((n) => n.id == id);
    if (idx != -1) {
      _notifications[idx] = _notifications[idx].copyWith(
        isRead: true,
        readAt: DateTime.now(),
      );
    }
  }

  void markAllAsRead() {
    final now = DateTime.now();
    for (var i = 0; i < _notifications.length; i++) {
      if (!_notifications[i].isRead) {
        _notifications[i] = _notifications[i].copyWith(
          isRead: true,
          readAt: now,
        );
      }
    }
  }

  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  void clear() {
    _cachedConfig = null;
    _cachedPreferences = null;
    _cachedRegistration = null;
    _notifications.clear();
  }
}
