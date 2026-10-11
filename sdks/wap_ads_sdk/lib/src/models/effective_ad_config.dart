import 'ad_format.dart';

/// Server-authoritative Effective Ad Configuration delivered by WAPCentral Platform API.
class EffectiveAdConfig {
  final String appId;
  final bool enabled;
  final bool testMode;
  final String version;
  final SafetyConfig safety;
  final Map<AdFormat, EffectiveFormatConfig> formats;
  final Map<String, PlacementConfig> placements;
  final String disclaimer;
  final String timestamp;
  final Map<String, dynamic> rawJson;

  const EffectiveAdConfig({
    required this.appId,
    required this.enabled,
    required this.testMode,
    required this.version,
    required this.safety,
    required this.formats,
    required this.placements,
    required this.disclaimer,
    required this.timestamp,
    this.rawJson = const {},
  });

  /// Safe disabled fallback configuration used when network or parsing fails completely.
  factory EffectiveAdConfig.safeDisabled({String appId = 'unknown'}) {
    return EffectiveAdConfig(
      appId: appId,
      enabled: false,
      testMode: false,
      version: 'offline_fallback',
      safety: const SafetyConfig(maxAdRating: 'PG', blockedCategories: []),
      formats: const {},
      placements: const {},
      disclaimer: 'Offline safe fallback',
      timestamp: DateTime.now().toIso8601String(),
    );
  }

  factory EffectiveAdConfig.fromJson(Map<String, dynamic> json) {
    // If enveloped in { success: true, data: { ... } }
    final Map<String, dynamic> data = json.containsKey('data') && json['data'] is Map<String, dynamic>
        ? json['data'] as Map<String, dynamic>
        : json;

    final formatsMap = <AdFormat, EffectiveFormatConfig>{};
    if (data['formats'] is Map) {
      final rawFormats = data['formats'] as Map;
      rawFormats.forEach((key, val) {
        if (val is Map<String, dynamic>) {
          final format = AdFormat.fromString(key.toString());
          formatsMap[format] = EffectiveFormatConfig.fromJson(val, defaultFormat: format);
        }
      });
    }

    final placementsMap = <String, PlacementConfig>{};
    if (data['placements'] is Map) {
      final rawPlacements = data['placements'] as Map;
      rawPlacements.forEach((key, val) {
        if (val is Map<String, dynamic>) {
          placementsMap[key.toString()] = PlacementConfig.fromJson(val, defaultKey: key.toString());
        }
      });
    }

    return EffectiveAdConfig(
      appId: data['appId'] as String? ?? '',
      enabled: data['enabled'] as bool? ?? false,
      testMode: data['testMode'] as bool? ?? false,
      version: data['version'] as String? ?? 'v1',
      safety: data['safety'] is Map<String, dynamic>
          ? SafetyConfig.fromJson(data['safety'] as Map<String, dynamic>)
          : const SafetyConfig(maxAdRating: 'PG', blockedCategories: []),
      formats: formatsMap,
      placements: placementsMap,
      disclaimer: data['disclaimer'] as String? ?? '',
      timestamp: data['timestamp'] as String? ?? DateTime.now().toIso8601String(),
      rawJson: json,
    );
  }

  Map<String, dynamic> toJson() => {
        'appId': appId,
        'enabled': enabled,
        'testMode': testMode,
        'version': version,
        'safety': safety.toJson(),
        'formats': formats.map((k, v) => MapEntry(k.apiValue, v.toJson())),
        'placements': placements.map((k, v) => MapEntry(k, v.toJson())),
        'disclaimer': disclaimer,
        'timestamp': timestamp,
      };

  /// Check whether a specific ad format is enabled after global and app toggles.
  bool isFormatEnabled(AdFormat format) {
    if (!enabled) return false;
    final cfg = formats[format];
    return cfg != null && cfg.enabled;
  }

  /// Check whether a specific placement is enabled.
  bool isPlacementEnabled(String? placementKey, AdFormat format) {
    if (!isFormatEnabled(format)) return false;
    if (placementKey == null || placementKey.isEmpty) return true;
    final p = placements[placementKey];
    if (p == null) return true; // defaults to format level if placement not explicitly constrained
    return p.enabled;
  }
}

/// Format-level effective configuration.
class EffectiveFormatConfig {
  final bool enabled;
  final AdFormat format;
  final int refreshIntervalSeconds;
  final FormatFrequency frequency;
  final List<MediationTier> mediationChain;
  final CustomAdFallback? customAdFallback;

  const EffectiveFormatConfig({
    required this.enabled,
    required this.format,
    this.refreshIntervalSeconds = 60,
    required this.frequency,
    required this.mediationChain,
    this.customAdFallback,
  });

  factory EffectiveFormatConfig.fromJson(Map<String, dynamic> json, {AdFormat? defaultFormat}) {
    final format = defaultFormat ?? AdFormat.fromString(json['format'] as String?);

    final chain = <MediationTier>[];
    if (json['mediationChain'] is List) {
      for (final tier in json['mediationChain'] as List) {
        if (tier is Map<String, dynamic>) {
          chain.add(MediationTier.fromJson(tier));
        }
      }
    }
    // Sort waterfall by priority ascending (1 = highest priority)
    chain.sort((a, b) => a.priority.compareTo(b.priority));

    // Enforce safe banner refresh minimum: strictly >= 30 seconds
    final int rawRefresh = json['refreshIntervalSeconds'] as int? ?? 60;
    final int safeRefresh = rawRefresh < 30 ? 30 : rawRefresh;

    return EffectiveFormatConfig(
      enabled: json['enabled'] as bool? ?? false,
      format: format,
      refreshIntervalSeconds: safeRefresh,
      frequency: json['frequency'] is Map<String, dynamic>
          ? FormatFrequency.fromJson(json['frequency'] as Map<String, dynamic>)
          : const FormatFrequency(),
      mediationChain: chain,
      customAdFallback: json['customAdFallback'] is Map<String, dynamic>
          ? CustomAdFallback.fromJson(json['customAdFallback'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'format': format.apiValue,
        'refreshIntervalSeconds': refreshIntervalSeconds,
        'frequency': frequency.toJson(),
        'mediationChain': mediationChain.map((m) => m.toJson()).toList(),
        if (customAdFallback != null) 'customAdFallback': customAdFallback!.toJson(),
      };
}

/// Single tier in mediation waterfall chain.
class MediationTier {
  final String networkId;
  final int priority;
  final String adUnitId;
  final int timeoutMs;

  const MediationTier({
    required this.networkId,
    required this.priority,
    required this.adUnitId,
    this.timeoutMs = 5000,
  });

  factory MediationTier.fromJson(Map<String, dynamic> json) {
    return MediationTier(
      networkId: json['networkId'] as String? ?? 'unknown',
      priority: json['priority'] as int? ?? 99,
      adUnitId: json['adUnitId'] as String? ?? '',
      timeoutMs: json['timeoutMs'] as int? ?? 5000,
    );
  }

  Map<String, dynamic> toJson() => {
        'networkId': networkId,
        'priority': priority,
        'adUnitId': adUnitId,
        'timeoutMs': timeoutMs,
      };
}

/// Frequency capping & cooldown rules for an ad format.
class FormatFrequency {
  final int minIntervalSeconds;
  final int cooldownSeconds;
  final int sessionCap;
  final int dailyCap;
  final int? perUserCap;
  final String? appForegroundRule;

  const FormatFrequency({
    this.minIntervalSeconds = 0,
    this.cooldownSeconds = 0,
    this.sessionCap = 100,
    this.dailyCap = 500,
    this.perUserCap,
    this.appForegroundRule,
  });

  factory FormatFrequency.fromJson(Map<String, dynamic> json) {
    return FormatFrequency(
      minIntervalSeconds: json['minIntervalSeconds'] as int? ?? 0,
      cooldownSeconds: json['cooldownSeconds'] as int? ?? 0,
      sessionCap: json['sessionCap'] as int? ?? 100,
      dailyCap: json['dailyCap'] as int? ?? 500,
      perUserCap: json['perUserCap'] as int?,
      appForegroundRule: json['appForegroundRule'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'minIntervalSeconds': minIntervalSeconds,
        'cooldownSeconds': cooldownSeconds,
        'sessionCap': sessionCap,
        'dailyCap': dailyCap,
        if (perUserCap != null) 'perUserCap': perUserCap,
        if (appForegroundRule != null) 'appForegroundRule': appForegroundRule,
      };
}

/// In-app placement configuration.
class PlacementConfig {
  final String placementKey;
  final AdFormat format;
  final bool enabled;
  final int? cooldownSeconds;
  final int? sessionCap;
  final int? dailyCap;
  final String? foregroundRule;

  const PlacementConfig({
    required this.placementKey,
    required this.format,
    required this.enabled,
    this.cooldownSeconds,
    this.sessionCap,
    this.dailyCap,
    this.foregroundRule,
  });

  factory PlacementConfig.fromJson(Map<String, dynamic> json, {String? defaultKey}) {
    return PlacementConfig(
      placementKey: json['placementKey'] as String? ?? defaultKey ?? '',
      format: AdFormat.fromString(json['format'] as String?),
      enabled: json['enabled'] as bool? ?? true,
      cooldownSeconds: json['cooldownSeconds'] as int?,
      sessionCap: json['sessionCap'] as int?,
      dailyCap: json['dailyCap'] as int?,
      foregroundRule: json['foregroundRule'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'placementKey': placementKey,
        'format': format.apiValue,
        'enabled': enabled,
        if (cooldownSeconds != null) 'cooldownSeconds': cooldownSeconds,
        if (sessionCap != null) 'sessionCap': sessionCap,
        if (dailyCap != null) 'dailyCap': dailyCap,
        if (foregroundRule != null) 'foregroundRule': foregroundRule,
      };
}

/// Content safety constraints.
class SafetyConfig {
  final String maxAdRating;
  final List<String> blockedCategories;

  const SafetyConfig({
    required this.maxAdRating,
    required this.blockedCategories,
  });

  factory SafetyConfig.fromJson(Map<String, dynamic> json) {
    return SafetyConfig(
      maxAdRating: json['maxAdRating'] as String? ?? 'PG',
      blockedCategories: (json['blockedCategories'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() => {
        'maxAdRating': maxAdRating,
        'blockedCategories': blockedCategories,
      };
}

/// Fallback house promotional campaign.
class CustomAdFallback {
  final String campaignId;
  final String title;
  final String description;
  final String ctaText;
  final String destinationUrl;
  final String? imageUrl;
  final String? videoUrl;
  final String? thumbnailUrl;
  final String? animationUrl;
  final String? creativeType;
  final List<dynamic>? carouselItems;

  const CustomAdFallback({
    required this.campaignId,
    required this.title,
    required this.description,
    required this.ctaText,
    required this.destinationUrl,
    this.imageUrl,
    this.videoUrl,
    this.thumbnailUrl,
    this.animationUrl,
    this.creativeType,
    this.carouselItems,
  });

  factory CustomAdFallback.fromJson(Map<String, dynamic> json) {
    return CustomAdFallback(
      campaignId: json['campaignId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      ctaText: json['ctaText'] as String? ?? 'Learn More',
      destinationUrl: json['destinationUrl'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      videoUrl: json['videoUrl'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      animationUrl: json['animationUrl'] as String?,
      creativeType: json['creativeType'] as String?,
      carouselItems: json['carouselItems'] is List ? json['carouselItems'] as List<dynamic> : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'campaignId': campaignId,
        'title': title,
        'description': description,
        'ctaText': ctaText,
        'destinationUrl': destinationUrl,
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
        if (animationUrl != null) 'animationUrl': animationUrl,
        if (creativeType != null) 'creativeType': creativeType,
        if (carouselItems != null) 'carouselItems': carouselItems,
      };
}
