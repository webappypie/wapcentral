import 'dart:async';
import 'package:flutter/material.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// Pluggable bridge interface for Unity Ads native operations.
abstract class UnityBridge {
  Future<bool> initialize(String gameId, {bool testMode = false});
  Future<AdLoadResult> loadAd(AdFormat format, String placementId);
  Widget createBannerWidget(String placementId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Future<bool> showInterstitial(String placementId, {VoidCallback? onDismissed, Function(String)? onFailed});
  Future<bool> showRewarded(String placementId, {required Function(num amount, String type) onEarned, VoidCallback? onDismissed, Function(String)? onFailed});
}

/// Default bridge implementation supporting headless and simulated environments.
class DefaultUnityBridge implements UnityBridge {
  final bool shouldSimulateFailure;
  final bool shouldSimulateNoFill;
  final int simulatedDelayMs;

  DefaultUnityBridge({
    this.shouldSimulateFailure = false,
    this.shouldSimulateNoFill = false,
    this.simulatedDelayMs = 0,
  });

  @override
  Future<bool> initialize(String gameId, {bool testMode = false}) async {
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
        network: AdNetwork.unity,
        format: format,
        adUnitId: placementId,
        errorMessage: 'Unity Ads load failed: placement not ready',
        errorCode: 'NOT_READY',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    if (shouldSimulateNoFill) {
      return AdLoadResult.noFill(
        network: AdNetwork.unity,
        format: format,
        adUnitId: placementId,
        errorMessage: 'Unity Ads NO_FILL: 204',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.unity,
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
      onFailed?.call('Simulated Unity Ads banner failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Container(
      key: const ValueKey('unity_banner_widget'),
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withValues(alpha: 0.08),
        border: Border.all(color: const Color(0xFF0F172A).withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'Unity',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Unity Mediated: $placementId',
              style: const TextStyle(fontSize: 11, color: Color(0xFF334155)),
              overflow: TextOverflow.ellipsis,
            ),
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
      onFailed?.call('Unity Ads interstitial display failure');
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
      onFailed?.call('Unity Ads rewarded video display failure');
      return false;
    }
    onEarned(20, 'gems');
    onDismissed?.call();
    return true;
  }
}

/// Unity Ads adapter implementing [AdProviderAdapter].
class UnityAdapter implements AdProviderAdapter {
  final UnityBridge _bridge;
  bool _initialized = false;
  AdConfig? _config;

  UnityAdapter({UnityBridge? bridge}) : _bridge = bridge ?? DefaultUnityBridge();

  @override
  AdNetwork get network => AdNetwork.unity;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final unityCfg = config.unity;
    if (unityCfg == null || !unityCfg.enabled) {
      _initialized = false;
      return false;
    }

    try {
      _initialized = await _bridge.initialize(
        unityCfg.gameId,
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
        network: AdNetwork.unity,
        format: format,
        reason: 'Unity adapter is not initialized',
      );
    }

    if (format == AdFormat.native || format == AdFormat.appOpen || format == AdFormat.rewardedInterstitial) {
      return AdLoadResult.skipped(
        network: AdNetwork.unity,
        format: format,
        reason: 'Unity Ads does not support format ${format.name}',
      );
    }

    final targetUnitId = adUnitId ?? _config!.findAdUnit(AdNetwork.unity, format)?.adUnitId;
    if (targetUnitId == null || targetUnitId.isEmpty) {
      return AdLoadResult.skipped(
        network: AdNetwork.unity,
        format: format,
        reason: 'No Unity placement ID configured for format ${format.name}',
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
    final targetUnitId = adUnitId ?? 'unity_default_banner';
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
    onAdFailedToLoad?.call('Unity Ads does not support native ads');
    return const SizedBox.shrink();
  }

  @override
  Future<bool> showInterstitial({
    required BuildContext context,
    String? adUnitId,
    VoidCallback? onDismissed,
    Function(String error)? onFailedToShow,
  }) async {
    final targetUnitId = adUnitId ?? 'unity_default_interstitial';
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
    final targetUnitId = adUnitId ?? 'unity_default_rewarded';
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
