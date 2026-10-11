import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/core/wap_ads_core.dart';
import 'package:wap_ads_sdk/src/providers/admob_provider.dart';

void main() {
  setUp(() {
    WapAdsCore.instance.reset();
  });

  tearDown(() {
    WapAdsCore.instance.reset();
  });

  group('WapAds Rewarded Ads & Reward Verification', () {
    final rewardedConfig = EffectiveAdConfig.fromJson({
      'appId': 'filezen',
      'enabled': true,
      'testMode': true,
      'version': 'rew_v1',
      'formats': {
        'rewarded': {
          'enabled': true,
          'format': 'rewarded',
          'frequency': {'cooldownSeconds': 0, 'sessionCap': 10, 'dailyCap': 50},
          'mediationChain': [
            {'networkId': 'admob', 'priority': 1, 'adUnitId': 'admob_rew_unit', 'timeoutMs': 5000},
          ],
        },
      },
    });

    testWidgets('1. Grants reward only upon confirmed completion callback', (tester) async {
      final admob = AdMobProvider();
      admob.rewardedTestBridge = (adUnitId, requestId) {
        return RewardedAdResult.granted(
          provider: 'admob',
          requestId: requestId,
          rewardType: 'gems',
          rewardAmount: 100,
        );
      };

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: rewardedConfig,
        ),
        customProviders: [admob],
      );

      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('Home'))));
      final context = tester.element(find.byType(Scaffold));

      final result = await WapAds.showRewarded(context);

      expect(result.success, isTrue);
      expect(result.rewardGranted, isTrue);
      expect(result.rewardType, 'gems');
      expect(result.rewardAmount, 100);
      expect(result.provider, 'admob');
      expect(result.requestId.startsWith('req_'), isTrue);
      expect(result.error, isNull);
    });

    testWidgets('2. Denies reward if user dismisses/skips early without completing requirement', (tester) async {
      final admob = AdMobProvider();
      admob.rewardedTestBridge = (adUnitId, requestId) {
        // User skipped without watching
        return RewardedAdResult.skipped(
          provider: 'admob',
          requestId: requestId,
        );
      };

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: rewardedConfig,
        ),
        customProviders: [admob],
      );

      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('Home'))));
      final context = tester.element(find.byType(Scaffold));

      final result = await WapAds.showRewarded(context);

      expect(result.success, isTrue);
      expect(result.rewardGranted, isFalse); // Reward NOT granted!
      expect(result.rewardAmount, 0);
      expect(result.provider, 'admob');
    });

    testWidgets('3. Handles provider load error gracefully', (tester) async {
      final admob = AdMobProvider();
      admob.simulateFailure = true;

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: rewardedConfig,
        ),
        customProviders: [admob],
      );

      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Text('Home'))));
      final context = tester.element(find.byType(Scaffold));

      final result = await WapAds.showRewarded(context);

      expect(result.success, isFalse);
      expect(result.rewardGranted, isFalse);
      expect(result.error, isNotNull);
    });
  });
}
