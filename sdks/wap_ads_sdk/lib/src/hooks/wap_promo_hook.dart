import 'package:flutter/widgets.dart';

/// Callback signatures for decoupled promotion hooks.
typedef PromoBannerBuilder = Widget Function(
  BuildContext context, {
  VoidCallback? onAdClicked,
  VoidCallback? onAdLoaded,
});

typedef PromoNativeBuilder = Widget Function(
  BuildContext context, {
  VoidCallback? onAdClicked,
  VoidCallback? onAdLoaded,
});

typedef PromoInterstitialHandler = Future<bool> Function(
  BuildContext context, {
  VoidCallback? onDismissed,
});

/// Abstract hook interface allowing host apps to cleanly delegate WAPAds house-ad
/// requests to `wap_promo_sdk` without tight coupling between SDK packages.
abstract class WapPromoHook {
  /// Whether a valid house promo campaign is currently available to serve.
  bool get isAvailable;

  /// Builds a promotional banner widget.
  Widget buildBanner(
    BuildContext context, {
    VoidCallback? onAdClicked,
    VoidCallback? onAdLoaded,
  });

  /// Builds a promotional native card widget.
  Widget buildNative(
    BuildContext context, {
    VoidCallback? onAdClicked,
    VoidCallback? onAdLoaded,
  });

  /// Presents a full-screen promotional interstitial dialog/route.
  Future<bool> showInterstitial(
    BuildContext context, {
    VoidCallback? onDismissed,
  });
}

/// Convenience implementation of [WapPromoHook] accepting lambda builders.
class DelegatePromoHook implements WapPromoHook {
  final bool Function()? availabilityChecker;
  final PromoBannerBuilder? bannerBuilder;
  final PromoNativeBuilder? nativeBuilder;
  final PromoInterstitialHandler? interstitialHandler;

  const DelegatePromoHook({
    this.availabilityChecker,
    this.bannerBuilder,
    this.nativeBuilder,
    this.interstitialHandler,
  });

  @override
  bool get isAvailable => availabilityChecker?.call() ?? true;

  @override
  Widget buildBanner(
    BuildContext context, {
    VoidCallback? onAdClicked,
    VoidCallback? onAdLoaded,
  }) {
    if (bannerBuilder != null) {
      return bannerBuilder!(context, onAdClicked: onAdClicked, onAdLoaded: onAdLoaded);
    }
    return const SizedBox.shrink();
  }

  @override
  Widget buildNative(
    BuildContext context, {
    VoidCallback? onAdClicked,
    VoidCallback? onAdLoaded,
  }) {
    if (nativeBuilder != null) {
      return nativeBuilder!(context, onAdClicked: onAdClicked, onAdLoaded: onAdLoaded);
    }
    return const SizedBox.shrink();
  }

  @override
  Future<bool> showInterstitial(
    BuildContext context, {
    VoidCallback? onDismissed,
  }) async {
    if (interstitialHandler != null) {
      return await interstitialHandler!(context, onDismissed: onDismissed);
    }
    return false;
  }
}
