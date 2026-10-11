import 'package:flutter/widgets.dart';
import '../core/frequency_manager.dart';
import '../core/wap_ads_core.dart';
import '../models/ad_error.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../telemetry/ad_telemetry.dart';

/// Controller for displaying App Open ads on cold start or returning from background.
class WapAppOpenManager {
  static Future<bool> show(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    final core = WapAdsCore.instance;
    final requestId = 'req_app_open_${DateTime.now().millisecondsSinceEpoch}';

    if (!core.isInitialized) return false;

    final config = core.config;
    if (config == null || !config.isFormatEnabled(AdFormat.appOpen)) {
      return false;
    }

    if (!config.isPlacementEnabled(placementKey, AdFormat.appOpen)) {
      return false;
    }

    final formatConfig = config.formats[AdFormat.appOpen];
    final placementConfig = placementKey != null ? config.placements[placementKey] : null;

    // Check foreground background timing rule (e.g. min 30s background)
    if (!core.frequencyManager.canShowAppOpenOnForeground(rule: formatConfig?.frequency.appForegroundRule)) {
      return false;
    }

    // Check cooldown & caps
    final freqCheck = core.frequencyManager.canDisplay(
      format: AdFormat.appOpen,
      placementKey: placementKey,
      formatFrequency: formatConfig?.frequency,
      placementConfig: placementConfig,
    );

    if (!freqCheck.allowed) {
      return false;
    }

    // Cascade mediation tiers
    final chain = formatConfig?.mediationChain ?? [];
    for (final tier in chain) {
      final provider = core.providerRegistry.get(tier.networkId);
      if (provider != null && provider.isFormatSupported(AdFormat.appOpen)) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.request,
            appId: core.options.appId,
            format: AdFormat.appOpen,
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
          core.frequencyManager.recordDisplay(AdFormat.appOpen, placementKey: placementKey);
          AdTelemetryDispatcher.dispatch(
            AdEvent(
              type: AdEventType.displayed,
              appId: core.options.appId,
              format: AdFormat.appOpen,
              provider: tier.networkId,
              placementKey: placementKey,
              requestId: requestId,
            ),
          );
          onDismissed?.call();
          return true;
        }
      }
    }

    return false;
  }
}
