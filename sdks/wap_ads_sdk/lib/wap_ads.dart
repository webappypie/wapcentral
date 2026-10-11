import 'package:flutter/widgets.dart';
import 'src/app_open/wap_app_open_manager.dart';
import 'src/banner/wap_banner_ad.dart';
import 'src/core/wap_ads_core.dart';
import 'src/core/wap_ads_options.dart';
import 'src/interstitial/wap_interstitial_manager.dart';
import 'src/models/ad_format.dart';
import 'src/models/effective_ad_config.dart';
import 'src/models/rewarded_result.dart';
import 'src/native/wap_native_ad.dart';
import 'src/providers/wap_ad_provider.dart';
import 'src/rewarded/wap_rewarded_manager.dart';
import 'src/telemetry/ad_telemetry.dart';

// Re-export public models and widgets
export 'src/core/wap_ads_options.dart';
export 'src/models/ad_format.dart';
export 'src/models/ad_error.dart';
export 'src/models/effective_ad_config.dart';
export 'src/models/rewarded_result.dart';
export 'src/telemetry/ad_telemetry.dart';
export 'src/banner/wap_banner_ad.dart';
export 'src/native/wap_native_ad.dart';
export 'src/providers/wap_ad_provider.dart';
export 'src/providers/admob_provider.dart';
export 'src/providers/meta_provider.dart';
export 'src/providers/applovin_provider.dart';
export 'src/providers/inmobi_provider.dart';
export 'src/providers/unity_provider.dart';
export 'src/providers/custom_ads_provider.dart';
export 'src/custom_ads/custom_ad_widget.dart';

/// Developer-facing API Facade for WAPCentral Ads & Monetization SDK.
///
/// Example Usage:
/// ```dart
/// await WapAds.initialize(
///   WapAdsOptions(
///     appId: 'filezen',
///     appKey: 'wap_key_filezen_prod',
///   ),
/// );
///
/// // Banner Ad Widget
/// WapAds.banner(placementKey: 'home_bottom_banner')
///
/// // Full-screen Interstitial
/// final shown = await WapAds.showInterstitial(context);
///
/// // Rewarded Video Ad
/// final result = await WapAds.showRewarded(context);
/// if (result.rewardGranted) {
///   grantUserBonus(result.rewardAmount, result.rewardType);
/// }
/// ```
class WapAds {
  /// Initializes the WAP Ads SDK with application credentials and environment options.
  static Future<void> initialize(
    WapAdsOptions options, {
    List<WapAdProvider>? customProviders,
  }) async {
    await WapAdsCore.instance.initialize(options, customProviders: customProviders);
  }

  /// Whether the SDK is fully initialized and ready to serve ads.
  static bool get isInitialized => WapAdsCore.instance.isInitialized;

  /// The active server-authoritative effective configuration.
  static EffectiveAdConfig? get currentConfig => WapAdsCore.instance.config;

  /// Returns a managed Banner ad widget with automatic priority waterfall rotation.
  static Widget banner({
    String? placementKey,
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    return WapBannerAd(
      placementKey: placementKey,
      onLoaded: onLoaded,
      onFailed: onFailed,
      onClicked: onClicked,
    );
  }

  /// Returns a managed Native ad widget styled to blend into application content.
  static Widget native({
    String? placementKey,
    Widget Function(BuildContext context, Map<String, dynamic> data)? customBuilder,
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    return WapNativeAd(
      placementKey: placementKey,
      customBuilder: customBuilder,
      onLoaded: onLoaded,
      onFailed: onFailed,
      onClicked: onClicked,
    );
  }

  /// Displays a full-screen interstitial ad with automatic waterfall failover.
  static Future<bool> showInterstitial(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    return await WapInterstitialManager.show(
      context,
      placementKey: placementKey,
      onDismissed: onDismissed,
    );
  }

  /// Displays a rewarded video ad. Returns structured [RewardedAdResult].
  static Future<RewardedAdResult> showRewarded(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    return await WapRewardedManager.show(
      context,
      format: AdFormat.rewarded,
      placementKey: placementKey,
      onDismissed: onDismissed,
    );
  }

  /// Displays a rewarded-interstitial ad. Returns structured [RewardedAdResult].
  static Future<RewardedAdResult> showRewardedInterstitial(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    return await WapRewardedManager.show(
      context,
      format: AdFormat.rewardedInterstitial,
      placementKey: placementKey,
      onDismissed: onDismissed,
    );
  }

  /// Displays an App Open ad on cold start or when returning from background.
  static Future<bool> showAppOpen(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) async {
    return await WapAppOpenManager.show(
      context,
      placementKey: placementKey,
      onDismissed: onDismissed,
    );
  }

  /// Alias for [showAppOpen].
  static Future<bool> appOpen(
    BuildContext context, {
    String? placementKey,
    VoidCallback? onDismissed,
  }) =>
      showAppOpen(context, placementKey: placementKey, onDismissed: onDismissed);

  /// Requests an immediate background configuration refresh from WAPCentral.
  static Future<void> refreshConfig() async {
    await WapAdsCore.instance.refreshConfig();
  }

  /// Registers a telemetry listener for ad events.
  static void addTelemetryListener(AdTelemetryListener listener) {
    AdTelemetryDispatcher.addListener(listener);
  }

  /// Unregisters a telemetry listener.
  static void removeTelemetryListener(AdTelemetryListener listener) {
    AdTelemetryDispatcher.removeListener(listener);
  }
}
