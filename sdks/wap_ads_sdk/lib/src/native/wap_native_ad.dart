import 'package:flutter/material.dart';
import '../core/frequency_manager.dart';
import '../core/wap_ads_core.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../telemetry/ad_telemetry.dart';

/// Flutter Native Ad widget for WAPCentral.
class WapNativeAd extends StatefulWidget {
  final String? placementKey;
  final Widget Function(BuildContext context, Map<String, dynamic> data)? customBuilder;
  final Widget Function(BuildContext context, Map<String, dynamic> data)? builder;
  final VoidCallback? onLoaded;
  final Function(String error)? onFailed;
  final VoidCallback? onClicked;
  final VoidCallback? onAdLoaded;
  final Function(String error)? onAdFailedToLoad;
  final VoidCallback? onAdClicked;

  Widget Function(BuildContext context, Map<String, dynamic> data)? get effectiveBuilder =>
      customBuilder ?? builder;
  VoidCallback? get effectiveOnLoaded => onLoaded ?? onAdLoaded;
  Function(String error)? get effectiveOnFailed => onFailed ?? onAdFailedToLoad;
  VoidCallback? get effectiveOnClicked => onClicked ?? onAdClicked;

  const WapNativeAd({
    super.key,
    this.placementKey,
    this.customBuilder,
    this.builder,
    this.onLoaded,
    this.onFailed,
    this.onClicked,
    this.onAdLoaded,
    this.onAdFailedToLoad,
    this.onAdClicked,
  });

  @override
  State<WapNativeAd> createState() => _WapNativeAdState();
}

class _WapNativeAdState extends State<WapNativeAd> {
  int _currentTierIndex = 0;
  Widget? _currentAdWidget;
  String _activeRequestId = '';

  @override
  void initState() {
    super.initState();
    _loadWaterfallNative();
  }

  @override
  void didUpdateWidget(WapNativeAd oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.placementKey != widget.placementKey) {
      _loadWaterfallNative();
    }
  }

  void _loadWaterfallNative() {
    if (!mounted) return;
    final core = WapAdsCore.instance;

    if (!core.isInitialized) {
      widget.effectiveOnFailed?.call('WAP Ads SDK is not initialized.');
      return;
    }

    final config = core.config;
    if (config == null || !config.isFormatEnabled(AdFormat.native)) {
      setState(() => _currentAdWidget = const SizedBox.shrink());
      return;
    }

    if (!config.isPlacementEnabled(widget.placementKey, AdFormat.native)) {
      setState(() => _currentAdWidget = const SizedBox.shrink());
      return;
    }

    final formatConfig = config.formats[AdFormat.native];
    final placementConfig = widget.placementKey != null ? config.placements[widget.placementKey] : null;

    final freqCheck = core.frequencyManager.canDisplay(
      format: AdFormat.native,
      placementKey: widget.placementKey,
      formatFrequency: formatConfig?.frequency,
      placementConfig: placementConfig,
    );

    if (!freqCheck.allowed) {
      setState(() => _currentAdWidget = const SizedBox.shrink());
      widget.onFailed?.call(freqCheck.error?.message ?? 'Frequency capped');
      return;
    }

    _currentTierIndex = 0;
    _activeRequestId = 'req_n_${DateTime.now().millisecondsSinceEpoch}';
    _tryCurrentTier();
  }

  void _tryCurrentTier() {
    if (!mounted) return;
    final core = WapAdsCore.instance;
    final config = core.config;
    final formatConfig = config?.formats[AdFormat.native];
    final chain = formatConfig?.mediationChain ?? [];

    if (_currentTierIndex < chain.length) {
      final tier = chain[_currentTierIndex];
      final provider = core.providerRegistry.get(tier.networkId);

      if (provider != null && provider.isFormatSupported(AdFormat.native)) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.request,
            appId: core.options.appId,
            format: AdFormat.native,
            provider: tier.networkId,
            placementKey: widget.placementKey,
            requestId: _activeRequestId,
          ),
        );

        setState(() {
          _currentAdWidget = provider.buildNative(
            context,
            tier.adUnitId,
            customBuilder: widget.effectiveBuilder,
            onLoaded: () {
              core.frequencyManager.recordDisplay(AdFormat.native, placementKey: widget.placementKey);
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.loaded,
                  appId: core.options.appId,
                  format: AdFormat.native,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                ),
              );
              widget.effectiveOnLoaded?.call();
            },
            onFailed: (error) {
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.failed,
                  appId: core.options.appId,
                  format: AdFormat.native,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                  metadata: {'error': error},
                ),
              );
              _currentTierIndex++;
              _tryCurrentTier();
            },
            onClicked: () {
              AdTelemetryDispatcher.dispatch(
                AdEvent(
                  type: AdEventType.clicked,
                  appId: core.options.appId,
                  format: AdFormat.native,
                  provider: tier.networkId,
                  placementKey: widget.placementKey,
                  requestId: _activeRequestId,
                ),
              );
              widget.effectiveOnClicked?.call();
            },
          );
        });
        return;
      } else {
        _currentTierIndex++;
        _tryCurrentTier();
        return;
      }
    }

    // Custom fallback
    final customFallback = formatConfig?.customAdFallback;
    final customProvider = core.providerRegistry.get('custom_ads');

    if (customFallback != null && customProvider != null) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.fallback,
          appId: core.options.appId,
          format: AdFormat.native,
          provider: 'custom_ads',
          placementKey: widget.placementKey,
          campaignId: customFallback.campaignId,
          requestId: _activeRequestId,
        ),
      );

      setState(() {
        _currentAdWidget = customProvider.buildNative(
          context,
          customFallback.campaignId,
          customBuilder: widget.effectiveBuilder,
          onLoaded: () {
            core.frequencyManager.recordDisplay(AdFormat.native, placementKey: widget.placementKey);
            widget.effectiveOnLoaded?.call();
          },
          onFailed: (err) {
            setState(() => _currentAdWidget = const SizedBox.shrink());
            widget.effectiveOnFailed?.call(err);
          },
          onClicked: widget.effectiveOnClicked,
        );
      });
    } else {
      setState(() => _currentAdWidget = const SizedBox.shrink());
      widget.effectiveOnFailed?.call('All native mediation tiers failed to load.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return _currentAdWidget ?? const SizedBox.shrink();
  }
}
