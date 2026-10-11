import 'package:flutter/widgets.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';

/// Abstract contract for ad network provider adapters (AdMob, Meta, AppLovin, Custom Ads).
abstract class WapAdProvider {
  /// Unique identifier of the provider (e.g. 'admob', 'meta', 'applovin', 'custom_ads').
  String get id;

  /// Human-readable provider name.
  String get name;

  /// Initializes the provider with configuration.
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false});

  /// Check whether the provider supports the given ad format.
  bool isFormatSupported(AdFormat format);

  /// Load and display a full-screen interstitial ad.
  Future<bool> showInterstitial(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  });

  /// Load and display a rewarded video or rewarded-interstitial ad.
  /// Reward MUST only be granted if the user fully watches or meets completion requirements.
  Future<RewardedAdResult> showRewarded(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  });

  /// Builds a Banner ad widget for this provider.
  Widget buildBanner(
    BuildContext context,
    String adUnitId, {
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  });

  /// Builds a Native ad widget for this provider.
  Widget buildNative(
    BuildContext context,
    String adUnitId, {
    Widget Function(BuildContext context, Map<String, dynamic> data)? customBuilder,
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  });
}
