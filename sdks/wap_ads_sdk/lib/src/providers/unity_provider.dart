import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../models/ad_error.dart';
import 'wap_ad_provider.dart';

/// Provider adapter for Unity Ads (mediated demand source via AppLovin MAX).
class UnityAdsProvider implements WapAdProvider {
  bool _initialized = false;
  bool _testMode = false;

  /// Test bridge override function for unit testing rewarded responses.
  RewardedAdResult Function(String adUnitId, String requestId)? rewardedTestBridge;

  /// Test bridge override function for unit testing interstitial responses.
  bool Function(String adUnitId, String requestId)? interstitialTestBridge;

  /// Test flag to simulate load failures.
  bool simulateFailure = false;

  @override
  String get id => 'unity';

  @override
  String get name => 'Unity Ads';

  @override
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false}) async {
    _testMode = testMode;
    _initialized = true;
  }

  @override
  bool isFormatSupported(AdFormat format) {
    // Unity Ads supports banner, interstitial, and rewarded only
    return format == AdFormat.banner ||
        format == AdFormat.interstitial ||
        format == AdFormat.rewarded;
  }

  @override
  Future<bool> showInterstitial(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  }) async {
    if (!_initialized) return false;
    if (simulateFailure) return false;

    if (interstitialTestBridge != null) {
      return interstitialTestBridge!(adUnitId, requestId ?? 'req_test');
    }

    return true;
  }

  @override
  Future<RewardedAdResult> showRewarded(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  }) async {
    final reqId = requestId ?? 'req_${DateTime.now().millisecondsSinceEpoch}';
    if (!_initialized) {
      return RewardedAdResult.failed(
        provider: id,
        requestId: reqId,
        error: const AdError(code: AdError.notInitialized, message: 'Unity Ads provider not initialized'),
      );
    }
    if (simulateFailure) {
      return RewardedAdResult.failed(
        provider: id,
        requestId: reqId,
        error: const AdError(code: AdError.noFill, message: 'Unity Ads no fill'),
      );
    }

    if (rewardedTestBridge != null) {
      return rewardedTestBridge!(adUnitId, reqId);
    }

    return RewardedAdResult.granted(
      provider: id,
      requestId: reqId,
      rewardType: 'gems',
      rewardAmount: 20,
    );
  }

  @override
  Widget buildBanner(
    BuildContext context,
    String adUnitId, {
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    if (simulateFailure) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        onFailed?.call('Unity Ads banner failed to load: simulateFailure=true');
      });
      return const SizedBox.shrink();
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      onLoaded?.call();
    });

    return Container(
      width: double.infinity,
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border.all(color: const Color(0xFFCBD5E1)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onClicked,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const Text('Unity', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(width: 8),
              Text(
                _testMode ? 'Test Unity Banner ($adUnitId)' : 'Unity Mediated Banner',
                style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget buildNative(
    BuildContext context,
    String adUnitId, {
    Widget Function(BuildContext context, Map<String, dynamic> data)? customBuilder,
    VoidCallback? onLoaded,
    Function(String error)? onFailed,
    VoidCallback? onClicked,
  }) {
    // Unity Ads does not support Native ads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      onFailed?.call('Unity Ads does not support native ad format');
    });
    return const SizedBox.shrink();
  }
}
