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
  final VoidCallback? onLoaded;
  final Function(String error)? onFailed;
  final VoidCallback? onClicked;

  const WapNativeAd({
    super.key,
    this.placementKey,
    this.customBuilder,
    this.onLoaded,
    this.onFailed,
    this.onClicked,
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
      widget.onFailed?.call('WAP Ads SDK is not initialized.');
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
            customBuilder: widget.customBuilder,
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
              widget.onLoaded?.call();
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
              widget.onClicked?.call();
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
          onLoaded: () {
            core.frequencyManager.recordDisplay(AdFormat.native, placementKey: widget.placementKey);
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
      setState(() => _currentAdWidget = const SizedBox.shrink());
      widget.onFailed?.call('All native mediation tiers failed to load.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return _currentAdWidget ?? const SizedBox.shrink();
  }
}
