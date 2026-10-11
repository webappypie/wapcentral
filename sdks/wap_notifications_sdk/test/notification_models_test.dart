import 'package:flutter_test/flutter_test.dart';
import 'package:wap_notifications_sdk/wap_notifications.dart';

void main() {
  group('NotificationCategory Tests', () {
    test('standard category properties and mandatory flags', () {
      expect(NotificationCategory.system.isMandatory, isTrue);
      expect(NotificationCategory.security.isMandatory, isTrue);
      expect(NotificationCategory.maintenance.isMandatory, isTrue);

      expect(NotificationCategory.promotion.isMandatory, isFalse);
      expect(NotificationCategory.feature.isMandatory, isFalse);
      expect(NotificationCategory.update.isMandatory, isFalse);
    });

    test('fromString fallback to custom', () {
      expect(NotificationCategory.fromString('SYSTEM'), equals(NotificationCategory.system));
      expect(NotificationCategory.fromString('promotion'), equals(NotificationCategory.promotion));
      expect(NotificationCategory.fromString('UNKNOWN_XYZ'), equals(NotificationCategory.custom));
      expect(NotificationCategory.fromString(null), equals(NotificationCategory.system));
    });
  });

  group('WapNotification Tests', () {
    test('serialization roundtrip and parsing', () {
      final notification = WapNotification(
        id: 'notif_123',
        title: 'New Update Available',
        message: 'Version 2.0 is live with AI features.',
        category: NotificationCategory.update,
        type: NotificationType.update,
        priority: NotificationPriority.high,
        deepLink: 'filezen://updates',
        isMandatory: false,
        dataPayload: {'version': '2.0.0'},
      );

      final json = notification.toJson();
      expect(json['id'], equals('notif_123'));
      expect(json['title'], equals('New Update Available'));
      expect(json['category'], equals('UPDATE'));
      expect(json['deepLink'], equals('filezen://updates'));

      final restored = WapNotification.fromJson(json);
      expect(restored.id, equals('notif_123'));
      expect(restored.category, equals(NotificationCategory.update));
      expect(restored.dataPayload['version'], equals('2.0.0'));
    });

    test('fromFcmPayload parses FCM RemoteMessage format correctly', () {
      final fcmPayload = {
        'notification': {
          'title': 'Security Alert',
          'body': 'New login detected on Windows',
          'image': 'https://example.com/shield.png',
        },
        'data': {
          'notificationId': 'sec_001',
          'category': 'SECURITY',
          'priority': 'urgent',
          'isMandatory': 'true',
          'deepLink': 'filezen://security/audit',
        },
      };

      final notif = WapNotification.fromFcmPayload(fcmPayload);
      expect(notif.id, equals('sec_001'));
      expect(notif.title, equals('Security Alert'));
      expect(notif.message, equals('New login detected on Windows'));
      expect(notif.category, equals(NotificationCategory.security));
      expect(notif.isMandatory, isTrue);
      expect(notif.imageUrl, equals('https://example.com/shield.png'));
      expect(notif.deepLink, equals('filezen://security/audit'));
    });
  });

  group('NotificationPreferences Tests', () {
    test('mandatory categories cannot be opted out', () {
      const prefs = NotificationPreferences(
        notificationsEnabled: false,
        promotionalEnabled: false,
        categories: {
          'SYSTEM': false,
          'SECURITY': false,
          'MAINTENANCE': false,
          'PROMOTION': false,
          'UPDATE': false,
        },
      );

      // Mandatory bypass
      expect(prefs.isCategoryEnabled(NotificationCategory.system), isTrue);
      expect(prefs.isCategoryEnabled(NotificationCategory.security), isTrue);
      expect(prefs.isCategoryEnabled(NotificationCategory.maintenance), isTrue);

      // Non-mandatory suppressed
      expect(prefs.isCategoryEnabled(NotificationCategory.promotion), isFalse);
      expect(prefs.isCategoryEnabled(NotificationCategory.update), isFalse);
    });

    test('promotional toggle respected', () {
      const prefs = NotificationPreferences(
        notificationsEnabled: true,
        promotionalEnabled: false,
      );

      expect(prefs.isCategoryEnabled(NotificationCategory.promotion), isFalse);
      expect(prefs.isCategoryEnabled(NotificationCategory.update), isTrue);
    });
  });

  group('NotificationConfig Tests', () {
    test('effective status with global kill switches', () {
      const configActive = NotificationConfig(
        enabled: true,
        globalNotificationsOff: false,
        appKillSwitch: false,
      );
      expect(configActive.isEffectiveActive, isTrue);
      expect(configActive.isCategoryKilled('PROMOTION'), isFalse);

      const configGlobalOff = NotificationConfig(
        enabled: true,
        globalNotificationsOff: true,
        appKillSwitch: false,
      );
      expect(configGlobalOff.isEffectiveActive, isFalse);
      expect(configGlobalOff.isCategoryKilled('PROMOTION'), isTrue);

      const configCategoryKilled = NotificationConfig(
        enabled: true,
        globalNotificationsOff: false,
        appKillSwitch: false,
        categoryKillSwitches: {'PROMOTION': true},
      );
      expect(configCategoryKilled.isEffectiveActive, isTrue);
      expect(configCategoryKilled.isCategoryKilled('PROMOTION'), isTrue);
      expect(configCategoryKilled.isCategoryKilled('SYSTEM'), isFalse);
    });
  });
}
