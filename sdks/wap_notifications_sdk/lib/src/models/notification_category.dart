/// Standard categories for notifications in the WebAppyPie ecosystem.
enum NotificationCategory {
  system('SYSTEM', 'System operational messages and alerts', true),
  important('IMPORTANT', 'Important account or service notices', false),
  security('SECURITY', 'Security alerts and login notifications', true),
  update('UPDATE', 'Application updates and version releases', false),
  feature('FEATURE', 'New features and product announcements', false),
  promotion('PROMOTION', 'Promotional discounts and offers', false),
  maintenance('MAINTENANCE', 'Scheduled maintenance downtime alerts', true),
  custom('CUSTOM', 'App-specific custom events', false);

  const NotificationCategory(this.code, this.description, this.isMandatory);

  final String code;
  final String description;
  final bool isMandatory;

  static NotificationCategory fromString(String? value) {
    if (value == null) return NotificationCategory.system;
    final upper = value.toUpperCase();
    for (final cat in NotificationCategory.values) {
      if (cat.code == upper) return cat;
    }
    return NotificationCategory.custom;
  }
}
