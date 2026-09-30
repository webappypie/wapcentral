import 'dart:convert';

/// Layout variants supported for promotion display.
enum PromoLayoutVariant {
  banner,
  interstitial,
  native;

  static PromoLayoutVariant fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'interstitial':
        return PromoLayoutVariant.interstitial;
      case 'native':
        return PromoLayoutVariant.native;
      case 'banner':
      default:
        return PromoLayoutVariant.banner;
    }
  }

  String toValue() {
    switch (this) {
      case PromoLayoutVariant.interstitial:
        return 'interstitial';
      case PromoLayoutVariant.native:
        return 'native';
      case PromoLayoutVariant.banner:
        return 'banner';
    }
  }
}

/// Frequency capping definition attached to a campaign.
class PromoFrequencyCap {
  final int maxImpressions;
  final int periodHours;

  const PromoFrequencyCap({
    required this.maxImpressions,
    required this.periodHours,
  });

  factory PromoFrequencyCap.fromJson(Map<String, dynamic> json) {
    return PromoFrequencyCap(
      maxImpressions: (json['maxImpressions'] as num?)?.toInt() ?? 3,
      periodHours: (json['periodHours'] as num?)?.toInt() ?? 24,
    );
  }

  Map<String, dynamic> toJson() => {
        'maxImpressions': maxImpressions,
        'periodHours': periodHours,
      };
}

/// Platform-agnostic promotion payload received from promotion-api.
class PromoPayload {
  final int schemaVersion;
  final bool enabled;
  final String? campaignId;
  final String? title;
  final String? description;
  final String? imageUrl;
  final String? animationUrl;
  final String? ctaText;
  final String? storeUrl;
  final PromoLayoutVariant layoutVariant;
  final DateTime? expiresAt;
  final int cacheTtlSeconds;
  final String signature;
  final PromoFrequencyCap? frequencyCap;

  const PromoPayload({
    required this.schemaVersion,
    required this.enabled,
    this.campaignId,
    this.title,
    this.description,
    this.imageUrl,
    this.animationUrl,
    this.ctaText,
    this.storeUrl,
    this.layoutVariant = PromoLayoutVariant.banner,
    this.expiresAt,
    required this.cacheTtlSeconds,
    required this.signature,
    this.frequencyCap,
  });

  /// Factory for a disabled/empty fallback payload.
  factory PromoPayload.empty({
    int cacheTtlSeconds = 3600,
    String signature = '',
  }) {
    return PromoPayload(
      schemaVersion: 1,
      enabled: false,
      cacheTtlSeconds: cacheTtlSeconds,
      signature: signature,
    );
  }

  factory PromoPayload.fromJson(Map<String, dynamic> json) {
    return PromoPayload(
      schemaVersion: (json['schemaVersion'] as num?)?.toInt() ?? 1,
      enabled: json['enabled'] == true,
      campaignId: json['campaignId'] as String?,
      title: json['title'] as String?,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
      animationUrl: json['animationUrl'] as String?,
      ctaText: json['ctaText'] as String?,
      storeUrl: json['storeUrl'] as String?,
      layoutVariant: PromoLayoutVariant.fromString(json['layoutVariant'] as String?),
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String)
          : null,
      cacheTtlSeconds: (json['cacheTtlSeconds'] as num?)?.toInt() ?? 21600,
      signature: json['signature'] as String? ?? '',
      frequencyCap: json['frequencyCap'] != null
          ? PromoFrequencyCap.fromJson(json['frequencyCap'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'schemaVersion': schemaVersion,
      'enabled': enabled,
      'cacheTtlSeconds': cacheTtlSeconds,
      'signature': signature,
    };

    if (campaignId != null) map['campaignId'] = campaignId;
    if (title != null) map['title'] = title;
    if (description != null) map['description'] = description;
    if (imageUrl != null) map['imageUrl'] = imageUrl;
    if (animationUrl != null) map['animationUrl'] = animationUrl;
    if (ctaText != null) map['ctaText'] = ctaText;
    if (storeUrl != null) map['storeUrl'] = storeUrl;
    if (enabled) map['layoutVariant'] = layoutVariant.toValue();
    if (expiresAt != null) map['expiresAt'] = expiresAt!.toIso8601String();
    if (frequencyCap != null) map['frequencyCap'] = frequencyCap!.toJson();

    return map;
  }

  String toJsonString() => jsonEncode(toJson());

  static PromoPayload? fromJsonString(String? str) {
    if (str == null || str.isEmpty) return null;
    try {
      final decoded = jsonDecode(str) as Map<String, dynamic>;
      return PromoPayload.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  /// Whether the promotion has expired.
  bool isExpired() {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// Whether the payload has usable creative content to render.
  bool get hasContent =>
      enabled &&
      campaignId != null &&
      title != null &&
      title!.isNotEmpty &&
      !isExpired();
}
