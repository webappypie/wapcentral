import 'ad_format.dart';

/// Configuration for an ad placement (e.g. Meta Audience Network placements).
class AdPlacement {
  /// Unique placement identifier in WAPCentral.
  final String id;

  /// Human-readable placement label.
  final String name;

  /// Placement ad format.
  final AdFormat type;

  /// Provider-specific placement ID (e.g. Meta placement hash).
  final String placementId;

  const AdPlacement({
    required this.id,
    required this.name,
    required this.type,
    required this.placementId,
  });

  factory AdPlacement.fromJson(Map<String, dynamic> json) {
    return AdPlacement(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: AdFormat.fromString(json['type'] as String?),
      placementId: json['placementId'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type.name,
        'placementId': placementId,
      };

  @override
  String toString() =>
      'AdPlacement(id: $id, name: $name, type: ${type.name}, placementId: $placementId)';
}
