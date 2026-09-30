/// WebAppyPie Ads SDK for Flutter (wap_ads_sdk)
///
/// Unified advertising mediation and monetization wrapper for Flutter applications.
/// Supports Google AdMob, Meta Audience Network, AppLovin MAX, and first-party WAPAds.
///
/// Architecture Guarantees:
/// 1. **Decoupled from Promo SDK:** WAPAds house ads integrate via the [WapPromoHook]
///    interface with zero internal runtime dependencies on `wap_promo_sdk`.
/// 2. **Never Blocks Launch:** All ad adapter initialization runs concurrently and safely.
/// 3. **Graceful Degradation:** Automatic waterfall cascade from primary networks to
///    secondary networks, concluding with house promotions or invisible widgets on error.
/// 4. **Platform Agnostic Config:** Consumes standard WAPCentral Firestore `adConfig` schemas.
library wap_ads_sdk;

import 'package:flutter/widgets.dart';
import 'src/adapters/ad_provider_adapter.dart';
import 'src/hooks/wap_promo_hook.dart';
import 'src/mediation/mediation_manager.dart';
import 'src/models/ad_config.dart';

export 'src/models/ad_network.dart';
export 'src/models/ad_format.dart';
export 'src/models/ad_unit_config.dart';
export 'src/models/ad_placement.dart';
export 'src/models/mediation_priority.dart';
export 'src/models/ad_config.dart';
export 'src/models/ad_load_result.dart';
export 'src/hooks/wap_promo_hook.dart';
export 'src/adapters/ad_provider_adapter.dart';
export 'src/adapters/admob_adapter.dart';
export 'src/adapters/meta_adapter.dart';
export 'src/adapters/applovin_adapter.dart';
export 'src/adapters/wapads_adapter.dart';
export 'src/mediation/mediation_manager.dart';
export 'src/widgets/wap_ad_banner.dart';
export 'src/widgets/wap_ad_native.dart';

/// Main SDK Facade for WebAppyPie Ads Management & Mediation.
class WapAdsSdk {
  static MediationManager? _mediationManager;

  /// Initializes the Ads SDK with the provided [AdConfig].
  ///
  /// Optionally accepts [customAdapters] (for custom ad networks or unit test bridges)
  /// and [promoHook] (for delegating WAPAds house ads to `wap_promo_sdk`).
  static Future<void> init(
    AdConfig config, {
    List<AdProviderAdapter>? customAdapters,
    WapPromoHook? promoHook,
  }) async {
    final manager = MediationManager(
      customAdapters: customAdapters,
      promoHook: promoHook,
    );
    await manager.initialize(config);
    _mediationManager = manager;
  }

  /// Whether the SDK has been initialized.
  static bool get isReady => _mediationManager != null && _mediationManager!.isInitialized;

  /// Active mediation manager instance.
  static MediationManager get mediationManager {
    if (_mediationManager == null) {
      throw StateError(
        'WapAdsSdk has not been initialized. Call WapAdsSdk.init(adConfig) first.',
      );
    }
    return _mediationManager!;
  }

  /// Registers or updates the decoupled promotion hook delegate for WAPAds house ads.
  static void registerPromoHook(WapPromoHook hook) {
    _mediationManager?.registerPromoHook(hook);
  }

  /// Displays a full-screen interstitial ad with automatic waterfall failover.
  static Future<bool> showInterstitial(
    BuildContext context, {
    String? placementId,
    VoidCallback? onDismissed,
  }) async {
    if (!isReady) return false;
    return await _mediationManager!.showInterstitial(
      context,
      placementId: placementId,
      onDismissed: onDismissed,
    );
  }

  /// Displays a full-screen rewarded video ad with automatic waterfall failover.
  static Future<bool> showRewarded(
    BuildContext context, {
    String? placementId,
    required Function(num amount, String type) onUserEarnedReward,
    VoidCallback? onDismissed,
  }) async {
    if (!isReady) return false;
    return await _mediationManager!.showRewarded(
      context,
      placementId: placementId,
      onUserEarnedReward: onUserEarnedReward,
      onDismissed: onDismissed,
    );
  }

  /// Resets SDK state (primarily for unit test teardown).
  @visibleForTesting
  static void reset() {
    _mediationManager?.dispose();
    _mediationManager = null;
  }
}
