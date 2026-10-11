import 'dart:async';
import 'package:flutter/material.dart';
import '../core/frequency_manager.dart';
import '../core/wap_ads_core.dart';
import '../models/ad_error.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../providers/wap_ad_provider.dart';
import '../telemetry/ad_telemetry.dart';

/// Production-ready Flutter Banner Ad widget for WAPCentral.
///
/// Automatically handles:
/// - Priority waterfall rotation across AdMob, Meta, AppLovin, and WebAppyPie Custom Ads.
/// - Fallback cascade upon load failures.
/// - Safe banner refresh intervals (strictly enforced >= 30s, default 60s) without artificial rapid reloading.
/// - Kill-switch and placement disabled suppression.
class WapBannerAd extends StatefulWidget {
  /// In-app placement identifier (e.g. 'main_dashboard_banner', 'reader_bottom_banner').
  final String? placementKey;

  /// Invoked when a banner ad creative successfully loads.
  final VoidCallback? onLoaded;

  /// Invoked when banner ad loading fails across all waterfall tiers.
  final Function(String error)? onFailed;

  /// Invoked when the banner is clicked.
  final VoidCallback? onClicked;

  const WapBannerAd({
    super.key,
    this.placementKey,
    this.onLoaded,
    this.onFailed,
    this.onClicked,
  });

  @override
  State<WapBannerAd> createState() => _WapBannerAdState();
}

class _WapBannerAdState extends State<WapBannerAd> {
  Timer? _refreshTimer;
  int _currentTierIndex = 0;
  Widget? _currentAdWidget;
  bool _isLoading = false;
  String _activeRequestId = '';

  @override
  void initState() {
    super.initState();
    _loadWaterfallBanner();
  }

  @override
  void didUpdateWidget(WapBannerAd oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.placementKey != widget.placementKey) {
      _loadWaterfallBanner();
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _loadWaterfallBanner() {
    if (!mounted) return;
    final core = WapAdsCore.instance;

    // 1. Check Initialization & Master Kill Switches
    if (!core.isInitialized) {
      widget.onFailed?.call('WAP Ads SDK is not initialized.');
      return;
    }

    final config = core.config;
    if (config == null || !config.isFormatEnabled(AdFormat.banner)) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.killSwitch,
          appId: core.options.appId,
          format: AdFormat.banner,
          placementKey: widget.placementKey,
          requestId: 'req_suppressed_${DateTime.now().millisecondsSinceEpoch}',
        ),
      );
      setState(() => _currentAdWidget = const SizedBox.shrink());
      return;
    }

    // 2. Check Placement Level Constraints
    if (!config.isPlacementEnabled(widget.placementKey, AdFormat.banner)) {
      setState(() => _currentAdWidget = const SizedBox.shrink());
      return;
    }

    final formatConfig = config.formats[AdFormat.banner];
    final placementConfig = widget.placementKey != null ? config.placements[widget.placementKey] : null;

    // 3. Frequency & Cooldown Validation
    final freqCheck = core.frequencyManager.canDisplay(
      format: AdFormat.banner,
      placementKey: widget.placementKey,
      formatFrequency: formatConfig?.frequency,
      placementConfig: placementConfig,
    );

    if (!freqCheck.allowed) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.failed,
          appId: core.options.appId,
          format: AdFormat.banner,
          placementKey: widget.placementKey,
          requestId: 'req_freq_${DateTime.now().millisecondsSinceEpoch}',
          metadata: {'reason': freqCheck.error?.message ?? 'Frequency capped'},
        ),
      );
      setState(() => _currentAdWidget = const SizedBox.shrink());
      return;
    }

    _currentTierIndex = 0;
    _activeRequestId = 'req_b_${DateTime.now().millisecondsSinceEpoch}';
    _tryCurrentTier();
    _scheduleSafeRefresh(formatConfig?.refreshIntervalSeconds ?? 60);
  }

  void _tryCurrentTier() {
    if (!mounted) return;
    final core = WapAdsCore.instance;
    final config = core.config;
    final formatConfig = config?.formats[AdFormat.banner];
    final chain = formatConfig?.mediationChain ?? [];

    if (_currentTierIndex < chain.length) {
      final tier = chain[_currentTierIndex];
      final provider = core.providerRegistry.get(tier.networkId);

      if (provider != null && provider.isFormatSupported(AdFormat.banner)) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.request,
            appId: core.options.appId,
            format: AdFormat.banner,
            provider: tier.networkId,
            placementKey: widget.placementKey,
            requestId: _activeRequestId,
          ),
        );

        setState(() {
          _currentAdWidget = provider.buildBanner(
            context,
            tier.adUnitId,
            onLoaded: () {
              core.frequencyManager.recordDisplay(AdFormat.banner, placementKey: widget.placementKey);
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.loaded,
                  appId: core.options.appId,
                  format: AdFormat.banner,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                ),
              );
              widget.onLoaded?.call();
            },
            onFailed: (error) {
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.failed,
                  appId: core.options.appId,
                  format: AdFormat.banner,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                  metadata: {'error': error},
                ),
              );
              // Waterfall Cascade to next tier
              _currentTierIndex++;
              _tryCurrentTier();
            },
            onClicked: () {
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.clicked,
                  appId: core.options.appId,
                  format: AdFormat.banner,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                ),
              );
              widget.onClicked?.call();
            },
          );
        });
        return;
      } else {
        // Provider not registered or format not supported, cascade
        _currentTierIndex++;
        _tryCurrentTier();
        return;
      }
    }

    // 4. Waterfall Exhausted -> Fallback to Custom WebAppyPie Ads
    final customFallback = formatConfig?.customAdFallback;
    final customProvider = core.providerRegistry.get('custom_ads');

    if (customFallback != null && customProvider != null) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.fallback,
          appId: core.options.appId,
          format: AdFormat.banner,
          provider: 'custom_ads',
          placementKey: widget.placementKey,
          campaignId: customFallback.campaignId,
          requestId: _activeRequestId,
        ),
      );

      setState(() {
        _currentAdWidget = customProvider.buildBanner(
          context,
          customFallback.campaignId,
          onLoaded: () {
            core.frequencyManager.recordDisplay(AdFormat.banner, placementKey: widget.placementKey);
            widget.onLoaded?.call();
          },
          onFailed: (err) {
            setState(() => _currentAdWidget = const SizedBox.shrink());
            widget.onFailed?.call(err);
          },
          onClicked: widget.onClicked,
        );
      });
    } else {
      // Complete Waterfall Exhaustion without Custom Fallback
      setState(() => _currentAdWidget = const SizedBox.shrink());
      widget.onFailed?.call('All ad mediation tiers failed to load.');
    }
  }

  void _scheduleSafeRefresh(int refreshIntervalSeconds) {
    _refreshTimer?.cancel();
    // Strictly enforce minimum safe banner refresh interval of 30 seconds (policy safe default 60s)
    final safeInterval = refreshIntervalSeconds < 30 ? 30 : refreshIntervalSeconds;

    _refreshTimer = Timer.periodic(Duration(seconds: safeInterval), (_) {
      if (mounted) {
        _loadWaterfallBanner();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return _currentAdWidget ?? const SizedBox.shrink();
  }
}
