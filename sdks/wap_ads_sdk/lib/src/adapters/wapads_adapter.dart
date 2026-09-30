import 'package:flutter/widgets.dart';
import '../hooks/wap_promo_hook.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// First-party WAPAds adapter that delegates house-ad requests to the host application's
/// registered [WapPromoHook] (e.g. `wap_promo_sdk`), maintaining zero-coupling between SDKs.
class WapAdsAdapter implements AdProviderAdapter {
  WapPromoHook? _promoHook;
  bool _initialized = false;
  AdConfig? _config;

  WapAdsAdapter({WapPromoHook? promoHook}) : _promoHook = promoHook;

  /// Updates or injects the active [WapPromoHook] delegate.
  void setPromoHook(WapPromoHook hook) {
    _promoHook = hook;
  }

  /// The active promo hook.
  WapPromoHook? get promoHook => _promoHook;

  @override
  AdNetwork get network => AdNetwork.wapads;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final wapadsCfg = config.wapads;
    if (wapadsCfg == null || !wapadsCfg.enabled) {
      _initialized = false;
      return false;
    }

    _initialized = true;
    return true;
  }

  @override
  Future<AdLoadResult> loadAd(AdFormat format, {String? adUnitId}) async {
    if (!_initialized || _config == null) {
      return AdLoadResult.skipped(
        network: AdNetwork.wapads,
        format: format,
        reason: 'WAPAds adapter is not enabled in app config',
      );
    }

    if (_promoHook == null) {
      return AdLoadResult.noFill(
        network: AdNetwork.wapads,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'No WapPromoHook registered by host application',
      );
    }

    if (!_promoHook!.isAvailable) {
      return AdLoadResult.noFill(
        network: AdNetwork.wapads,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'WAPAds promo campaign is not currently available or capped',
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.wapads,
      format: format,
      adUnitId: adUnitId ?? _config?.wapads?.appKey,
    );
  }

  @override
  Widget buildBannerWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  }) {
    if (_promoHook == null || !_promoHook!.isAvailable) {
      onAdFailedToLoad?.call('WAPAds hook unavailable');
      return const SizedBox.shrink();
    }

    onAdLoaded?.call();
    return KeyedSubtree(
      key: const ValueKey('wapads_house_banner_widget'),
      child: _promoHook!.buildBanner(
        context,
        onAdClicked: onAdClicked,
        onAdLoaded: onAdLoaded,
      ),
    );
  }

  @override
  Widget buildNativeWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  }) {
    if (_promoHook == null || !_promoHook!.isAvailable) {
      onAdFailedToLoad?.call('WAPAds hook unavailable');
      return const SizedBox.shrink();
    }

    onAdLoaded?.call();
    return KeyedSubtree(
      key: const ValueKey('wapads_house_native_widget'),
      child: _promoHook!.buildNative(
        context,
        onAdClicked: onAdClicked,
        onAdLoaded: onAdLoaded,
      ),
    );
  }

  @override
  Future<bool> showInterstitial({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  }) async {
    if (_promoHook == null || !_promoHook!.isAvailable) {
      onFailedToShow?.call('WAPAds hook unavailable');
      return false;
    }

    try {
      final shown = await _promoHook!.showInterstitial(
        context,
        onDismissed: onDismissed,
      );
      if (!shown) {
        onFailedToShow?.call('WAPAds promo dialog dismissed or unavailable');
      }
      return shown;
    } catch (e) {
      onFailedToShow?.call('Error presenting WAPAds interstitial: $e');
      return false;
    }
  }

  @override
  Future<bool> showRewarded({
    required BuildContext context,
    String? adUnitId,
    required Function(num amount, String type) onUserEarnedReward,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  }) async {
    // WAPAds house ads do not serve rewarded video; signal no-fill/skip
    onFailedToShow?.call('Rewarded format is not supported by WAPAds house network');
    return false;
  }

  @override
  void dispose() {
    _initialized = false;
  }
}
