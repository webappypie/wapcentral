import 'package:flutter/widgets.dart';
import '../core/frequency_manager.dart';
import '../core/wap_ads_core.dart';
import '../models/ad_error.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../telemetry/ad_telemetry.dart';

/// Controller for displaying full-screen interstitial advertisements.
class WapInterstitialManager {
  static Future<bool> show(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    final core = WapAdsCore.instance;
    final requestId = 'req_int_${DateTime.now().millisecondsSinceEpoch}';

    // 1. Verify initialization
    if (!core.isInitialized) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.failed,
          appId: core.options.appId,
          format: AdFormat.interstitial,
          placementKey: placementKey,
          requestId: requestId,
          metadata: {'error': AdError.notInitialized},
        ),
      );
      return false;
    }

    final config = core.config;
    // 2. Check Master & Format Kill Switches
    if (config == null || !config.isFormatEnabled(AdFormat.interstitial)) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.killSwitch,
          appId: core.options.appId,
          format: AdFormat.interstitial,
          placementKey: placementKey,
          requestId: requestId,
        ),
      );
      return false;
    }

    // 3. Check Placement Enabled
    if (!config.isPlacementEnabled(placementKey, AdFormat.interstitial)) {
      return false;
    }

    final formatConfig = config.formats[AdFormat.interstitial];
    final placementConfig = placementKey != null ? config.placements[placementKey] : null;

    // 4. Cooldown & Frequency Cap Verification
    final freqCheck = core.frequencyManager.canDisplay(
      format: AdFormat.interstitial,
      placementKey: placementKey,
      formatFrequency: formatConfig?.frequency,
      placementConfig: placementConfig,
    );

    if (!freqCheck.allowed) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.failed,
          appId: core.options.appId,
          format: AdFormat.interstitial,
          placementKey: placementKey,
          requestId: requestId,
          metadata: {'reason': freqCheck.error?.message ?? 'Frequency capped'},
        ),
      );
      return false;
    }

    // 5. Cascade through mediation waterfall tiers
    final chain = formatConfig?.mediationChain ?? [];
    for (final tier in chain) {
      final provider = core.providerRegistry.get(tier.networkId);
      if (provider != null && provider.isFormatSupported(AdFormat.interstitial)) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.request,
            appId: core.options.appId,
            format: AdFormat.interstitial,
            provider: tier.networkId,
            placementKey: placementKey,
            requestId: requestId,
          ),
        );

        final success = await provider.showInterstitial(
          context,
          tier.adUnitId,
          placementKey: placementKey,
          requestId: requestId,
        );

        if (success) {
          core.frequencyManager.recordDisplay(AdFormat.interstitial, placementKey: placementKey);
          AdTelemetryDispatcher.dispatch(
            AdEvent(
              type: AdEventType.displayed,
              appId: core.options.appId,
              format: AdFormat.interstitial,
              provider: tier.networkId,
              placementKey: placementKey,
              requestId: requestId,
            ),
          );
          onDismissed?.call();
          return true;
        } else {
          AdTelemetryDispatcher.dispatch(
            AdEvent(
              type: AdEventType.failed,
              appId: core.options.appId,
              format: AdFormat.interstitial,
              provider: tier.networkId,
              placementKey: placementKey,
              requestId: requestId,
              metadata: {'action': 'cascading_to_next_tier'},
            ),
          );
        }
      }
    }

    // 6. Waterfall Fallback to Custom Ads
    final customFallback = formatConfig?.customAdFallback;
    final customProvider = core.providerRegistry.get('custom_ads');
    if (customFallback != null && customProvider != null) {
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.fallback,
          appId: core.options.appId,
          format: AdFormat.interstitial,
          provider: 'custom_ads',
          placementKey: placementKey,
          campaignId: customFallback.campaignId,
          requestId: requestId,
        ),
      );

      final success = await customProvider.showInterstitial(
        context,
        customFallback.campaignId,
        placementKey: placementKey,
        requestId: requestId,
      );

      if (success) {
        core.frequencyManager.recordDisplay(AdFormat.interstitial, placementKey: placementKey);
        onDismissed?.call();
        return true;
      }
    }

    return false;
  }
}
