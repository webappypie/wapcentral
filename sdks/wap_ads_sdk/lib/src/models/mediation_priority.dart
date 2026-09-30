import 'ad_network.dart';

/// Defines waterfall mediation priority and fallback strategy.
class MediationPriority {
  /// Ordered list of ad networks to attempt in sequence.
  final List<AdNetwork> waterfall;

  /// Maximum timeout in milliseconds to wait for a network response before falling back.
  final int fallbackTimeoutMs;

  /// Whether to automatically fall back to the next network upon load failure or no-fill.
  final bool enableFallback;

  const MediationPriority({
    required this.waterfall,
    this.fallbackTimeoutMs = 5000,
    this.enableFallback = true,
  });

  /// Default production waterfall priority:
  /// 1. AdMob (highest direct fill & revenue)
  /// 2. Meta Audience Network (social demand)
  /// 3. AppLovin MAX (real-time auctions)
  /// 4. WAPAds (guaranteed first-party house ads fallback)
  static const MediationPriority defaultPriority = MediationPriority(
    waterfall: [
      AdNetwork.admob,
      AdNetwork.meta,
      AdNetwork.applovin,
      AdNetwork.wapads,
    ],
    fallbackTimeoutMs: 5000,
    enableFallback: true,
  );

  factory MediationPriority.fromJson(dynamic json) {
    if (json == null) return defaultPriority;

    if (json is List) {
      final list = json
          .map((item) => AdNetwork.fromString(item?.toString()))
          .toList();
      return MediationPriority(
        waterfall: list.isNotEmpty ? list : defaultPriority.waterfall,
      );
    }

    if (json is Map<String, dynamic>) {
      final waterfallRaw = json['waterfall'];
      List<AdNetwork> networks = defaultPriority.waterfall;
      if (waterfallRaw is List) {
        networks = waterfallRaw
            .map((item) => AdNetwork.fromString(item?.toString()))
            .toList();
      }

      return MediationPriority(
        waterfall: networks.isNotEmpty ? networks : defaultPriority.waterfall,
        fallbackTimeoutMs: json['fallbackTimeoutMs'] as int? ?? 5000,
        enableFallback: json['enableFallback'] as bool? ?? true,
      );
    }

    return defaultPriority;
  }

  Map<String, dynamic> toJson() => {
        'waterfall': waterfall.map((n) => n.name).toList(),
        'fallbackTimeoutMs': fallbackTimeoutMs,
        'enableFallback': enableFallback,
      };

  @override
  String toString() =>
      'MediationPriority(waterfall: ${waterfall.map((n) => n.name).join(' -> ')}, timeout: ${fallbackTimeoutMs}ms)';
}
