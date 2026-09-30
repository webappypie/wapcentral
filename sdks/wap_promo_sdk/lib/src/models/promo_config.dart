/// Configuration options for initializing the WapPromoSdk.
class PromoConfig {
  /// The unique identifier of the host application (e.g. 'app_01').
  final String appId;

  /// The public app key used for promotion-api authentication (identifies app, not a secret).
  final String appKey;

  /// The root URL of the promotion API (e.g. 'https://promotion-api.webappypie.com').
  final String baseUrl;

  /// The shared secret used to verify HMAC-SHA256 signatures of delivered campaigns.
  final String signingSecret;

  /// The current semantic version of the host application (e.g. '1.0.0').
  final String appVersion;

  /// The target platform ('android', 'ios', 'web').
  final String platform;

  /// The deployment environment ('development', 'staging', 'production').
  final String environment;

  /// Default cache TTL to apply if server payload does not provide one.
  final Duration defaultCacheTtl;

  /// Maximum timeout for remote promotion network requests. Defaults to 5 seconds.
  final Duration networkTimeout;

  /// Whether to output debug log messages to the console.
  final bool enableLogging;

  const PromoConfig({
    required this.appId,
    required this.appKey,
    required this.baseUrl,
    required this.signingSecret,
    this.appVersion = '1.0.0',
    this.platform = 'android',
    this.environment = 'production',
    this.defaultCacheTtl = const Duration(hours: 6),
    this.networkTimeout = const Duration(seconds: 5),
    this.enableLogging = false,
  });

  /// Normalized base URL without trailing slash.
  String get cleanBaseUrl =>
      baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
}
