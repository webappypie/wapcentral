import 'ad_format.dart';
import 'ad_network.dart';
import 'ad_placement.dart';
import 'ad_unit_config.dart';
import 'mediation_priority.dart';

/// Configuration for Google AdMob in mobile client.
class AdMobConfig {
  final String appId;
  final List<AdUnitConfig> adUnits;
  final bool enabled;

  const AdMobConfig({
    required this.appId,
    this.adUnits = const [],
    this.enabled = true,
  });

  factory AdMobConfig.fromJson(Map<String, dynamic> json) {
    final unitsRaw = json['adUnits'];
    final List<AdUnitConfig> units = [];
    if (unitsRaw is List) {
      for (final u in unitsRaw) {
        if (u is Map<String, dynamic>) {
          units.add(AdUnitConfig.fromJson(u, defaultNetwork: AdNetwork.admob));
        }
      }
    }

    return AdMobConfig(
      appId: json['appId'] as String? ?? '',
      adUnits: units,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'appId': appId,
        'adUnits': adUnits.map((u) => u.toJson()).toList(),
        'enabled': enabled,
      };
}

/// Configuration for Meta Audience Network.
class MetaConfig {
  final String appId;
  final List<AdPlacement> placements;
  final bool enabled;

  const MetaConfig({
    required this.appId,
    this.placements = const [],
    this.enabled = true,
  });

  factory MetaConfig.fromJson(Map<String, dynamic> json) {
    final placementsRaw = json['placements'];
    final List<AdPlacement> list = [];
    if (placementsRaw is List) {
      for (final p in placementsRaw) {
        if (p is Map<String, dynamic>) {
          list.add(AdPlacement.fromJson(p));
        }
      }
    }

    return MetaConfig(
      appId: json['appId'] as String? ?? '',
      placements: list,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'appId': appId,
        'placements': placements.map((p) => p.toJson()).toList(),
        'enabled': enabled,
      };
}

/// Configuration for AppLovin MAX mediation.
class AppLovinConfig {
  final String sdkKey;
  final List<AdUnitConfig> adUnits;
  final bool enabled;

  const AppLovinConfig({
    required this.sdkKey,
    this.adUnits = const [],
    this.enabled = true,
  });

  factory AppLovinConfig.fromJson(Map<String, dynamic> json) {
    final unitsRaw = json['adUnits'];
    final List<AdUnitConfig> units = [];
    if (unitsRaw is List) {
      for (final u in unitsRaw) {
        if (u is Map<String, dynamic>) {
          units.add(AdUnitConfig.fromJson(u, defaultNetwork: AdNetwork.applovin));
        }
      }
    }

    return AppLovinConfig(
      sdkKey: json['sdkKey'] as String? ?? '',
      adUnits: units,
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'sdkKey': sdkKey,
        'adUnits': adUnits.map((u) => u.toJson()).toList(),
        'enabled': enabled,
      };
}

/// Configuration for first-party WAPAds promotion network.
class WapAdsConfig {
  final String appKey;
  final bool enabled;

  const WapAdsConfig({
    required this.appKey,
    this.enabled = true,
  });

  factory WapAdsConfig.fromJson(Map<String, dynamic> json) {
    return WapAdsConfig(
      appKey: json['appKey'] as String? ?? '',
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'appKey': appKey,
        'enabled': enabled,
      };
}

/// Top-level ad configuration delivered to the mobile application.
class AdConfig {
  /// Target App identifier registered in WAPCentral.
  final String appId;

  /// AdMob configuration.
  final AdMobConfig? admob;

  /// Meta Audience Network configuration.
  final MetaConfig? meta;

  /// AppLovin MAX configuration.
  final AppLovinConfig? applovin;

  /// First-party WAPAds configuration.
  final WapAdsConfig? wapads;

  /// Mediation waterfall priority.
  final MediationPriority mediationPriority;

  /// When true, enables test device IDs or mock inventory.
  final bool testMode;

  const AdConfig({
    required this.appId,
    this.admob,
    this.meta,
    this.applovin,
    this.wapads,
    this.mediationPriority = MediationPriority.defaultPriority,
    this.testMode = false,
  });

  factory AdConfig.fromJson(Map<String, dynamic> json) {
    return AdConfig(
      appId: json['appId'] as String? ?? '',
      admob: json['admob'] is Map<String, dynamic>
          ? AdMobConfig.fromJson(json['admob'] as Map<String, dynamic>)
          : null,
      meta: json['meta'] is Map<String, dynamic>
          ? MetaConfig.fromJson(json['meta'] as Map<String, dynamic>)
          : null,
      applovin: json['applovin'] is Map<String, dynamic>
          ? AppLovinConfig.fromJson(json['applovin'] as Map<String, dynamic>)
          : null,
      wapads: json['wapads'] is Map<String, dynamic>
          ? WapAdsConfig.fromJson(json['wapads'] as Map<String, dynamic>)
          : null,
      mediationPriority: json['mediationPriority'] != null
          ? MediationPriority.fromJson(json['mediationPriority'])
          : MediationPriority.defaultPriority,
      testMode: json['testMode'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'appId': appId,
        if (admob != null) 'admob': admob!.toJson(),
        if (meta != null) 'meta': meta!.toJson(),
        if (applovin != null) 'applovin': applovin!.toJson(),
        if (wapads != null) 'wapads': wapads!.toJson(),
        'mediationPriority': mediationPriority.toJson(),
        'testMode': testMode,
      };

  /// Returns the first matching ad unit for the given network, format, and platform.
  AdUnitConfig? findAdUnit(
    AdNetwork network,
    AdFormat format, {
    String platform = 'android',
  }) {
    switch (network) {
      case AdNetwork.admob:
        if (admob == null || !admob!.enabled) return null;
        return _matchUnit(admob!.adUnits, format, platform);
      case AdNetwork.applovin:
        if (applovin == null || !applovin!.enabled) return null;
        return _matchUnit(applovin!.adUnits, format, platform);
      case AdNetwork.meta:
        if (meta == null || !meta!.enabled) return null;
        final p = meta!.placements.firstWhere(
          (pl) => pl.type == format,
          orElse: () => const AdPlacement(id: '', name: '', type: AdFormat.banner, placementId: ''),
        );
        if (p.placementId.isEmpty) return null;
        return AdUnitConfig(
          id: p.id,
          name: p.name,
          type: p.type,
          platform: 'all',
          adUnitId: p.placementId,
          network: AdNetwork.meta,
        );
      case AdNetwork.wapads:
        if (wapads == null || !wapads!.enabled) return null;
        return AdUnitConfig(
          id: 'wapads_${format.name}',
          name: 'WAPAds House ${format.displayName}',
          type: format,
          platform: 'all',
          adUnitId: wapads!.appKey,
          network: AdNetwork.wapads,
        );
    }
  }

  AdUnitConfig? _matchUnit(
    List<AdUnitConfig> units,
    AdFormat format,
    String platform,
  ) {
    for (final unit in units) {
      final matchesFormat = unit.type == format;
      final matchesPlatform =
          unit.platform.toLowerCase() == 'all' ||
          unit.platform.toLowerCase() == platform.toLowerCase();
      if (matchesFormat && matchesPlatform) {
        return unit;
      }
    }
    return null;
  }
}
