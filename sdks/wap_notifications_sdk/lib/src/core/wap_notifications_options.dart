/// Configuration options for initializing the WAP Notifications SDK.
class WapNotificationsOptions {
  const WapNotificationsOptions({
    required this.appId,
    required this.appKey,
    this.baseUrl = 'https://api.wapcentral.io',
    this.environment = 'production',
    this.autoFetchBell = true,
    this.bellRefreshInterval = const Duration(minutes: 5),
    this.enableLogging = false,
    this.deviceId,
  });

  /// The unique registered application ID in WAPCentral (e.g. 'filezen', 'optilens').
  final String appId;

  /// The public SDK credential key.
  final String appKey;

  /// Base URL of WAPCentral Platform API.
  final String baseUrl;

  /// Runtime environment ('production', 'staging', 'development', 'test').
  final String environment;

  /// Whether to automatically fetch in-app bell notifications on startup and on refresh.
  final bool autoFetchBell;

  /// Polling interval for background bell notifications refresh.
  final Duration bellRefreshInterval;

  /// Whether to print SDK logs to console.
  final bool enableLogging;

  /// Optional persistent device ID. If null, a deterministic or stored UUID will be used.
  final String? deviceId;

  bool get isProduction => environment == 'production';
  bool get isTest => environment == 'test';
}
