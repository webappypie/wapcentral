import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../custom_ads/custom_ad_widget.dart';
import '../custom_ads/custom_ad_tracker.dart';
import 'wap_ad_provider.dart';

/// Provider adapter for WebAppyPie first-party custom promotional ads.
class CustomAdsProvider implements WapAdProvider {
  EffectiveAdConfig? _config;
  CustomAdTracker? _tracker;

  CustomAdsProvider({CustomAdTracker? tracker}) : _tracker = tracker;

  @override
  String get id => 'custom_ads';

  @override
  String get name => 'WebAppyPie Custom Ads';

  void setTracker(CustomAdTracker tracker) {
    _tracker = tracker;
  }

  @override
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false}) async {
    _config = config;
  }

  @override
  bool isFormatSupported(AdFormat format) => true;

  @override
  Future<bool> showInterstitial(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  }) async {
    final formatConfig = _config?.formats[AdFormat.interstitial];
    final fallback = formatConfig?.customAdFallback;
    if (fallback == null) return false;

    // Track impression
    _tracker?.track(
      campaignId: fallback.campaignId,
      type: 'impression',
      placementKey: placementKey,
      format: AdFormat.interstitial,
    );

    // Show dialog
    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => AlertDialog(
        title: Text(fallback.title),
        content: Text(fallback.description),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              _tracker?.track(
                campaignId: fallback.campaignId,
                type: 'click',
                placementKey: placementKey,
                format: AdFormat.interstitial,
              );
              Navigator.of(ctx).pop();
            },
            child: Text(fallback.ctaText),
          ),
        ],
      ),
    );
    return true;
  }

  @override
  Future<RewardedAdResult> showRewarded(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  }) async {
    final reqId = requestId ?? 'req_${DateTime.now().millisecondsSinceEpoch}';
    final formatConfig = _config?.formats[AdFormat.rewarded];
    final fallback = formatConfig?.customAdFallback;
    if (fallback == null) {
      return RewardedAdResult.skipped(provider: id, requestId: reqId);
    }

    _tracker?.track(
      campaignId: fallback.campaignId,
      type: 'impression',
      placementKey: placementKey,
      format: AdFormat.rewarded,
    );

    // Prompt user with interactive promotion
    bool userCompleted = false;
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text('Sponsored Reward: ${fallback.title}'),
        content: Text('${fallback.description}\n\nInteract to receive reward!'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              userCompleted = true;
              _tracker?.track(
                campaignId: fallback.campaignId,
                type: 'click',
                placementKey: placementKey,
                format: AdFormat.rewarded,
              );
              Navigator.of(ctx).pop();
            },
            child: Text(fallback.ctaText),
          ),
        ],
      ),
    );

    if (userCompleted) {
      return RewardedAdResult.granted(
        provider: id,
        requestId: reqId,
        rewardType: 'bonus_credits',
        rewardAmount: 2,
      );
    } else {
      return RewardedAdResult.skipped(provider: id, requestId: reqId);
    }
  }

  @override
  Widget buildBanner(
    BuildContext context,
    String adUnitId, {
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    final formatConfig = _config?.formats[AdFormat.banner];
    final fallback = formatConfig?.customAdFallback ??
        const CustomAdFallback(
          campaignId: 'house_promo_01',
          title: 'WebAppyPie Central',
          description: 'Explore more apps by WebAppyPie.',
          ctaText: 'Discover',
          destinationUrl: 'https://webappypie.com',
        );

    return CustomAdWidget(
      fallbackData: fallback,
      format: AdFormat.banner,
      tracker: _tracker,
      onLoaded: onLoaded,
      onClicked: onClicked,
    );
  }

  @override
  Widget buildNative(
    BuildContext context,
    String adUnitId, {
    Widget Function(BuildContext context, Map<String, dynamic> data)? customBuilder,
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    final formatConfig = _config?.formats[AdFormat.native];
    final fallback = formatConfig?.customAdFallback ??
        const CustomAdFallback(
          campaignId: 'house_promo_01',
          title: 'Featured App',
          description: 'Try the all-in-one platform suite by WebAppyPie.',
          ctaText: 'Explore',
          destinationUrl: 'https://webappypie.com',
        );

    return CustomAdWidget(
      fallbackData: fallback,
      format: AdFormat.native,
      tracker: _tracker,
      onLoaded: onLoaded,
      onClicked: onClicked,
    );
  }
}
