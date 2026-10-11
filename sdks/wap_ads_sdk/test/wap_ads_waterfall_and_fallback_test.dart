import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/core/wap_ads_core.dart';
import 'package:wap_ads_sdk/src/providers/admob_provider.dart';
import 'package:wap_ads_sdk/src/providers/meta_provider.dart';
import 'package:wap_ads_sdk/src/providers/applovin_provider.dart';

void main() {
  setUp(() {
    WapAdsCore.instance.reset();
  });

  tearDown(() {
    WapAdsCore.instance.reset();
  });

  group('WapAds Waterfall Mediation & Fallback Cascade', () {
    final waterfallConfig = EffectiveAdConfig.fromJson({
      'appId': 'filezen',
      'enabled': true,
      'testMode': true,
      'version': 'waterfall_v1',
      'formats': {
        'banner': {
          'enabled': true,
          'format': 'banner',
          'refreshIntervalSeconds': 60,
          'frequency': {},
          'mediationChain': [
            {'networkId': 'admob', 'priority': 1, 'adUnitId': 'admob_banner_u1', 'timeoutMs': 5000},
            {'networkId': 'meta', 'priority': 2, 'adUnitId': 'meta_banner_u2', 'timeoutMs': 5000},
            {'networkId': 'applovin', 'priority': 3, 'adUnitId': 'applovin_banner_u3', 'timeoutMs': 5000},
          ],
          'customAdFallback': {
            'campaignId': 'house_promo_optilens',
            'title': 'Download OptiLens AI',
            'description': 'AI Photo Enhancement suite',
            'ctaText': 'Install',
            'destinationUrl': 'https://webappypie.com/optilens',
          },
        },
      },
    });

    testWidgets('1. Serves Primary Tier (AdMob) when healthy', (tester) async {
      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: waterfallConfig,
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

      // Priority 1 AdMob banner displayed
      expect(find.text('AdMob Ad'), findsOneWidget);
      expect(find.text('Meta'), findsNothing);
      expect(find.text('MAX'), findsNothing);
    });

    testWidgets('2. Cascades to Tier 2 (Meta) when AdMob fails', (tester) async {
      // Simulate failure on AdMob
      final admob = AdMobProvider()..simulateFailure = true;

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: waterfallConfig,
        ),
        customProviders: [admob],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tier 1 AdMob failed -> Tier 2 Meta displayed
      expect(find.text('AdMob Ad'), findsNothing);
      expect(find.text('Meta'), findsOneWidget);
    });

    testWidgets('3. Cascades to Tier 3 (AppLovin) when AdMob & Meta both fail', (tester) async {
      final admob = AdMobProvider()..simulateFailure = true;
      final meta = MetaProvider()..simulateFailure = true;

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: waterfallConfig,
        ),
        customProviders: [admob, meta],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tier 1 & 2 failed -> Tier 3 AppLovin displayed
      expect(find.text('AdMob Ad'), findsNothing);
      expect(find.text('Meta'), findsNothing);
      expect(find.text('MAX'), findsOneWidget);
    });

    testWidgets('4. Cascades to WebAppyPie Custom Ads fallback when all 3 networks fail', (tester) async {
      final admob = AdMobProvider()..simulateFailure = true;
      final meta = MetaProvider()..simulateFailure = true;
      final applovin = AppLovinProvider()..simulateFailure = true;

      await WapAds.initialize(
        WapAdsOptions.test(
          appId: 'filezen',
          initialConfig: waterfallConfig,
        ),
        customProviders: [admob, meta, applovin],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAds.banner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // External networks all failed -> In-house PROMO banner fallback displayed
      expect(find.text('AdMob Ad'), findsNothing);
      expect(find.text('Meta'), findsNothing);
      expect(find.text('MAX'), findsNothing);
      expect(find.text('PROMO'), findsOneWidget);
      expect(find.text('Download OptiLens AI'), findsOneWidget);
    });
  });
}
