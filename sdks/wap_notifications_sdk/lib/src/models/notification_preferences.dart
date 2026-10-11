import 'notification_category.dart';

/// User notification preferences per app.
class NotificationPreferences {
  const NotificationPreferences({
    this.notificationsEnabled = true,
    this.promotionalEnabled = true,
    this.soundEnabled = true,
    this.badgeEnabled = true,
    this.categories = const {},
  });

  final bool notificationsEnabled;
  final bool promotionalEnabled;
  final bool soundEnabled;
  final bool badgeEnabled;
  final Map<String, bool> categories;

  /// Returns whether notifications for a specific category are allowed.
  /// Mandatory categories (SYSTEM, SECURITY, MAINTENANCE) cannot be opted out.
  bool isCategoryEnabled(NotificationCategory category) {
    if (category.isMandatory) return true;
    if (!notificationsEnabled) return false;
    if (category == NotificationCategory.promotion && !promotionalEnabled) {
      return false;
    }
    return categories[category.code] ?? true;
  }

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    return NotificationPreferences(
      notificationsEnabled: json['notificationsEnabled'] as bool? ?? true,
      promotionalEnabled: json['promotionalEnabled'] as bool? ?? true,
      soundEnabled: json['soundEnabled'] as bool? ?? true,
      badgeEnabled: json['badgeEnabled'] as bool? ?? true,
      categories: json['categories'] is Map
          ? (json['categories'] as Map).map(
              (k, v) => MapEntry(k.toString(), v == true),
            )
          : const {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notificationsEnabled': notificationsEnabled,
      'promotionalEnabled': promotionalEnabled,
      'soundEnabled': soundEnabled,
      'badgeEnabled': badgeEnabled,
      'categories': categories,
    };
  }

  NotificationPreferences copyWith({
    bool? notificationsEnabled,
    bool? promotionalEnabled,
    bool? soundEnabled,
    bool? badgeEnabled,
    Map<String, bool>? categories,
  }) {
    return NotificationPreferences(
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      promotionalEnabled: promotionalEnabled ?? this.promotionalEnabled,
      soundEnabled: soundEnabled ?? this.soundEnabled,
      badgeEnabled: badgeEnabled ?? this.badgeEnabled,
      categories: categories ?? this.categories,
    );
  }
}
