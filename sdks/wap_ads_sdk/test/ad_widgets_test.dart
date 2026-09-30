import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads_sdk.dart';

void main() {
  group('Ad Widgets & UI Rendering', () {
    late AdConfig testConfig;

    setUp(() {
      WapAdsSdk.reset();
      testConfig = const AdConfig(
        appId: 'widget_test_app',
        admob: AdMobConfig(
          appId: 'ca-app-pub-widget~123',
          enabled: true,
          adUnits: [
            AdUnitConfig(
              id: 'u_banner',
              name: 'Banner',
              type: AdFormat.banner,
              platform: 'all',
              adUnitId: 'ca-app-pub-widget/banner',
            ),
            AdUnitConfig(
              id: 'u_native',
              name: 'Native',
              type: AdFormat.native,
              platform: 'all',
              adUnitId: 'ca-app-pub-widget/native',
            ),
            AdUnitConfig(
              id: 'u_interstitial',
              name: 'Interstitial',
              type: AdFormat.interstitial,
              platform: 'all',
              adUnitId: 'ca-app-pub-widget/interstitial',
            ),
            AdUnitConfig(
              id: 'u_rewarded',
              name: 'Rewarded',
              type: AdFormat.rewarded,
              platform: 'all',
              adUnitId: 'ca-app-pub-widget/rewarded',
            ),
          ],
        ),
        meta: MetaConfig(
          appId: 'meta_widget_123',
          enabled: true,
          placements: [
            AdPlacement(
              id: 'p_banner',
              name: 'Meta Banner',
              type: AdFormat.banner,
              placementId: 'meta_banner_123',
            ),
          ],
        ),
        wapads: WapAdsConfig(
          appKey: 'wap_key_widget',
          enabled: true,
        ),
        mediationPriority: MediationPriority(
          waterfall: [AdNetwork.admob, AdNetwork.meta, AdNetwork.wapads],
        ),
      );
    });

    tearDown(() {
      WapAdsSdk.reset();
    });

    testWidgets('WapAdBanner renders SizedBox.shrink when SDK is not initialized', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapAdBanner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // No banner widget rendered
      expect(find.byKey(const ValueKey('admob_banner_widget')), findsNothing);
      expect(find.byKey(const ValueKey('meta_banner_widget')), findsNothing);
    });

    testWidgets('WapAdBanner renders AdMob banner when primary is available', (tester) async {
      await WapAdsSdk.init(testConfig);

      bool loaded = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapAdBanner(
              onAdLoaded: () => loaded = true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(loaded, isTrue);
      expect(find.byKey(const ValueKey('banner_admob')), findsOneWidget);
      expect(find.byKey(const ValueKey('admob_banner_widget')), findsOneWidget);
      expect(find.text('AdMob'), findsOneWidget);
    });

    testWidgets('WapAdBanner falls back to Meta banner when AdMob fails', (tester) async {
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );

      await WapAdsSdk.init(
        testConfig,
        customAdapters: [failingAdmob],
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapAdBanner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('banner_meta')), findsOneWidget);
      expect(find.byKey(const ValueKey('meta_banner_widget')), findsOneWidget);
      expect(find.text('Meta'), findsOneWidget);
    });

    testWidgets('WapAdBanner waterfalls to WapPromoHook house ads when all external networks fail', (tester) async {
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final failingMeta = MetaAdapter(
        bridge: DefaultMetaBridge(shouldSimulateFailure: true),
      );

      final promoHook = DelegatePromoHook(
        availabilityChecker: () => true,
        bannerBuilder: (context, {onAdClicked, onAdLoaded}) {
          return Container(
            key: const ValueKey('custom_house_banner_from_promo_sdk'),
            child: const Text('Try WebAppyPie Notes Free!'),
          );
        },
      );

      await WapAdsSdk.init(
        testConfig,
        customAdapters: [failingAdmob, failingMeta],
        promoHook: promoHook,
      );

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapAdBanner(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('banner_wapads')), findsOneWidget);
      expect(find.byKey(const ValueKey('custom_house_banner_from_promo_sdk')), findsOneWidget);
      expect(find.text('Try WebAppyPie Notes Free!'), findsOneWidget);
    });

    testWidgets('WapAdNative renders native card layout with mediation waterfall', (tester) async {
      await WapAdsSdk.init(testConfig);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapAdNative(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('native_admob')), findsOneWidget);
      expect(find.byKey(const ValueKey('admob_native_widget')), findsOneWidget);
      expect(find.text('Google AdMob Sponsored Content'), findsOneWidget);
    });

    testWidgets('WapAdsSdk.showInterstitial displays and completes across waterfall', (tester) async {
      await WapAdsSdk.init(testConfig);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Text('Home Screen'),
          ),
        ),
      );

      bool dismissed = false;
      final shown = await WapAdsSdk.showInterstitial(
        tester.element(find.text('Home Screen')),
        onDismissed: () => dismissed = true,
      );

      expect(shown, isTrue);
      expect(dismissed, isTrue);
    });

    testWidgets('WapAdsSdk.showRewarded grants rewards upon completion', (tester) async {
      await WapAdsSdk.init(testConfig);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Text('Rewards Screen'),
          ),
        ),
      );

      num rewardAmount = 0;
      String rewardType = '';

      final shown = await WapAdsSdk.showRewarded(
        tester.element(find.text('Rewards Screen')),
        onUserEarnedReward: (amount, type) {
          rewardAmount = amount;
          rewardType = type;
        },
      );

      expect(shown, isTrue);
      expect(rewardAmount, equals(10));
      expect(rewardType, equals('coins'));
    });
  });
}
