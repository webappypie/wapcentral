import 'notification_category.dart';
import 'notification_priority.dart';
import 'notification_type.dart';

/// Represents a notification item in the WAPCentral ecosystem.
/// Can originate from an FCM push payload or a fetched bell notification item.
class WapNotification {
  const WapNotification({
    required this.id,
    required this.title,
    required this.message,
    this.category = NotificationCategory.system,
    this.type = NotificationType.system,
    this.priority = NotificationPriority.normal,
    this.imageUrl,
    this.icon,
    this.deepLink,
    this.externalUrl,
    this.sound,
    this.badge,
    this.dataPayload = const {},
    this.isRead = false,
    this.readAt,
    this.createdAt,
    this.isMandatory = false,
  });

  final String id;
  final String title;
  final String message;
  final NotificationCategory category;
  final NotificationType type;
  final NotificationPriority priority;
  final String? imageUrl;
  final String? icon;
  final String? deepLink;
  final String? externalUrl;
  final String? sound;
  final int? badge;
  final Map<String, dynamic> dataPayload;
  final bool isRead;
  final DateTime? readAt;
  final DateTime? createdAt;
  final bool isMandatory;

  /// Creates a [WapNotification] from JSON map.
  factory WapNotification.fromJson(Map<String, dynamic> json) {
    return WapNotification(
      id: json['id'] as String? ?? json['notificationId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? json['body'] as String? ?? '',
      category: NotificationCategory.fromString(json['category'] as String?),
      type: NotificationType.fromString(json['type'] as String?),
      priority: NotificationPriority.fromString(json['priority'] as String?),
      imageUrl: json['imageUrl'] as String?,
      icon: json['icon'] as String?,
      deepLink: json['deepLink'] as String?,
      externalUrl: json['externalUrl'] as String?,
      sound: json['sound'] as String?,
      badge: json['badge'] is int
          ? json['badge'] as int
          : (json['badge'] != null ? int.tryParse(json['badge'].toString()) : null),
      dataPayload: json['dataPayload'] is Map
          ? Map<String, dynamic>.from(json['dataPayload'] as Map)
          : (json['data'] is Map ? Map<String, dynamic>.from(json['data'] as Map) : {}),
      isRead: json['isRead'] as bool? ?? false,
      readAt: json['readAt'] != null ? DateTime.tryParse(json['readAt'] as String) : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      isMandatory: json['isMandatory'] as bool? ?? false,
    );
  }

  /// Creates a [WapNotification] from an incoming FCM RemoteMessage-style map.
  factory WapNotification.fromFcmPayload(Map<String, dynamic> payload) {
    final notification = payload['notification'] is Map ? payload['notification'] as Map : {};
    final data = payload['data'] is Map ? payload['data'] as Map : payload;

    final id = data['notificationId']?.toString() ??
        data['id']?.toString() ??
        payload['messageId']?.toString() ??
        'msg_${DateTime.now().millisecondsSinceEpoch}';

    final title = notification['title']?.toString() ?? data['title']?.toString() ?? '';
    final message = notification['body']?.toString() ?? data['message']?.toString() ?? '';

    return WapNotification(
      id: id,
      title: title,
      message: message,
      category: NotificationCategory.fromString(data['category']?.toString()),
      type: NotificationType.fromString(data['type']?.toString()),
      priority: NotificationPriority.fromString(data['priority']?.toString()),
      imageUrl: notification['image']?.toString() ?? data['imageUrl']?.toString(),
      icon: data['icon']?.toString(),
      deepLink: data['deepLink']?.toString(),
      externalUrl: data['externalUrl']?.toString(),
      sound: data['sound']?.toString(),
      badge: data['badge'] != null ? int.tryParse(data['badge'].toString()) : null,
      dataPayload: Map<String, dynamic>.from(data),
      isRead: false,
      createdAt: DateTime.now(),
      isMandatory: data['isMandatory'] == 'true' || data['isMandatory'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'message': message,
      'category': category.code,
      'type': type.value,
      'priority': priority.value,
      if (imageUrl != null) 'imageUrl': imageUrl,
      if (icon != null) 'icon': icon,
      if (deepLink != null) 'deepLink': deepLink,
      if (externalUrl != null) 'externalUrl': externalUrl,
      if (sound != null) 'sound': sound,
      if (badge != null) 'badge': badge,
      'dataPayload': dataPayload,
      'isRead': isRead,
      if (readAt != null) 'readAt': readAt!.toIso8601String(),
      if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      'isMandatory': isMandatory,
    };
  }

  WapNotification copyWith({
    String? id,
    String? title,
    String? message,
    NotificationCategory? category,
    NotificationType? type,
    NotificationPriority? priority,
    String? imageUrl,
    String? icon,
    String? deepLink,
    String? externalUrl,
    String? sound,
    int? badge,
    Map<String, dynamic>? dataPayload,
    bool? isRead,
    DateTime? readAt,
    DateTime? createdAt,
    bool? isMandatory,
  }) {
    return WapNotification(
      id: id ?? this.id,
      title: title ?? this.title,
      message: message ?? this.message,
      category: category ?? this.category,
      type: type ?? this.type,
      priority: priority ?? this.priority,
      imageUrl: imageUrl ?? this.imageUrl,
      icon: icon ?? this.icon,
      deepLink: deepLink ?? this.deepLink,
      externalUrl: externalUrl ?? this.externalUrl,
      sound: sound ?? this.sound,
      badge: badge ?? this.badge,
      dataPayload: dataPayload ?? this.dataPayload,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
      isMandatory: isMandatory ?? this.isMandatory,
    );
  }
}
