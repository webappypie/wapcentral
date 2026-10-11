import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/core/wap_ads_core.dart';

void main() {
  setUp(() {
    WapAdsCore.instance.reset();
  });

  tearDown(() {
    WapAdsCore.instance.reset();
  });

  group('WapAds Kill Switches & Hierarchy Enforcement', () {
    testWidgets('1. Global Kill Switch immediately suppresses all ad formats', (tester) async {
      final killedConfig = EffectiveAdConfig.fromJson({
        'appId': 'filezen',
        'enabled': false, // GLOBAL ADS OFF
        'testMode': false,
        'version': 'kill_v1',
        'formats': {
          'banner': {
            'enabled': true, // Lower level enabled, but global kill switch is OFF
            'format': 'banner',
            'refreshIntervalSeconds': 60,
            'frequency': {},
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'banner_1', 'timeoutMs': 5000},
            ],
          },
        },
      });

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: killedConfig,
        ),
      );

      expect(WapAds.isInitialized, isTrue);
      expect(WapAds.currentConfig?.isFormatEnabled(AdFormat.banner), isFalse);

      // Render banner widget
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Banner must render nothing (SizedBox.shrink)
      expect(find.text('AdMob Ad'), findsNothing);
      expect(find.byType(SizedBox), findsWidgets);

      // Interstitial must reject immediately
      final context = tester.element(find.byType(Scaffold));
      final intResult = await WapAds.showInterstitial(context);
      expect(intResult, isFalse);

      // Rewarded must reject immediately with globalKillSwitch error
      final rewResult = await WapAds.showRewarded(context);
      expect(rewResult.success, isFalse);
      expect(rewResult.rewardGranted, isFalse);
      expect(rewResult.error?.code, AdError.globalKillSwitch);
    });

    testWidgets('2. Format Kill Switch suppresses only targeted format', (tester) async {
      final formatKilledConfig = EffectiveAdConfig.fromJson({
        'appId': 'filezen',
        'enabled': true,
        'testMode': false,
        'version': 'fmt_kill_v1',
        'formats': {
          'banner': {
            'enabled': true,
            'format': 'banner',
            'refreshIntervalSeconds': 60,
            'frequency': {},
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'banner_1', 'timeoutMs': 5000},
            ],
          },
          'interstitial': {
            'enabled': false, // Format killed
            'format': 'interstitial',
            'frequency': {},
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'int_1', 'timeoutMs': 5000},
            ],
          },
          'rewarded': {
            'enabled': true,
            'format': 'rewarded',
            'frequency': {},
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'rew_1', 'timeoutMs': 5000},
            ],
          },
        },
      });

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: formatKilledConfig,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Banner should display
      expect(find.text('AdMob Ad'), findsOneWidget);

      final context = tester.element(find.byType(Scaffold));

      // Interstitial is killed -> returns false
      final intResult = await WapAds.showInterstitial(context);
      expect(intResult, isFalse);

      // Rewarded is active -> succeeds and grants reward
      final rewResult = await WapAds.showRewarded(context);
      expect(rewResult.success, isTrue);
      expect(rewResult.rewardGranted, isTrue);
    });

    testWidgets('3. Placement Kill Switch suppresses specific placement only', (tester) async {
      final placementKilledConfig = EffectiveAdConfig.fromJson({
        'appId': 'filezen',
        'enabled': true,
        'testMode': false,
        'version': 'plc_kill_v1',
        'formats': {
          'banner': {
            'enabled': true,
            'format': 'banner',
            'refreshIntervalSeconds': 60,
            'frequency': {},
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'banner_1', 'timeoutMs': 5000},
            ],
          },
        },
        'placements': {
          'disabled_banner_placement': {
            'placementKey': 'disabled_banner_placement',
            'format': 'banner',
            'enabled': false, // Kill switch active on this specific placement
          },
          'active_banner_placement': {
            'placementKey': 'active_banner_placement',
            'format': 'banner',
            'enabled': true,
          },
        },
      });

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: placementKilledConfig,
        ),
      );

      // Test Disabled Placement
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(placementKey: 'disabled_banner_placement'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('AdMob Ad'), findsNothing);

      // Test Active Placement
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(placementKey: 'active_banner_placement'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('AdMob Ad'), findsOneWidget);
    });
  });
}
