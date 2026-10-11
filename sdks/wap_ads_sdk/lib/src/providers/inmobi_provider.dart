import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../models/ad_error.dart';
import 'wap_ad_provider.dart';

/// Provider adapter for InMobi (mediated demand source via AppLovin MAX).
class InMobiProvider implements WapAdProvider {
  bool _initialized = false;
  bool _testMode = false;

  /// Test bridge override function for unit testing rewarded responses.
  RewardedAdResult Function(String adUnitId, String requestId)? rewardedTestBridge;

  /// Test bridge override function for unit testing interstitial responses.
  bool Function(String adUnitId, String requestId)? interstitialTestBridge;

  /// Test flag to simulate load failures.
  bool simulateFailure = false;

  @override
  String get id => 'inmobi';

  @override
  String get name => 'InMobi';

  @override
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false}) async {
    _testMode = testMode;
    _initialized = true;
  }

  @override
  bool isFormatSupported(AdFormat format) {
    // InMobi supports banner, native, interstitial, and rewarded
    return format == AdFormat.banner ||
        format == AdFormat.native ||
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
        error: const AdError(code: AdError.notInitialized, message: 'InMobi provider not initialized'),
      );
    }
    if (simulateFailure) {
      return RewardedAdResult.failed(
        provider: id,
        requestId: reqId,
        error: const AdError(code: AdError.noFill, message: 'InMobi no fill'),
      );
    }

    if (rewardedTestBridge != null) {
      return rewardedTestBridge!(adUnitId, reqId);
    }

    return RewardedAdResult.granted(
      provider: id,
      requestId: reqId,
      rewardType: 'coins',
      rewardAmount: 10,
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
        onFailed?.call('InMobi banner failed to load: simulateFailure=true');
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
        color: const Color(0xFFF0FDF4),
        border: Border.all(color: const Color(0xFFBBF7D0)),
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
                  color: const Color(0xFF16A34A),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const Text('InMobi', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(width: 8),
              Text(
                _testMode ? 'Test InMobi Banner ($adUnitId)' : 'InMobi Mediated Banner',
                style: const TextStyle(fontSize: 12, color: Color(0xFF14532D)),
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
        onFailed?.call('InMobi native failed to load');
      });
      return const SizedBox.shrink();
    }

    final nativeData = {
      'headline': 'InMobi Sponsored Recommendation',
      'body': 'Discover top recommended utility apps.',
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
          backgroundColor: Color(0xFF16A34A),
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
