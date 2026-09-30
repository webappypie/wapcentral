import 'dart:async';
import 'package:flutter/widgets.dart';
import '../adapters/ad_provider_adapter.dart';
import '../adapters/admob_adapter.dart';
import '../adapters/applovin_adapter.dart';
import '../adapters/meta_adapter.dart';
import '../adapters/wapads_adapter.dart';
import '../hooks/wap_promo_hook.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';

/// Attempt log entry during waterfall mediation resolution.
class MediationAttempt {
  final AdNetwork network;
  final AdLoadResult result;
  final DateTime timestamp;

  MediationAttempt({
    required this.network,
    required this.result,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  @override
  String toString() =>
      'MediationAttempt(${network.name}: ${result.status.name} [${result.latencyMs}ms])';
}

/// The outcome of waterfall mediation resolution.
class MediationDecision {
  final bool hasWinner;
  final AdNetwork? winnerNetwork;
  final AdProviderAdapter? winnerAdapter;
  final AdLoadResult? loadResult;
  final List<MediationAttempt> attempts;

  const MediationDecision({
    required this.hasWinner,
    this.winnerNetwork,
    this.winnerAdapter,
    this.loadResult,
    this.attempts = const [],
  });

  factory MediationDecision.winner({
    required AdNetwork network,
    required AdProviderAdapter adapter,
    required AdLoadResult loadResult,
    required List<MediationAttempt> attempts,
  }) {
    return MediationDecision(
      hasWinner: true,
      winnerNetwork: network,
      winnerAdapter: adapter,
      loadResult: loadResult,
      attempts: attempts,
    );
  }

  factory MediationDecision.empty({
    required List<MediationAttempt> attempts,
  }) {
    return MediationDecision(
      hasWinner: false,
      winnerNetwork: null,
      winnerAdapter: null,
      loadResult: null,
      attempts: attempts,
    );
  }
}

/// Central waterfall mediation engine orchestrating ad requests across Google AdMob,
/// Meta Audience Network, AppLovin MAX, and WAPAds house ads.
class MediationManager {
  final Map<AdNetwork, AdProviderAdapter> _adapters = {};
  AdConfig? _config;
  WapPromoHook? _promoHook;
  bool _isInitialized = false;

  MediationManager({
    List<AdProviderAdapter>? customAdapters,
    WapPromoHook? promoHook,
  }) : _promoHook = promoHook {
    if (customAdapters != null) {
      for (final adapter in customAdapters) {
        _adapters[adapter.network] = adapter;
      }
    }
  }

  /// Whether the mediation manager is initialized.
  bool get isInitialized => _isInitialized;

  /// Active ad configuration.
  AdConfig? get config => _config;

  /// The active promo hook for WAPAds house ads.
  WapPromoHook? get promoHook => _promoHook;

  /// Returns registered adapter for network.
  AdProviderAdapter? getAdapter(AdNetwork network) => _adapters[network];

  /// Registers or updates the decoupled promotion hook.
  void registerPromoHook(WapPromoHook hook) {
    _promoHook = hook;
    final wapadsAdapter = _adapters[AdNetwork.wapads];
    if (wapadsAdapter is WapAdsAdapter) {
      wapadsAdapter.setPromoHook(hook);
    }
  }

  /// Registers or replaces an adapter.
  void registerAdapter(AdProviderAdapter adapter) {
    _adapters[adapter.network] = adapter;
  }

  /// Initializes all adapters with the given [AdConfig].
  Future<void> initialize(AdConfig config) async {
    _config = config;

    // Ensure all 4 core adapters are present if not already customized
    _adapters.putIfAbsent(AdNetwork.admob, () => AdMobAdapter());
    _adapters.putIfAbsent(AdNetwork.meta, () => MetaAdapter());
    _adapters.putIfAbsent(AdNetwork.applovin, () => AppLovinAdapter());
    _adapters.putIfAbsent(
      AdNetwork.wapads,
      () => WapAdsAdapter(promoHook: _promoHook),
    );

    if (_promoHook != null && _adapters[AdNetwork.wapads] is WapAdsAdapter) {
      (_adapters[AdNetwork.wapads] as WapAdsAdapter).setPromoHook(_promoHook!);
    }

    final initFutures = _adapters.values.map((adapter) async {
      try {
        await adapter.initialize(config);
      } catch (_) {
        // Safe isolation: adapter initialization failure never crashes the host app
      }
    });

    await Future.wait(initFutures);
    _isInitialized = true;
  }

  /// Resolves an ad request according to the configured waterfall priority order.
  ///
  /// Evaluates each network in [MediationPriority.waterfall]:
  /// 1. Tries primary network with configured timeout.
  /// 2. If load fails, times out, or has no-fill, cascades to next network.
  /// 3. Finally attempts WAPAds house-ad fallback.
  /// 4. If all networks fail, gracefully returns [MediationDecision.empty] without throwing.
  Future<MediationDecision> resolveAd(
    AdFormat format, {
    String? placementId,
    String platform = 'android',
  }) async {
    final cfg = _config;
    if (cfg == null) {
      return const MediationDecision(hasWinner: false);
    }

    final waterfall = cfg.mediationPriority.waterfall;
    final timeout = Duration(milliseconds: cfg.mediationPriority.fallbackTimeoutMs);
    final attempts = <MediationAttempt>[];

    for (final network in waterfall) {
      final adapter = _adapters[network];
      if (adapter == null || !adapter.isInitialized) {
        attempts.add(
          MediationAttempt(
            network: network,
            result: AdLoadResult.skipped(
              network: network,
              format: format,
              reason: 'Adapter not registered or uninitialized',
            ),
          ),
        );
        continue;
      }

      final adUnit = cfg.findAdUnit(network, format, platform: platform);
      final unitId = placementId ?? adUnit?.adUnitId;

      try {
        final loadResult = await adapter
            .loadAd(format, adUnitId: unitId)
            .timeout(timeout, onTimeout: () {
          return AdLoadResult.timeout(
            network: network,
            format: format,
            adUnitId: unitId,
          );
        });

        attempts.add(MediationAttempt(network: network, result: loadResult));

        if (loadResult.isSuccess) {
          return MediationDecision.winner(
            network: network,
            adapter: adapter,
            loadResult: loadResult,
            attempts: attempts,
          );
        }
      } catch (err) {
        attempts.add(
          MediationAttempt(
            network: network,
            result: AdLoadResult.failure(
              network: network,
              format: format,
              adUnitId: unitId,
              errorMessage: 'Unexpected exception during ad load: $err',
            ),
          ),
        );
      }

      // If fallback is disabled, halt at first network
      if (!cfg.mediationPriority.enableFallback) {
        break;
      }
    }

    return MediationDecision.empty(attempts: attempts);
  }

  /// Presents a full-screen interstitial ad with automatic waterfall failover.
  Future<bool> showInterstitial(
    BuildContext context, {
    String? placementId,
    VoidCallback? onDismissed,
  }) async {
    final decision = await resolveAd(AdFormat.interstitial, placementId: placementId);
    if (!decision.hasWinner || decision.winnerAdapter == null) {
      return false;
    }

    try {
      final unitId = decision.loadResult?.adUnitId;
      final shown = await decision.winnerAdapter!.showInterstitial(
        context: context,
        adUnitId: unitId,
        onDismissed: onDismissed,
      );

      if (shown) return true;

      // If winner presentation failed, try house ads fallback
      final wapads = _adapters[AdNetwork.wapads];
      if (wapads != null && wapads.isInitialized && decision.winnerNetwork != AdNetwork.wapads) {
        return await wapads.showInterstitial(
          context: context,
          onDismissed: onDismissed,
        );
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Presents a rewarded video ad with automatic waterfall failover.
  Future<bool> showRewarded(
    BuildContext context, {
    String? placementId,
    required Function(num amount, String type) onUserEarnedReward,
    VoidCallback? onDismissed,
  }) async {
    final decision = await resolveAd(AdFormat.rewarded, placementId: placementId);
    if (!decision.hasWinner || decision.winnerAdapter == null) {
      return false;
    }

    try {
      final unitId = decision.loadResult?.adUnitId;
      return await decision.winnerAdapter!.showRewarded(
        context: context,
        adUnitId: unitId,
        onUserEarnedReward: onUserEarnedReward,
        onDismissed: onDismissed,
      );
    } catch (_) {
      return false;
    }
  }

  /// Cleans up all adapters.
  void dispose() {
    for (final adapter in _adapters.values) {
      adapter.dispose();
    }
    _adapters.clear();
    _isInitialized = false;
  }
}
