import 'ad_format.dart';
import 'ad_network.dart';

/// Status of an ad load request.
enum AdLoadStatus {
  /// Ad loaded successfully and is ready to display.
  loaded,

  /// Ad network returned no-fill (no inventory available).
  noFill,

  /// Ad load resulted in an error (e.g. network failure, invalid unit ID).
  failed,

  /// Ad request timed out before response was received.
  timeout,

  /// Ad provider was skipped (disabled or no configured unit ID).
  skipped,
}

/// Result returned after attempting to load an ad from a provider.
class AdLoadResult {
  /// Status of the attempt.
  final AdLoadStatus status;

  /// Network provider that was queried.
  final AdNetwork network;

  /// Ad format requested.
  final AdFormat format;

  /// Ad unit ID or placement ID used.
  final String? adUnitId;

  /// Latency in milliseconds to resolve the ad.
  final int latencyMs;

  /// Human-readable error message if failed.
  final String? errorMessage;

  /// Provider-specific error code if available.
  final String? errorCode;

  const AdLoadResult({
    required this.status,
    required this.network,
    required this.format,
    this.adUnitId,
    this.latencyMs = 0,
    this.errorMessage,
    this.errorCode,
  });

  /// Whether the ad was loaded successfully.
  bool get isSuccess => status == AdLoadStatus.loaded;

  /// Convenience factory for successful load.
  factory AdLoadResult.success({
    required AdNetwork network,
    required AdFormat format,
    String? adUnitId,
    int latencyMs = 0,
  }) {
    return AdLoadResult(
      status: AdLoadStatus.loaded,
      network: network,
      format: format,
      adUnitId: adUnitId,
      latencyMs: latencyMs,
    );
  }

  /// Convenience factory for no-fill.
  factory AdLoadResult.noFill({
    required AdNetwork network,
    required AdFormat format,
    String? adUnitId,
    int latencyMs = 0,
    String? errorMessage,
  }) {
    return AdLoadResult(
      status: AdLoadStatus.noFill,
      network: network,
      format: format,
      adUnitId: adUnitId,
      latencyMs: latencyMs,
      errorMessage: errorMessage ?? 'No inventory returned by ad network',
    );
  }

  /// Convenience factory for failure.
  factory AdLoadResult.failure({
    required AdNetwork network,
    required AdFormat format,
    String? adUnitId,
    required String errorMessage,
    String? errorCode,
    int latencyMs = 0,
  }) {
    return AdLoadResult(
      status: AdLoadStatus.failed,
      network: network,
      format: format,
      adUnitId: adUnitId,
      errorMessage: errorMessage,
      errorCode: errorCode,
      latencyMs: latencyMs,
    );
  }

  /// Convenience factory for timeout.
  factory AdLoadResult.timeout({
    required AdNetwork network,
    required AdFormat format,
    String? adUnitId,
    int latencyMs = 0,
  }) {
    return AdLoadResult(
      status: AdLoadStatus.timeout,
      network: network,
      format: format,
      adUnitId: adUnitId,
      latencyMs: latencyMs,
      errorMessage: 'Ad load timed out before response was received',
    );
  }

  /// Convenience factory for skipped provider.
  factory AdLoadResult.skipped({
    required AdNetwork network,
    required AdFormat format,
    required String reason,
  }) {
    return AdLoadResult(
      status: AdLoadStatus.skipped,
      network: network,
      format: format,
      errorMessage: reason,
    );
  }

  @override
  String toString() =>
      'AdLoadResult(status: ${status.name}, network: ${network.name}, format: ${format.name}, latency: ${latencyMs}ms, error: $errorMessage)';
}
