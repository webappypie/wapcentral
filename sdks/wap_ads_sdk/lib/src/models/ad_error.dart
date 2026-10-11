/// Structured error model for WAP Ads SDK operations.
class AdError {
  /// Standardized machine-readable error code.
  final String code;

  /// Developer-facing description of the failure.
  final String message;

  /// The ad network / provider associated with the error (if applicable).
  final String? network;

  /// Optional underlying exception details.
  final dynamic details;

  const AdError({
    required this.code,
    required this.message,
    this.network,
    this.details,
  });

  // Predefined standard codes
  static const String globalKillSwitch = 'GLOBAL_KILL_SWITCH';
  static const String appKillSwitch = 'APP_KILL_SWITCH';
  static const String formatDisabled = 'FORMAT_DISABLED';
  static const String placementDisabled = 'PLACEMENT_DISABLED';
  static const String cooldownActive = 'COOLDOWN_ACTIVE';
  static const String frequencyCapped = 'FREQUENCY_CAPPED';
  static const String waterfallExhausted = 'WATERFALL_EXHAUSTED';
  static const String networkTimeout = 'NETWORK_TIMEOUT';
  static const String noFill = 'NO_FILL';
  static const String configError = 'CONFIG_ERROR';
  static const String notInitialized = 'NOT_INITIALIZED';
  static const String internalError = 'INTERNAL_ERROR';

  @override
  String toString() => 'AdError(code: $code, message: $message, network: $network)';
}
