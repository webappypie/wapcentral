import 'dart:async';
import 'package:flutter/material.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// Pluggable bridge interface for Meta Audience Network native operations.
abstract class MetaBridge {
  Future<bool> initialize(String appId, {bool testMode = false});
  Future<AdLoadResult> loadAd(AdFormat format, String placementId);
  Widget createBannerWidget(String placementId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Widget createNativeWidget(String placementId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Future<bool> showInterstitial(String placementId, {VoidCallback? onDismissed, Function(String)? onFailed});
  Future<bool> showRewarded(String placementId, {required Function(num amount, String type) onEarned, VoidCallback? onDismissed, Function(String)? onFailed});
}

/// Default bridge implementation supporting headless and simulated environments.
class DefaultMetaBridge implements MetaBridge {
  final bool shouldSimulateFailure;
  final bool shouldSimulateNoFill;
  final int simulatedDelayMs;

  DefaultMetaBridge({
    this.shouldSimulateFailure = false,
    this.shouldSimulateNoFill = false,
    this.simulatedDelayMs = 0,
  });

  @override
  Future<bool> initialize(String appId, {bool testMode = false}) async {
    if (simulatedDelayMs > 0) {
      await Future<void>.delayed(Duration(milliseconds: simulatedDelayMs));
    }
    return true;
  }

  @override
  Future<AdLoadResult> loadAd(AdFormat format, String placementId) async {
    final stopwatch = Stopwatch()..start();
    if (simulatedDelayMs > 0) {
      await Future<void>.delayed(Duration(milliseconds: simulatedDelayMs));
    }
    stopwatch.stop();

    if (shouldSimulateFailure) {
      return AdLoadResult.failure(
        network: AdNetwork.meta,
        format: format,
        adUnitId: placementId,
        errorMessage: 'Meta Audience Network error: request throttled',
        errorCode: 'THROTTLED',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    if (shouldSimulateNoFill) {
      return AdLoadResult.noFill(
        network: AdNetwork.meta,
        format: format,
        adUnitId: placementId,
        errorMessage: 'Meta NO_FILL: 1001',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.meta,
      format: format,
      adUnitId: placementId,
      latencyMs: stopwatch.elapsedMilliseconds,
    );
  }

  @override
  Widget createBannerWidget(
    String placementId, {
    VoidCallback? onLoaded,
    Function(String)? onFailed,
    VoidCallback? onClicked,
  }) {
    if (shouldSimulateFailure) {
      onFailed?.call('Simulated Meta banner failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Container(
      key: const ValueKey('meta_banner_widget'),
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF1877F2).withValues(alpha: 0.12),
        border: Border.all(color: const Color(0xFF1877F2).withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF1877F2),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'Meta',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Audience Network: $placementId',
              style: const TextStyle(fontSize: 11, color: Color(0xFF333333)),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget createNativeWidget(
    String placementId, {
    VoidCallback? onLoaded,
    Function(String)? onFailed,
    VoidCallback? onClicked,
  }) {
    if (shouldSimulateFailure) {
      onFailed?.call('Simulated Meta native failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Card(
      key: const ValueKey('meta_native_widget'),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1877F2),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'Meta Native',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                const Text('Sponsored by Meta', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Targeted Social Recommendation',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text('Placement: $placementId', style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  @override
  Future<bool> showInterstitial(
    String placementId, {
    VoidCallback? onDismissed,
    Function(String)? onFailed,
  }) async {
    if (shouldSimulateFailure) {
      onFailed?.call('Meta interstitial display failure');
      return false;
    }
    onDismissed?.call();
    return true;
  }

  @override
  Future<bool> showRewarded(
    String placementId, {
    required Function(num amount, String type) onEarned,
    VoidCallback? onDismissed,
    Function(String)? onFailed,
  }) async {
    if (shouldSimulateFailure) {
      onFailed?.call('Meta rewarded video display failure');
      return false;
    }
    onEarned(5, 'gems');
    onDismissed?.call();
    return true;
  }
}

/// Meta Audience Network adapter implementing [AdProviderAdapter].
class MetaAdapter implements AdProviderAdapter {
  final MetaBridge _bridge;
  bool _initialized = false;
  AdConfig? _config;

  MetaAdapter({MetaBridge? bridge}) : _bridge = bridge ?? DefaultMetaBridge();

  @override
  AdNetwork get network => AdNetwork.meta;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final metaCfg = config.meta;
    if (metaCfg == null || !metaCfg.enabled) {
      _initialized = false;
      return false;
    }

    try {
      _initialized = await _bridge.initialize(
        metaCfg.appId,
        testMode: config.testMode,
      );
      return _initialized;
    } catch (_) {
      _initialized = false;
      return false;
    }
  }

  @override
  Future<AdLoadResult> loadAd(AdFormat format, {String? adUnitId}) async {
    if (!_initialized || _config == null) {
      return AdLoadResult.skipped(
        network: AdNetwork.meta,
        format: format,
        reason: 'Meta adapter is not initialized',
      );
    }

    final targetPlacementId = adUnitId ?? _config!.findAdUnit(AdNetwork.meta, format)?.adUnitId;
    if (targetPlacementId == null || targetPlacementId.isEmpty) {
      return AdLoadResult.skipped(
        network: AdNetwork.meta,
        format: format,
        reason: 'No Meta placement ID configured for format ${format.name}',
      );
    }

    return await _bridge.loadAd(format, targetPlacementId);
  }

  @override
  Widget buildBannerWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  }) {
    final targetPlacementId = adUnitId ?? _config?.findAdUnit(AdNetwork.meta, AdFormat.banner)?.adUnitId ?? 'meta_default_banner';
    return _bridge.createBannerWidget(
      targetPlacementId,
      onLoaded: onAdLoaded,
      onFailed: onAdFailedToLoad,
      onClicked: onAdClicked,
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
    final targetPlacementId = adUnitId ?? _config?.findAdUnit(AdNetwork.meta, AdFormat.native)?.adUnitId ?? 'meta_default_native';
    return _bridge.createNativeWidget(
      targetPlacementId,
      onLoaded: onAdLoaded,
      onFailed: onAdFailedToLoad,
      onClicked: onAdClicked,
    );
  }

  @override
  Future<bool> showInterstitial({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  }) async {
    final targetPlacementId = adUnitId ?? _config?.findAdUnit(AdNetwork.meta, AdFormat.interstitial)?.adUnitId ?? 'meta_default_interstitial';
    return await _bridge.showInterstitial(
      targetPlacementId,
      onDismissed: onDismissed,
      onFailed: onFailedToShow,
    );
  }

  @override
  Future<bool> showRewarded({
    required BuildContext context,
    String? adUnitId,
    required Function(num amount, String type) onUserEarnedReward,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  }) async {
    final targetPlacementId = adUnitId ?? _config?.findAdUnit(AdNetwork.meta, AdFormat.rewarded)?.adUnitId ?? 'meta_default_rewarded';
    return await _bridge.showRewarded(
      targetPlacementId,
      onEarned: onUserEarnedReward,
      onDismissed: onDismissed,
      onFailed: onFailedToShow,
    );
  }

  @override
  void dispose() {
    _initialized = false;
  }
}
