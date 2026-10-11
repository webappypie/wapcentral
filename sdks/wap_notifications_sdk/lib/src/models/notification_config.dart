/// Effective notification configuration returned by WAPCentral.
class NotificationConfig {
  const NotificationConfig({
    required this.enabled,
    required this.globalNotificationsOff,
    required this.appKillSwitch,
    this.fcmSenderId,
    this.supportedCategories = const [],
    this.mandatoryCategories = const ['SYSTEM', 'SECURITY', 'MAINTENANCE'],
    this.categoryKillSwitches = const {},
    this.configHash,
  });

  final bool enabled;
  final bool globalNotificationsOff;
  final bool appKillSwitch;
  final String? fcmSenderId;
  final List<String> supportedCategories;
  final List<String> mandatoryCategories;
  final Map<String, bool> categoryKillSwitches;
  final String? configHash;

  /// Effective status taking into account all global and app kill switches.
  bool get isEffectiveActive =>
      enabled && !globalNotificationsOff && !appKillSwitch;

  /// Whether a specific category is globally or specifically killed.
  bool isCategoryKilled(String category) {
    if (globalNotificationsOff || appKillSwitch) return true;
    return categoryKillSwitches[category.toUpperCase()] == true;
  }

  factory NotificationConfig.fromJson(Map<String, dynamic> json) {
    return NotificationConfig(
      enabled: json['enabled'] as bool? ?? true,
      globalNotificationsOff: json['globalNotificationsOff'] as bool? ?? false,
      appKillSwitch: json['appKillSwitch'] as bool? ?? false,
      fcmSenderId: json['fcmSenderId'] as String?,
      supportedCategories: (json['supportedCategories'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      mandatoryCategories: (json['mandatoryCategories'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const ['SYSTEM', 'SECURITY', 'MAINTENANCE'],
      categoryKillSwitches: (json['categoryKillSwitches'] is Map)
          ? (json['categoryKillSwitches'] as Map).map(
              (k, v) => MapEntry(k.toString(), v == true),
            )
          : const {},
      configHash: json['configHash'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'globalNotificationsOff': globalNotificationsOff,
      'appKillSwitch': appKillSwitch,
      if (fcmSenderId != null) 'fcmSenderId': fcmSenderId,
      'supportedCategories': supportedCategories,
      'mandatoryCategories': mandatoryCategories,
      'categoryKillSwitches': categoryKillSwitches,
      if (configHash != null) 'configHash': configHash,
    };
  }

  /// Default fallback configuration when offline or unreachable.
  static const fallback = NotificationConfig(
    enabled: true,
    globalNotificationsOff: false,
    appKillSwitch: false,
  );
}
