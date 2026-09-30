import 'package:flutter/widgets.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';

/// Abstract adapter interface implemented by all advertising provider backends.
abstract class AdProviderAdapter {
  /// The network provider this adapter handles.
  AdNetwork get network;

  /// Whether the adapter has completed its asynchronous initialization.
  bool get isInitialized;

  /// Initializes the provider with client credentials and global options.
  Future<bool> initialize(AdConfig config);

  /// Requests and preloads an ad of the given [format].
  Future<AdLoadResult> loadAd(
    AdFormat format, {
    String? adUnitId,
  });

  /// Builds a rendered banner widget for placement inside Flutter widget trees.
  Widget buildBannerWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  });

  /// Builds a rendered native ad widget.
  Widget buildNativeWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  });

  /// Displays a full-screen interstitial ad.
  Future<bool> showInterstitial({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  });

  /// Displays a full-screen rewarded video ad.
  Future<bool> showRewarded({
    required BuildContext context,
    String? adUnitId,
    required Function(num amount, String type) onUserEarnedReward,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  });

  /// Cleans up listeners, controllers, or native bridges.
  void dispose();
}
