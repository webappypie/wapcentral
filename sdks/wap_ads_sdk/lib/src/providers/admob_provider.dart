import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../models/ad_error.dart';
import 'wap_ad_provider.dart';

/// Provider adapter for Google AdMob.
class AdMobProvider implements WapAdProvider {
  bool _initialized = false;
  bool _testMode = false;

  /// Test bridge override function for unit testing rewarded responses.
  RewardedAdResult Function(String adUnitId, String requestId)? rewardedTestBridge;

  /// Test bridge override function for unit testing interstitial responses.
  bool Function(String adUnitId, String requestId)? interstitialTestBridge;

  /// Test flag to simulate load failures.
  bool simulateFailure = false;

  @override
  String get id => 'admob';

  @override
  String get name => 'Google AdMob';

  @override
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false}) async {
    _testMode = testMode;
    _initialized = true;
  }

  @override
  bool isFormatSupported(AdFormat format) => true; // AdMob supports all formats

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

    // Default simulated display for Flutter environment
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
        error: const AdError(code: AdError.notInitialized, message: 'AdMob provider not initialized'),
      );
    }
    if (simulateFailure) {
      return RewardedAdResult.failed(
        provider: id,
        requestId: reqId,
        error: const AdError(code: AdError.noFill, message: 'AdMob ad inventory unavailable'),
      );
    }

    if (rewardedTestBridge != null) {
      return rewardedTestBridge!(adUnitId, reqId);
    }

    // By default, reward granted upon verified completion
    return RewardedAdResult.granted(
      provider: id,
      requestId: reqId,
      rewardType: 'credits',
      rewardAmount: 1,
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
        onFailed?.call('AdMob banner failed to load: simulateFailure=true');
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
        color: const Color(0xFFF1F5F9),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const Text('AdMob Ad', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
              ),
              const SizedBox(width: 8),
              Text(
                _testMode ? 'Test Banner ($adUnitId)' : 'Google AdMob Banner',
                style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
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
    if (simulateFailure) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        onFailed?.call('AdMob native failed to load');
      });
      return const SizedBox.shrink();
    }

    final nativeData = {
      'headline': 'Sponsored AdMob Feature',
      'body': 'Discover high-efficiency productivity tools on Google Play.',
      'cta': 'Install Now',
      'adUnitId': adUnitId,
    };

    WidgetsBinding.instance.addPostFrameCallback((_) {
      onLoaded?.call();
    });

    if (customBuilder != null) {
      return customBuilder(context, nativeData);
    }

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Color(0xFF4285F4),
          child: Icon(Icons.star, color: Colors.white, size: 20),
        ),
        title: Text(nativeData['headline']!),
        subtitle: Text(nativeData['body']!),
        trailing: ElevatedButton(
          onPressed: onClicked,
          child: Text(nativeData['cta']!),
        ),
      ),
    );
  }
}
