import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_notifications_sdk/src/core/wap_notifications_core.dart';
import 'package:wap_notifications_sdk/src/service/notification_api_service.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

void main() {
  group('WapNotifications Facade & Core Tests', () {
    late MockClient mockClient;

    setUp(() {
      WapNotificationsCore.instance.reset();

      mockClient = MockClient((request) async {
        final path = request.url.path;

        // 1. Config
        if (path.endsWith('/config')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'enabled': true,
                'globalNotificationsOff': false,
                'appKillSwitch': false,
                'supportedCategories': ['SYSTEM', 'UPDATE', 'PROMOTION'],
              },
            }),
            200,
          );
        }

        // 2. Device Register
        if (path.endsWith('/devices/register')) {
          return http.Response(jsonEncode({'success': true}), 200);
        }

        // 3. Device Unregister
        if (path.endsWith('/devices/unregister')) {
          return http.Response(jsonEncode({'success': true}), 200);
        }

        // 4. Bell Notifications List
        if (path == '/api/platform/v1/notifications') {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
                  'id': 'notif_1',
                  'title': 'Welcome to FileZen',
                  'message': 'Thanks for installing!',
                  'category': 'SYSTEM',
                  'isRead': false,
                },
                {
                  'id': 'notif_2',
                  'title': 'Holiday Sale',
                  'message': '50% off premium!',
                  'category': 'PROMOTION',
                  'isRead': true,
                },
              ],
            }),
            200,
          );
        }

        // 5. Unread Count
        if (path.endsWith('/unread-count')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'unreadCount': 1},
            }),
            200,
          );
        }

        // 6. Mark Read
        if (path.endsWith('/read') || path.endsWith('/read-all')) {
          return http.Response(jsonEncode({'success': true}), 200);
        }

        // 7. Track
        if (path.endsWith('/track')) {
          return http.Response(jsonEncode({'success': true}), 200);
        }

        // 8. Preferences
        if (path.endsWith('/preferences')) {
          if (request.method == 'GET') {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'notificationsEnabled': true,
                  'promotionalEnabled': true,
                },
              }),
              200,
            );
          } else {
            return http.Response(jsonEncode({'success': true}), 200);
          }
        }

        return http.Response('Not Found', 404);
      });
    });

    test('initializes SDK and fetches config and initial bell notifications', () async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
        enableLogging: false,
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      expect(WapNotifications.isInitialized, isTrue);
      expect(WapNotifications.currentConfig, isNotNull);
      expect(WapNotifications.currentConfig?.isEffectiveActive, isTrue);

      final items = await WapNotifications.notifications();
      expect(items.length, equals(2));
      expect(items.first.title, equals('Welcome to FileZen'));

      final unread = await WapNotifications.unreadCount();
      expect(unread, equals(1));
    });

    test('registers and unregisters device token', () async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      final regSuccess = await WapNotifications.registerDevice(
        fcmToken: 'fcm_mock_token_abc_123',
        platform: 'android',
        userId: 'user_456',
      );
      expect(regSuccess, isTrue);

      final unregSuccess = await WapNotifications.unregisterDevice();
      expect(unregSuccess, isTrue);
    });

    test('marks notification as read and updates streams', () async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      // Check initial unread
      expect(await WapNotifications.unreadCount(), equals(1));

      // Mark single item read
      final markRes = await WapNotifications.markAsRead('notif_1');
      expect(markRes, isTrue);
      expect(await WapNotifications.unreadCount(), equals(0));

      // Mark all read
      final markAllRes = await WapNotifications.markAllAsRead();
      expect(markAllRes, isTrue);
    });

    test('foreground message arrives and emits on stream', () async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      WapNotification? received;
      final sub = WapNotifications.onNotificationReceived.listen((n) {
        received = n;
      });

      WapNotifications.handleForegroundMessage({
        'notification': {'title': 'Foreground Push', 'body': 'Look here'},
        'data': {'notificationId': 'push_fg_1', 'category': 'UPDATE'},
      });

      await Future.delayed(const Duration(milliseconds: 10));
      expect(received, isNotNull);
      expect(received?.id, equals('push_fg_1'));
      expect(received?.title, equals('Foreground Push'));

      await sub.cancel();
    });

    test('notification tapped emits on onNotificationTapped stream', () async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      WapNotification? tapped;
      final sub = WapNotifications.onNotificationTapped.listen((n) {
        tapped = n;
      });

      WapNotifications.handleNotificationTapped({
        'data': {
          'notificationId': 'tap_01',
          'title': 'Deep Link Notice',
          'deepLink': 'filezen://settings',
        },
      });

      await Future.delayed(const Duration(milliseconds: 10));
      expect(tapped, isNotNull);
      expect(tapped?.id, equals('tap_01'));
      expect(tapped?.deepLink, equals('filezen://settings'));

      await sub.cancel();
    });

    testWidgets('WapBellBadge widget renders unread counter', (tester) async {
      final options = const WapNotificationsOptions(
        appId: 'filezen',
        appKey: 'wap_key_test_123',
        baseUrl: 'https://test.wapcentral.io',
      );

      final apiService = NotificationApiService(options: options, httpClient: mockClient);
      await WapNotifications.initialize(options, apiService: apiService);

      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: AppBar(
              actions: [
                WapBellBadge(
                  onTap: () {
                    tapped = true;
                  },
                ),
              ],
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Expect to find badge with '1' unread count
      expect(find.text('1'), findsOneWidget);

      // Tap the bell
      await tester.tap(find.byType(WapBellBadge));
      expect(tapped, isTrue);
    });
  });
}
