/// Priority levels for notifications.
enum NotificationPriority {
  normal('normal'),
  high('high'),
  urgent('urgent');

  const NotificationPriority(this.value);

  final String value;

  static NotificationPriority fromString(String? val) {
    if (val == null) return NotificationPriority.normal;
    for (final p in NotificationPriority.values) {
      if (p.value == val.toLowerCase()) return p;
    }
    return NotificationPriority.normal;
  }
}
