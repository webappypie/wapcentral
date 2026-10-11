import 'dart:async';
import 'package:flutter/material.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// Pluggable bridge interface for InMobi native operations.
abstract class InMobiBridge {
  Future<bool> initialize(String accountId, {bool testMode = false});
  Future<AdLoadResult> loadAd(AdFormat format, String placementId);
  Widget createBannerWidget(String placementId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Widget createNativeWidget(String placementId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Future<bool> showInterstitial(String placementId, {VoidCallback? onDismissed, Function(String)? onFailed});
  Future<bool> showRewarded(String placementId, {required Function(num amount, String type) onEarned, VoidCallback? onDismissed, Function(String)? onFailed});
}

/// Default bridge implementation supporting headless and simulated environments.
class DefaultInMobiBridge implements InMobiBridge {
  final bool shouldSimulateFailure;
  final bool shouldSimulateNoFill;
  final int simulatedDelayMs;

  DefaultInMobiBridge({
    this.shouldSimulateFailure = false,
    this.shouldSimulateNoFill = false,
    this.simulatedDelayMs = 0,
  });

  @override
  Future<bool> initialize(String accountId, {bool testMode = false}) async {
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
        network: AdNetwork.inmobi,
        format: format,
        adUnitId: placementId,
        errorMessage: 'InMobi network error: invalid placement',
        errorCode: 'INVALID_PLACEMENT',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    if (shouldSimulateNoFill) {
      return AdLoadResult.noFill(
        network: AdNetwork.inmobi,
        format: format,
        adUnitId: placementId,
        errorMessage: 'InMobi NO_FILL: 204',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.inmobi,
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
      onFailed?.call('Simulated InMobi banner failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Container(
      key: const ValueKey('inmobi_banner_widget'),
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A).withValues(alpha: 0.1),
        border: Border.all(color: const Color(0xFF16A34A).withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'InMobi',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'InMobi Mediated: $placementId',
              style: const TextStyle(fontSize: 11, color: Color(0xFF14532D)),
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
      onFailed?.call('Simulated InMobi native failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Card(
      key: const ValueKey('inmobi_native_widget'),
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
                    color: const Color(0xFF16A34A),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'InMobi Native',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                const Text('Sponsored', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'InMobi Recommended Content',
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
      onFailed?.call('InMobi interstitial display failure');
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
      onFailed?.call('InMobi rewarded video display failure');
      return false;
    }
    onEarned(10, 'coins');
    onDismissed?.call();
    return true;
  }
}

/// InMobi adapter implementing [AdProviderAdapter].
class InMobiAdapter implements AdProviderAdapter {
  final InMobiBridge _bridge;
  bool _initialized = false;
  AdConfig? _config;

  InMobiAdapter({InMobiBridge? bridge}) : _bridge = bridge ?? DefaultInMobiBridge();

  @override
  AdNetwork get network => AdNetwork.inmobi;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final inmobiCfg = config.inmobi;
    if (inmobiCfg == null || !inmobiCfg.enabled) {
      _initialized = false;
      return false;
    }

    try {
      _initialized = await _bridge.initialize(
        inmobiCfg.accountId,
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
        network: AdNetwork.inmobi,
        format: format,
        reason: 'InMobi adapter is not initialized',
      );
    }

    if (format == AdFormat.appOpen || format == AdFormat.rewardedInterstitial) {
      return AdLoadResult.skipped(
        network: AdNetwork.inmobi,
        format: format,
        reason: 'InMobi does not support format ${format.name}',
      );
    }

    final targetUnitId = adUnitId ?? _config!.findAdUnit(AdNetwork.inmobi, format)?.adUnitId;
    if (targetUnitId == null || targetUnitId.isEmpty) {
      return AdLoadResult.skipped(
        network: AdNetwork.inmobi,
        format: format,
        reason: 'No InMobi placement ID configured for format ${format.name}',
      );
    }

    return await _bridge.loadAd(format, targetUnitId);
  }

  @override
  Widget buildBannerWidget({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onAdLoaded,
    Function(String error)? onAdFailedToLoad,
    VoidCallback? onAdClicked,
  }) {
    final targetUnitId = adUnitId ?? 'inmobi_default_banner';
    return _bridge.createBannerWidget(
      targetUnitId,
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
    final targetUnitId = adUnitId ?? 'inmobi_default_native';
    return _bridge.createNativeWidget(
      targetUnitId,
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
    final targetUnitId = adUnitId ?? 'inmobi_default_interstitial';
    return await _bridge.showInterstitial(
      targetUnitId,
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
    final targetUnitId = adUnitId ?? 'inmobi_default_rewarded';
    return await _bridge.showRewarded(
      targetUnitId,
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
