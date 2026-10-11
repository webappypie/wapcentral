import 'package:flutter/widgets.dart';
import '../core/frequency_manager.dart';
import '../core/wap_ads_core.dart';
import '../models/ad_error.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../telemetry/ad_telemetry.dart';

/// Controller for displaying rewarded video and rewarded-interstitial advertisements.
class WapRewardedManager {
  /// Displays a rewarded ad. Returns [RewardedAdResult] detailing whether the reward was granted.
  static Future<RewardedAdResult> show(
    BuildContext context, {
    AdFormat format = AdFormat.rewarded,
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    final core = WapAdsCore.instance;
    final requestId = 'req_rew_${DateTime.now().millisecondsSinceEpoch}';

    // 1. Verify initialization
    if (!core.isInitialized) {
      final error = const AdError(code: AdError.notInitialized, message: 'WAP Ads SDK is not initialized.');
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.failed,
          appId: core.options.appId,
          format: format,
          placementKey: placementKey,
          requestId: requestId,
          metadata: {'error': error.code},
        ),
      );
      return RewardedAdResult.failed(provider: 'none', requestId: requestId, error: error);
    }

    final config = core.config;
    // 2. Check Master & Format Kill Switches
    if (config == null || !config.isFormatEnabled(format)) {
      final error = const AdError(code: AdError.globalKillSwitch, message: 'Rewarded ads are disabled in WAPCentral.');
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.killSwitch,
          appId: core.options.appId,
          format: format,
          placementKey: placementKey,
          requestId: requestId,
        ),
      );
      return RewardedAdResult.failed(provider: 'none', requestId: requestId, error: error);
    }

    // 3. Check Placement Level Constraints
    if (!config.isPlacementEnabled(placementKey, format)) {
      final error = const AdError(code: AdError.placementDisabled, message: 'Placement is disabled.');
      return RewardedAdResult.failed(provider: 'none', requestId: requestId, error: error);
    }

    final formatConfig = config.formats[format];
    final placementConfig = placementKey != null ? config.placements[placementKey] : null;

    // 4. Cooldown & Frequency Cap Verification
    final freqCheck = core.frequencyManager.canDisplay(
      format: format,
      placementKey: placementKey,
      formatFrequency: formatConfig?.frequency,
      placementConfig: placementConfig,
    );

    if (!freqCheck.allowed) {
      final error = freqCheck.error ?? const AdError(code: AdError.frequencyCapped, message: 'Frequency capped');
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.failed,
          appId: core.options.appId,
          format: format,
          placementKey: placementKey,
          requestId: requestId,
          metadata: {'reason': error.message},
        ),
      );
      return RewardedAdResult.failed(provider: 'none', requestId: requestId, error: error);
    }

    // 5. Cascade through mediation waterfall
    final chain = formatConfig?.mediationChain ?? [];
    for (final tier in chain) {
      final provider = core.providerRegistry.get(tier.networkId);
      if (provider != null && provider.isFormatSupported(format)) {
        AdTelemetryDispatcher.dispatch(
          AdEvent(
            type: AdEventType.request,
            appId: core.options.appId,
            format: format,
            provider: tier.networkId,
            placementKey: placementKey,
            requestId: requestId,
          ),
        );

        final result = await provider.showRewarded(
          context,
          tier.adUnitId,
          placementKey: placementKey,
          requestId: requestId,
        );

        if (result.success) {
          core.frequencyManager.recordDisplay(format, placementKey: placementKey);
          AdTelemetryDispatcher.dispatch(
            AdEvent(
              type: result.rewardGranted ? AdEventType.rewarded : AdEventType.displayed,
              appId: core.options.appId,
              format: format,
              provider: tier.networkId,
              placementKey: placementKey,
              requestId: requestId,
              metadata: {
                'rewardGranted': result.rewardGranted,
                'rewardType': result.rewardType,
                'rewardAmount': result.rewardAmount,
              },
            ),
          );
          onDismissed?.call();
          return result;
        } else {
          AdTelemetryDispatcher.dispatch(
            AdEvent(
              type: AdEventType.failed,
              appId: core.options.appId,
              format: format,
              provider: tier.networkId,
              placementKey: placementKey,
              requestId: requestId,
              metadata: {'error': result.error?.message, 'action': 'cascading'},
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
          format: format,
          provider: 'custom_ads',
          placementKey: placementKey,
          campaignId: customFallback.campaignId,
          requestId: requestId,
        ),
      );

      final result = await customProvider.showRewarded(
        context,
        customFallback.campaignId,
        placementKey: placementKey,
        requestId: requestId,
      );

      if (result.success) {
        core.frequencyManager.recordDisplay(format, placementKey: placementKey);
        onDismissed?.call();
        return result;
      }
    }

    return RewardedAdResult.failed(
      provider: 'none',
      requestId: requestId,
      error: const AdError(code: AdError.waterfallExhausted, message: 'All rewarded ad tiers exhausted without fill.'),
    );
  }
}
