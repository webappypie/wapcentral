import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/wap_ads_options.dart';
import '../models/effective_ad_config.dart';
import '../telemetry/ad_telemetry.dart';

/// Service responsible for fetching, locally caching, and periodically refreshing
/// effective ad configurations from WAPCentral Platform API.
class WapAdsConfigService {
  final WapAdsOptions options;
  final http.Client _client;

  // In-memory active configuration
  EffectiveAdConfig? _cachedConfig;

  // Background refresh timer
  Timer? _refreshTimer;

  WapAdsConfigService({
    required this.options,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Currently active effective configuration.
  EffectiveAdConfig? get currentConfig => _cachedConfig;

  /// Initializes configuration:
  /// - Uses options.initialConfig or memory cache if present.
  /// - Attempts network fetch.
  /// - If offline, falls back gracefully to cached configuration or safe disabled mode.
  Future<EffectiveAdConfig> initialize() async {
    // 1. Check for initial pre-loaded config
    if (options.initialConfig != null) {
      _cachedConfig = options.initialConfig;
    }

    try {
      // 2. Fetch fresh configuration from WAPCentral platform API
      final freshConfig = await fetchRemoteConfig();
      _cachedConfig = freshConfig;
    } catch (e) {
      // 3. Fallback: If network failed but we have a cached config, keep using it
      if (_cachedConfig != null) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.fallback,
            appId: options.appId,
            requestId: 'req_offline_${DateTime.now().millisecondsSinceEpoch}',
            metadata: {'reason': 'Network unavailable, using cached config', 'error': e.toString()},
          ),
        );
      } else {
        // Safe fail: Return disabled configuration that never breaks the host app
        _cachedConfig = EffectiveAdConfig.safeDisabled(appId: options.appId);
      }
    }

    // 4. Start background refresh timer if enabled
    if (options.autoRefreshConfig && options.refreshInterval > Duration.zero) {
      _startBackgroundRefresh();
    }

    return _cachedConfig!;
  }

  /// Fetches effective ad configuration directly from WAPCentral.
  /// Endpoint: GET /api/platform/v1/ads/config
  Future<EffectiveAdConfig> fetchRemoteConfig() async {
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/ads/config');
    final requestId = 'req_${DateTime.now().millisecondsSinceEpoch}';

    AdTelemetryDispatcher.dispatch(
      AdEvent(
        type: AdEventType.request,
        appId: options.appId,
        requestId: requestId,
        metadata: {'url': uri.toString()},
      ),
    );

    final response = await _client.get(
      uri,
      headers: {
        'Accept': 'application/json',
        'X-App-Id': options.appId,
        'X-App-Key': options.appKey,
      },
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final config = EffectiveAdConfig.fromJson(json);

      // Check if version changed
      final bool isNewVersion = _cachedConfig == null || _cachedConfig!.version != config.version;
      _cachedConfig = config;

      if (isNewVersion) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.configRefresh,
            appId: options.appId,
            requestId: requestId,
            metadata: {'version': config.version, 'masterEnabled': config.enabled},
          ),
        );
      }

      if (!config.enabled) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.killSwitch,
            appId: options.appId,
            requestId: requestId,
            metadata: {'scope': 'global_or_app_ads_disabled'},
          ),
        );
      }

      return config;
    } else {
      throw Exception(
        'Failed to fetch ad config from WAPCentral. Status: ${response.statusCode}, Body: ${response.body}',
      );
    }
  }

  void _startBackgroundRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(options.refreshInterval, (_) async {
      try {
        await fetchRemoteConfig();
      } catch (_) {
        // Background refresh failures are non-fatal; existing cached config remains active
      }
    });
  }

  /// Sets configuration manually (used for tests and offline mocks).
  void setManualConfig(EffectiveAdConfig config) {
    _cachedConfig = config;
  }

  /// Disposes timers and HTTP client.
  void dispose() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _client.close();
  }
}
