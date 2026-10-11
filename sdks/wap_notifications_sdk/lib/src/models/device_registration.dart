/// Device registration payload for WAPCentral notifications.
class DeviceRegistration {
  const DeviceRegistration({
    required this.deviceId,
    required this.fcmToken,
    required this.platform,
    this.deviceModel,
    this.osVersion,
    this.appVersion,
    this.userId,
    this.language,
    this.timezone,
    this.metadata,
  });

  final String deviceId;
  final String fcmToken;
  final String platform;
  final String? deviceModel;
  final String? osVersion;
  final String? appVersion;
  final String? userId;
  final String? language;
  final String? timezone;
  final Map<String, dynamic>? metadata;

  Map<String, dynamic> toJson() {
    return {
      'deviceId': deviceId,
      'fcmToken': fcmToken,
      'platform': platform.toLowerCase(),
      if (deviceModel != null) 'deviceModel': deviceModel,
      if (osVersion != null) 'osVersion': osVersion,
      if (appVersion != null) 'appVersion': appVersion,
      if (userId != null) 'userId': userId,
      if (language != null) 'language': language,
      if (timezone != null) 'timezone': timezone,
      if (metadata != null) 'metadata': metadata,
    };
  }

  factory DeviceRegistration.fromJson(Map<String, dynamic> json) {
    return DeviceRegistration(
      deviceId: json['deviceId'] as String? ?? '',
      fcmToken: json['fcmToken'] as String? ?? '',
      platform: json['platform'] as String? ?? 'android',
      deviceModel: json['deviceModel'] as String?,
      osVersion: json['osVersion'] as String?,
      appVersion: json['appVersion'] as String?,
      userId: json['userId'] as String?,
      language: json['language'] as String?,
      timezone: json['timezone'] as String?,
      metadata: json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata'] as Map) : null,
    );
  }
}
