import '../models/ad_format.dart';

/// Supported SDK telemetry event types.
enum AdEventType {
  request,
  loaded,
  failed,
  displayed,
  clicked,
  rewarded,
  fallback,
  providerSelected,
  killSwitch,
  configRefresh,
}

/// An immutable telemetry event emitted by the WAP Ads SDK.
class AdEvent {
  final AdEventType type;
  final String appId;
  final AdFormat? format;
  final String? provider;
  final String? placementKey;
  final String? campaignId;
  final String requestId;
  final DateTime timestamp;
  final Map<String, dynamic> metadata;

  AdEvent({
    required this.type,
    required this.appId,
    this.format,
    this.provider,
    this.placementKey,
    this.campaignId,
    required this.requestId,
    DateTime? timestamp,
    this.metadata = const {},
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'type': type.name,
        'appId': appId,
        if (format != null) 'format': format!.apiValue,
        if (provider != null) 'provider': provider,
        if (placementKey != null) 'placementKey': placementKey,
        if (campaignId != null) 'campaignId': campaignId,
        'requestId': requestId,
        'timestamp': timestamp.toIso8601String(),
        if (metadata.isNotEmpty) 'metadata': metadata,
      };

  @override
  String toString() =>
      'AdEvent(type: ${type.name}, appId: $appId, format: ${format?.name}, provider: $provider, requestId: $requestId)';
}

/// Callback function signature for telemetry listeners.
typedef AdTelemetryListener = void Function(AdEvent event);

/// Central dispatcher for ad lifecycle telemetry events.
class AdTelemetryDispatcher {
  static final List<AdTelemetryListener> _listeners = [];

  /// Register a telemetry listener.
  static void addListener(AdTelemetryListener listener) {
    if (!_listeners.contains(listener)) {
      _listeners.add(listener);
    }
  }

  /// Remove an existing telemetry listener.
  static void removeListener(AdTelemetryListener listener) {
    _listeners.remove(listener);
  }

  /// Clear all registered listeners (primarily for testing).
  static void clearListeners() {
    _listeners.clear();
  }

  /// Dispatches an ad event to all registered telemetry hooks safely.
  static void dispatch(AdEvent event) {
    for (final listener in List.of(_listeners)) {
      try {
        listener(event);
      } catch (err) {
        // Telemetry errors must never crash ad serving or the hosting application.
      }
    }
  }
}
