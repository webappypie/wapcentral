import 'ad_format.dart';
import 'ad_network.dart';

/// Configuration for an individual ad unit registered in WAPCentral.
class AdUnitConfig {
  /// Unique identifier of the unit entry.
  final String id;

  /// Human-readable label or placement description.
  final String name;

  /// Ad format (banner, interstitial, rewarded, native).
  final AdFormat type;

  /// Target platform: 'android', 'ios', or 'all'.
  final String platform;

  /// Network-specific ad unit ID (e.g. `ca-app-pub-xxx/yyy`).
  final String adUnitId;

  /// Associated ad network provider.
  final AdNetwork network;

  const AdUnitConfig({
    required this.id,
    required this.name,
    required this.type,
    required this.platform,
    required this.adUnitId,
    this.network = AdNetwork.admob,
  });

  factory AdUnitConfig.fromJson(Map<String, dynamic> json, {AdNetwork defaultNetwork = AdNetwork.admob}) {
    return AdUnitConfig(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: AdFormat.fromString(json['type'] as String?),
      platform: json['platform'] as String? ?? 'all',
      adUnitId: json['adUnitId'] as String? ?? '',
      network: json['network'] != null
          ? AdNetwork.fromString(json['network'] as String?)
          : defaultNetwork,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type.name,
        'platform': platform,
        'adUnitId': adUnitId,
        'network': network.name,
      };

  @override
  String toString() =>
      'AdUnitConfig(id: $id, name: $name, type: ${type.name}, network: ${network.name}, adUnitId: $adUnitId)';
}
