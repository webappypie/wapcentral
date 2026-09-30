import 'dart:async';
import 'package:flutter/material.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// Pluggable bridge interface for Google AdMob native operations.
abstract class AdMobBridge {
  Future<bool> initialize(String appId, {bool testMode = false});
  Future<AdLoadResult> loadAd(AdFormat format, String adUnitId);
  Widget createBannerWidget(String adUnitId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Widget createNativeWidget(String adUnitId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Future<bool> showInterstitial(String adUnitId, {VoidCallback? onDismissed, Function(String)? onFailed});
  Future<bool> showRewarded(String adUnitId, {required Function(num amount, String type) onEarned, VoidCallback? onDismissed, Function(String)? onFailed});
}

/// Default bridge implementation supporting headless and simulated environments.
class DefaultAdMobBridge implements AdMobBridge {
  final bool shouldSimulateFailure;
  final bool shouldSimulateNoFill;
  final int simulatedDelayMs;

  DefaultAdMobBridge({
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
  Future<AdLoadResult> loadAd(AdFormat format, String adUnitId) async {
    final stopwatch = Stopwatch()..start();
    if (simulatedDelayMs > 0) {
      await Future<void>.delayed(Duration(milliseconds: simulatedDelayMs));
    }
    stopwatch.stop();

    if (shouldSimulateFailure) {
      return AdLoadResult.failure(
        network: AdNetwork.admob,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'AdMob network error: failed to resolve host',
        errorCode: 'NETWORK_ERROR',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    if (shouldSimulateNoFill) {
      return AdLoadResult.noFill(
        network: AdNetwork.admob,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'AdMob NO_FILL: 3',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.admob,
      format: format,
      adUnitId: adUnitId,
      latencyMs: stopwatch.elapsedMilliseconds,
    );
  }

  @override
  Widget createBannerWidget(
    String adUnitId, {
    VoidCallback? onLoaded,
    Function(String)? onFailed,
    VoidCallback? onClicked,
  }) {
    if (shouldSimulateFailure) {
      onFailed?.call('Simulated AdMob banner failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Container(
      key: const ValueKey('admob_banner_widget'),
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF4285F4).withValues(alpha: 0.12),
        border: Border.all(color: const Color(0xFF4285F4).withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF4285F4),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'AdMob',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Sponsored: $adUnitId',
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
    String adUnitId, {
    VoidCallback? onLoaded,
    Function(String)? onFailed,
    VoidCallback? onClicked,
  }) {
    if (shouldSimulateFailure) {
      onFailed?.call('Simulated AdMob native failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Card(
      key: const ValueKey('admob_native_widget'),
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
                    color: const Color(0xFF4285F4),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'AdMob Native',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                const Text('Sponsored', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Google AdMob Sponsored Content',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text('Ad Unit: $adUnitId', style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  @override
  Future<bool> showInterstitial(
    String adUnitId, {
    VoidCallback? onDismissed,
    Function(String)? onFailed,
  }) async {
    if (shouldSimulateFailure) {
      onFailed?.call('AdMob interstitial failed to present');
      return false;
    }
    onDismissed?.call();
    return true;
  }

  @override
  Future<bool> showRewarded(
    String adUnitId, {
    required Function(num amount, String type) onEarned,
    VoidCallback? onDismissed,
    Function(String)? onFailed,
  }) async {
    if (shouldSimulateFailure) {
      onFailed?.call('AdMob rewarded ad failed to present');
      return false;
    }
    onEarned(10, 'coins');
    onDismissed?.call();
    return true;
  }
}

/// Google AdMob adapter implementing [AdProviderAdapter].
class AdMobAdapter implements AdProviderAdapter {
  final AdMobBridge _bridge;
  bool _initialized = false;
  AdConfig? _config;

  AdMobAdapter({AdMobBridge? bridge}) : _bridge = bridge ?? DefaultAdMobBridge();

  @override
  AdNetwork get network => AdNetwork.admob;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final admobCfg = config.admob;
    if (admobCfg == null || !admobCfg.enabled) {
      _initialized = false;
      return false;
    }

    try {
      _initialized = await _bridge.initialize(
        admobCfg.appId,
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
        network: AdNetwork.admob,
        format: format,
        reason: 'AdMob adapter is not initialized',
      );
    }

    final targetUnitId = adUnitId ?? _config!.findAdUnit(AdNetwork.admob, format)?.adUnitId;
    if (targetUnitId == null || targetUnitId.isEmpty) {
      return AdLoadResult.skipped(
        network: AdNetwork.admob,
        format: format,
        reason: 'No AdMob ad unit ID configured for format ${format.name}',
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.admob, AdFormat.banner)?.adUnitId ?? 'admob_default_banner';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.admob, AdFormat.native)?.adUnitId ?? 'admob_default_native';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.admob, AdFormat.interstitial)?.adUnitId ?? 'admob_default_interstitial';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.admob, AdFormat.rewarded)?.adUnitId ?? 'admob_default_rewarded';
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
