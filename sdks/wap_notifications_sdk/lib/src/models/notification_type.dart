/// Delivery classification for notifications.
enum NotificationType {
  global('global'),
  appSpecific('app_specific'),
  system('system'),
  important('important'),
  announcement('announcement'),
  maintenance('maintenance'),
  update('update'),
  promotion('promotion'),
  custom('custom');

  const NotificationType(this.value);

  final String value;

  static NotificationType fromString(String? val) {
    if (val == null) return NotificationType.system;
    for (final t in NotificationType.values) {
      if (t.value == val.toLowerCase()) return t;
    }
    return NotificationType.system;
  }
}
