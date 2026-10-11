import 'package:flutter/material.dart';
import '../models/ad_format.dart';
import '../models/effective_ad_config.dart';
import '../models/rewarded_result.dart';
import '../models/ad_error.dart';
import 'wap_ad_provider.dart';

/// Provider adapter for Meta Audience Network.
class MetaProvider implements WapAdProvider {
  bool _initialized = false;
  bool _testMode = false;

  /// Test bridge override function for unit testing rewarded responses.
  RewardedAdResult Function(String adUnitId, String requestId)? rewardedTestBridge;

  /// Test flag to simulate load failures.
  bool simulateFailure = false;

  @override
  String get id => 'meta';

  @override
  String get name => 'Meta Audience Network';

  @override
  Future<void> initialize(EffectiveAdConfig config, {bool testMode = false}) async {
    _testMode = testMode;
    _initialized = true;
  }

  @override
  bool isFormatSupported(AdFormat format) =>
      format != AdFormat.appOpen; // Meta typically serves banner, native, interstitial, rewarded

  @override
  Future<bool> showInterstitial(
    BuildContext context,
    String adUnitId, {
    String? placementKey,
    String? requestId,
  }) async {
    if (!_initialized || simulateFailure) return false;
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
        error: const AdError(code: AdError.notInitialized, message: 'Meta provider not initialized'),
      );
    }
    if (simulateFailure) {
      return RewardedAdResult.failed(
        provider: id,
        requestId: reqId,
        error: const AdError(code: AdError.noFill, message: 'Meta Audience Network no fill'),
      );
    }

    if (rewardedTestBridge != null) {
      return rewardedTestBridge!(adUnitId, reqId);
    }

    return RewardedAdResult.granted(
      provider: id,
      requestId: reqId,
      rewardType: 'gems',
      rewardAmount: 5,
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
        onFailed?.call('Meta banner failed to load: simulateFailure=true');
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
        color: const Color(0xFFEFF6FF),
        border: Border.all(color: const Color(0xFFBFDBFE)),
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
                  color: const Color(0xFF1877F2),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const Text('Meta', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(width: 8),
              Text(
                _testMode ? 'Test Meta Banner ($adUnitId)' : 'Meta Audience Network Banner',
                style: const TextStyle(fontSize: 12, color: Color(0xFF1E3A8A)),
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
        onFailed?.call('Meta native failed to load');
      });
      return const SizedBox.shrink();
    }

    final nativeData = {
      'headline': 'Sponsored Meta Creative',
      'body': 'Connect with what matters most to your workflow.',
      'cta': 'Open',
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
      color: const Color(0xFFF8FAFC),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Color(0xFF1877F2),
          child: Icon(Icons.hub, color: Colors.white, size: 20),
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
