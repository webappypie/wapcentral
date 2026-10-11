import 'dart:async';
import 'package:flutter/widgets.dart';
import '../config/wap_ads_config_service.dart';
import '../custom_ads/custom_ad_tracker.dart';
import '../models/effective_ad_config.dart';
import '../providers/ad_provider_registry.dart';
import '../providers/admob_provider.dart';
import '../providers/applovin_provider.dart';
import '../providers/custom_ads_provider.dart';
import '../providers/inmobi_provider.dart';
import '../providers/meta_provider.dart';
import '../providers/unity_provider.dart';
import '../providers/wap_ad_provider.dart';
import '../telemetry/ad_telemetry.dart';
import 'frequency_manager.dart';
import 'wap_ads_options.dart';

/// Central singleton runtime managing WAP Ads SDK state, configuration, and providers.
class WapAdsCore with WidgetsBindingObserver {
  static final WapAdsCore instance = WapAdsCore._internal();

  WapAdsCore._internal();

  WapAdsOptions _options = const WapAdsOptions(appId: '', appKey: '');
  WapAdsConfigService? _configService;
  final FrequencyManager _frequencyManager = FrequencyManager();
  final AdProviderRegistry _providerRegistry = AdProviderRegistry();
  CustomAdTracker? _customAdTracker;
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;
  WapAdsOptions get options => _options;
  EffectiveAdConfig? get config => _configService?.currentConfig;
  FrequencyManager get frequencyManager => _frequencyManager;
  AdProviderRegistry get providerRegistry => _providerRegistry;
  CustomAdTracker? get customAdTracker => _customAdTracker;

  /// Initializes the SDK with developer-configured options.
  Future<void> initialize(
    WapAdsOptions options, {
    List<WapAdProvider>? customProviders,
    WapAdsConfigService? mockConfigService,
  }) async {
    _options = options;

    if (options.telemetryListener != null) {
      AdTelemetryDispatcher.addListener(options.telemetryListener!);
    }

    _customAdTracker = CustomAdTracker(options: options);

    // Register default providers if not already present
    _providerRegistry.register(AdMobProvider());
    _providerRegistry.register(MetaProvider());
    _providerRegistry.register(AppLovinProvider());
    _providerRegistry.register(InMobiProvider());
    _providerRegistry.register(UnityAdsProvider());
    _providerRegistry.register(CustomAdsProvider(tracker: _customAdTracker));

    // Register custom overrides/bridges (e.g. for testing)
    if (customProviders != null) {
      for (final p in customProviders) {
        _providerRegistry.register(p);
      }
    }

    // Initialize configuration service
    _configService = mockConfigService ?? WapAdsConfigService(options: options);
    final effectiveConfig = await _configService!.initialize();

    // Initialize registered providers concurrently
    final initFutures = _providerRegistry.all.map(
      (p) => p.initialize(effectiveConfig, testMode: options.testMode).catchError((_) {}),
    );
    await Future.wait(initFutures);

    _isInitialized = true;

    // Observe app lifecycle events for background/foreground tracking
    try {
      WidgetsBinding.instance.addObserver(this);
    } catch (_) {
      // In headless test environments WidgetsBinding might be inactive
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _frequencyManager.recordAppBackgrounded();
    }
  }

  /// Manually trigger a background configuration refresh from WAPCentral.
  Future<void> refreshConfig() async {
    if (_configService != null) {
      await _configService!.fetchRemoteConfig();
    }
  }

  /// Cleans up state, observers, and listeners (used primarily in tests).
  void reset() {
    try {
      WidgetsBinding.instance.removeObserver(this);
    } catch (_) {}
    _configService?.dispose();
    _configService = null;
    _customAdTracker?.dispose();
    _customAdTracker = null;
    _frequencyManager.reset();
    _providerRegistry.clear();
    AdTelemetryDispatcher.clearListeners();
    _isInitialized = false;
  }
}
