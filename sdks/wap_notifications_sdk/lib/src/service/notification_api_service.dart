import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/wap_notifications_options.dart';
import '../models/device_registration.dart';
import '../models/notification_config.dart';
import '../models/notification_preferences.dart';
import '../models/wap_notification.dart';

/// HTTP Client for WAPCentral Notifications Platform API.
class NotificationApiService {
  NotificationApiService({
    required this.options,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final WapNotificationsOptions options;
  final http.Client _httpClient;

  Map<String, String> _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-app-id': options.appId,
      'x-app-key': options.appKey,
      'x-wap-app-id': options.appId,
      'x-wap-app-key': options.appKey,
      'x-wap-request-id': 'req_${DateTime.now().millisecondsSinceEpoch}',
    };
  }

  void _log(String message) {
    if (options.enableLogging) {
      // ignore: avoid_print
      print('[WapNotifications SDK] $message');
    }
  }

  /// Fetches the effective notification configuration for this app.
  Future<NotificationConfig> fetchConfig() async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/config');
    _log('Fetching config from $uri');

    try {
      final response = await _httpClient.get(uri, headers: _buildHeaders());
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] is Map ? body['data'] as Map<String, dynamic> : body;
        return NotificationConfig.fromJson(data);
      }
      _log('Fetch config error: HTTP ${response.statusCode}');
      return NotificationConfig.fallback;
    } catch (e) {
      _log('Fetch config exception: $e');
      return NotificationConfig.fallback;
    }
  }

  /// Registers an FCM device token with WAPCentral.
  Future<bool> registerDevice(DeviceRegistration registration) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/devices/register');
    _log('Registering device token at $uri');

    try {
      final response = await _httpClient.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode(registration.toJson()),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      _log('Register device exception: $e');
      return false;
    }
  }

  /// Unregisters an FCM device token (e.g. on user logout).
  Future<bool> unregisterDevice({required String deviceId, String? fcmToken}) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/devices/unregister');
    _log('Unregistering device at $uri');

    try {
      final response = await _httpClient.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode({
          'deviceId': deviceId,
          if (fcmToken != null) 'fcmToken': fcmToken,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      _log('Unregister device exception: $e');
      return false;
    }
  }

  /// Fetches in-app bell notifications for this app/device.
  Future<List<WapNotification>> fetchBellNotifications({
    String? deviceId,
    String? userId,
    int limit = 50,
    bool unreadOnly = false,
  }) async {
    final queryParams = {
      'limit': limit.toString(),
      if (deviceId != null) 'deviceId': deviceId,
      if (userId != null) 'userId': userId,
      if (unreadOnly) 'unreadOnly': 'true',
    };

    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications')
        .replace(queryParameters: queryParams);
    _log('Fetching bell notifications from $uri');

    try {
      final response = await _httpClient.get(uri, headers: _buildHeaders());
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final items = body['data'] is List
            ? body['data'] as List<dynamic>
            : (body['notifications'] is List ? body['notifications'] as List<dynamic> : []);

        return items
            .whereType<Map<String, dynamic>>()
            .map((item) => WapNotification.fromJson(item))
            .toList();
      }
      return [];
    } catch (e) {
      _log('Fetch bell notifications exception: $e');
      return [];
    }
  }

  /// Fetches unread notification count for the bell icon badge.
  Future<int> fetchUnreadCount({String? deviceId, String? userId}) async {
    final queryParams = {
      if (deviceId != null) 'deviceId': deviceId,
      if (userId != null) 'userId': userId,
    };

    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/unread-count')
        .replace(queryParameters: queryParams);

    try {
      final response = await _httpClient.get(uri, headers: _buildHeaders());
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] is Map ? body['data'] as Map<String, dynamic> : body;
        return (data['unreadCount'] as num?)?.toInt() ?? 0;
      }
      return 0;
    } catch (e) {
      _log('Fetch unread count exception: $e');
      return 0;
    }
  }

  /// Marks a specific notification as read.
  Future<bool> markAsRead(String notificationId, {String? deviceId, String? userId}) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/$notificationId/read');

    try {
      final response = await _httpClient.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode({
          if (deviceId != null) 'deviceId': deviceId,
          if (userId != null) 'userId': userId,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      _log('Mark as read exception: $e');
      return false;
    }
  }

  /// Marks all notifications as read.
  Future<bool> markAllAsRead({String? deviceId, String? userId}) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/read-all');

    try {
      final response = await _httpClient.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode({
          if (deviceId != null) 'deviceId': deviceId,
          if (userId != null) 'userId': userId,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      _log('Mark all read exception: $e');
      return false;
    }
  }

  /// Fetches notification preferences.
  Future<NotificationPreferences> fetchPreferences({String? deviceId, String? userId}) async {
    final queryParams = {
      if (deviceId != null) 'deviceId': deviceId,
      if (userId != null) 'userId': userId,
    };

    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/preferences')
        .replace(queryParameters: queryParams);

    try {
      final response = await _httpClient.get(uri, headers: _buildHeaders());
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final data = body['data'] is Map ? body['data'] as Map<String, dynamic> : body;
        return NotificationPreferences.fromJson(data);
      }
      return const NotificationPreferences();
    } catch (e) {
      _log('Fetch preferences exception: $e');
      return const NotificationPreferences();
    }
  }

  /// Updates notification preferences.
  Future<bool> updatePreferences({
    required NotificationPreferences preferences,
    String? deviceId,
    String? userId,
  }) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/preferences');

    try {
      final response = await _httpClient.put(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode({
          ...preferences.toJson(),
          if (deviceId != null) 'deviceId': deviceId,
          if (userId != null) 'userId': userId,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      _log('Update preferences exception: $e');
      return false;
    }
  }

  /// Tracks notification delivery or open interaction.
  Future<bool> trackEvent({
    required String notificationId,
    required String deviceId,
    required String event, // 'delivered' | 'opened'
  }) async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/notifications/track');

    try {
      final response = await _httpClient.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode({
          'appId': options.appId,
          'notificationId': notificationId,
          'deviceId': deviceId,
          'event': event,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      _log('Track event exception: $e');
      return false;
    }
  }

  void dispose() {
    _httpClient.close();
  }
}
