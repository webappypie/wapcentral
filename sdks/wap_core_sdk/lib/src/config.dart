/// Configuration settings for the WAPCentral Platform client.
class WapConfig {
  /// Unique application identifier registered on WAPCentral (e.g. "filezen", "optilens").
  final String appId;

  /// Application secret key issued by WAPCentral.
  /// Used solely for authenticating the app against the platform API gateway.
  /// Provider secrets (OpenAI, Gemini, etc.) NEVER reach the application.
  final String appKey;

  /// Base URL of the WAPCentral Platform API Gateway.
  /// Defaults to production endpoint: https://wapcentral-prod.web.app/api/platform/v1
  final String baseUrl;

  /// Deployment environment.
  final String environment;

  /// SDK version reported in telemetry.
  final String sdkVersion;

  /// HTTP timeout in milliseconds.
  final int timeoutMs;

  /// Maximum retry attempts on transient network failures.
  final int maxRetries;

  /// Core principle: Local first.
  /// Indicates whether the SDK should attempt on-device processing first where supported.
  final bool preferLocal;

  const WapConfig({
    required this.appId,
    required this.appKey,
    this.baseUrl = 'https://wapcentral-prod.web.app/api/platform/v1',
    this.environment = 'production',
    this.sdkVersion = '0.1.0',
    this.timeoutMs = 15000,
    this.maxRetries = 2,
    this.preferLocal = true,
  });

  /// Factory for FileZen app configuration.
  factory WapConfig.filezen({
    required String appKey,
    String? baseUrl,
    String environment = 'production',
    bool preferLocal = true,
  }) {
    return WapConfig(
      appId: 'filezen',
      appKey: appKey,
      baseUrl: baseUrl ?? 'https://wapcentral-prod.web.app/api/platform/v1',
      environment: environment,
      preferLocal: preferLocal,
    );
  }

  /// Factory for OptiLens AI app configuration.
  factory WapConfig.optilens({
    required String appKey,
    String? baseUrl,
    String environment = 'production',
    bool preferLocal = true,
  }) {
    return WapConfig(
      appId: 'optilens',
      appKey: appKey,
      baseUrl: baseUrl ?? 'https://wapcentral-prod.web.app/api/platform/v1',
      environment: environment,
      preferLocal: preferLocal,
    );
  }
}
