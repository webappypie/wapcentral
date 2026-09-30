import 'dart:async';
import 'package:flutter/material.dart';
import '../models/ad_config.dart';
import '../models/ad_format.dart';
import '../models/ad_load_result.dart';
import '../models/ad_network.dart';
import 'ad_provider_adapter.dart';

/// Pluggable bridge interface for AppLovin MAX mediation native operations.
abstract class AppLovinBridge {
  Future<bool> initialize(String sdkKey, {bool testMode = false});
  Future<AdLoadResult> loadAd(AdFormat format, String adUnitId);
  Widget createBannerWidget(String adUnitId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Widget createNativeWidget(String adUnitId, {VoidCallback? onLoaded, Function(String)? onFailed, VoidCallback? onClicked});
  Future<bool> showInterstitial(String adUnitId, {VoidCallback? onDismissed, Function(String)? onFailed});
  Future<bool> showRewarded(String adUnitId, {required Function(num amount, String type) onEarned, VoidCallback? onDismissed, Function(String)? onFailed});
}

/// Default bridge implementation supporting headless and simulated environments.
class DefaultAppLovinBridge implements AppLovinBridge {
  final bool shouldSimulateFailure;
  final bool shouldSimulateNoFill;
  final int simulatedDelayMs;

  DefaultAppLovinBridge({
    this.shouldSimulateFailure = false,
    this.shouldSimulateNoFill = false,
    this.simulatedDelayMs = 0,
  });

  @override
  Future<bool> initialize(String sdkKey, {bool testMode = false}) async {
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
        network: AdNetwork.applovin,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'AppLovin MAX auction failed: invalid credentials',
        errorCode: 'AUTH_FAILED',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    if (shouldSimulateNoFill) {
      return AdLoadResult.noFill(
        network: AdNetwork.applovin,
        format: format,
        adUnitId: adUnitId,
        errorMessage: 'MAX NO_FILL: 204',
        latencyMs: stopwatch.elapsedMilliseconds,
      );
    }

    return AdLoadResult.success(
      network: AdNetwork.applovin,
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
      onFailed?.call('Simulated AppLovin banner failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Container(
      key: const ValueKey('applovin_banner_widget'),
      height: 50,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F9D58).withValues(alpha: 0.12),
        border: Border.all(color: const Color(0xFF0F9D58).withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF0F9D58),
                borderRadius: BorderRadius.circular(2),
              ),
              child: const Text(
                'MAX',
                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'AppLovin Mediated: $adUnitId',
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
      onFailed?.call('Simulated AppLovin native failure');
      return const SizedBox.shrink();
    }

    onLoaded?.call();
    return Card(
      key: const ValueKey('applovin_native_widget'),
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
                    color: const Color(0xFF0F9D58),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: const Text(
                    'MAX Native',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                const Text('Real-Time Auction', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'AppLovin Mediated Promotion',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text('MAX Unit: $adUnitId', style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
      onFailed?.call('AppLovin interstitial display failure');
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
      onFailed?.call('AppLovin rewarded video display failure');
      return false;
    }
    onEarned(15, 'points');
    onDismissed?.call();
    return true;
  }
}

/// AppLovin MAX adapter implementing [AdProviderAdapter].
class AppLovinAdapter implements AdProviderAdapter {
  final AppLovinBridge _bridge;
  bool _initialized = false;
  AdConfig? _config;

  AppLovinAdapter({AppLovinBridge? bridge}) : _bridge = bridge ?? DefaultAppLovinBridge();

  @override
  AdNetwork get network => AdNetwork.applovin;

  @override
  bool get isInitialized => _initialized;

  @override
  Future<bool> initialize(AdConfig config) async {
    _config = config;
    final maxCfg = config.applovin;
    if (maxCfg == null || !maxCfg.enabled) {
      _initialized = false;
      return false;
    }

    try {
      _initialized = await _bridge.initialize(
        maxCfg.sdkKey,
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
        network: AdNetwork.applovin,
        format: format,
        reason: 'AppLovin adapter is not initialized',
      );
    }

    final targetUnitId = adUnitId ?? _config!.findAdUnit(AdNetwork.applovin, format)?.adUnitId;
    if (targetUnitId == null || targetUnitId.isEmpty) {
      return AdLoadResult.skipped(
        network: AdNetwork.applovin,
        format: format,
        reason: 'No AppLovin ad unit ID configured for format ${format.name}',
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.applovin, AdFormat.banner)?.adUnitId ?? 'max_default_banner';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.applovin, AdFormat.native)?.adUnitId ?? 'max_default_native';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.applovin, AdFormat.interstitial)?.adUnitId ?? 'max_default_interstitial';
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
    final targetUnitId = adUnitId ?? _config?.findAdUnit(AdNetwork.applovin, AdFormat.rewarded)?.adUnitId ?? 'max_default_rewarded';
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
