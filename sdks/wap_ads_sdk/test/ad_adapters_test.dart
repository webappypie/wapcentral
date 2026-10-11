import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads_sdk.dart';

void main() {
  group('Ad Providers & Adapters', () {
    late AdConfig testConfig;

    setUp(() {
      testConfig = AdConfig(
        appId: 'test_app_123',
        admob: const AdMobConfig(
          appId: 'ca-app-pub-test~123',
          enabled: true,
          adUnits: [
            AdUnitConfig(
              id: 'admob_b1',
              name: 'AdMob Banner',
              type: AdFormat.banner,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/b1',
            ),
            AdUnitConfig(
              id: 'admob_i1',
              name: 'AdMob Interstitial',
              type: AdFormat.interstitial,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/i1',
            ),
            AdUnitConfig(
              id: 'admob_r1',
              name: 'AdMob Rewarded',
              type: AdFormat.rewarded,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/r1',
            ),
            AdUnitConfig(
              id: 'admob_n1',
              name: 'AdMob Native',
              type: AdFormat.native,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/n1',
            ),
          ],
        ),
        meta: const MetaConfig(
          appId: 'meta_app_456',
          enabled: true,
          placements: [
            AdPlacement(
              id: 'meta_p1',
              name: 'Meta Banner Placement',
              type: AdFormat.banner,
              placementId: 'meta_place_banner',
            ),
            AdPlacement(
              id: 'meta_p2',
              name: 'Meta Interstitial Placement',
              type: AdFormat.interstitial,
              placementId: 'meta_place_interstitial',
            ),
          ],
        ),
        applovin: const AppLovinConfig(
          sdkKey: 'max_key_789',
          enabled: true,
          adUnits: [
            AdUnitConfig(
              id: 'max_b1',
              name: 'MAX Banner',
              type: AdFormat.banner,
              platform: 'all',
              adUnitId: 'max_unit_banner',
            ),
            AdUnitConfig(
              id: 'max_r1',
              name: 'MAX Rewarded',
              type: AdFormat.rewarded,
              platform: 'all',
              adUnitId: 'max_unit_rewarded',
            ),
          ],
        ),
        wapads: const WapAdsConfig(
          appKey: 'wap_test_key_001',
          enabled: true,
        ),
        inmobi: const InMobiConfig(
          accountId: 'inmobi_acc_123',
          enabled: true,
          placements: [
            AdPlacement(
              id: 'inmobi_b1',
              name: 'InMobi Banner',
              type: AdFormat.banner,
              placementId: '1612345678901',
            ),
            AdPlacement(
              id: 'inmobi_i1',
              name: 'InMobi Interstitial',
              type: AdFormat.interstitial,
              placementId: '1612345678902',
            ),
          ],
        ),
        unity: const UnityAdsConfig(
          gameId: 'unity_game_456',
          enabled: true,
          placements: [
            AdPlacement(
              id: 'unity_b1',
              name: 'Unity Banner',
              type: AdFormat.banner,
              placementId: 'Banner_Android',
            ),
            AdPlacement(
              id: 'unity_r1',
              name: 'Unity Rewarded',
              type: AdFormat.rewarded,
              placementId: 'Rewarded_Android',
            ),
          ],
        ),
      );
    });

    test('AdMobAdapter should initialize, load ads, and handle simulated bridge results', () async {
      final adapter = AdMobAdapter();
      expect(adapter.isInitialized, isFalse);

      final initSuccess = await adapter.initialize(testConfig);
      expect(initSuccess, isTrue);
      expect(adapter.isInitialized, isTrue);

      // Load banner
      final bannerResult = await adapter.loadAd(AdFormat.banner);
      expect(bannerResult.isSuccess, isTrue);
      expect(bannerResult.network, equals(AdNetwork.admob));
      expect(bannerResult.adUnitId, equals('ca-app-pub-test/b1'));

      // Test simulated failure bridge
      final failingAdapter = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      await failingAdapter.initialize(testConfig);
      final failResult = await failingAdapter.loadAd(AdFormat.banner);
      expect(failResult.isSuccess, isFalse);
      expect(failResult.status, equals(AdLoadStatus.failed));

      // Test simulated no-fill bridge
      final noFillAdapter = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateNoFill: true),
      );
      await noFillAdapter.initialize(testConfig);
      final noFillResult = await noFillAdapter.loadAd(AdFormat.banner);
      expect(noFillResult.isSuccess, isFalse);
      expect(noFillResult.status, equals(AdLoadStatus.noFill));
    });

    test('MetaAdapter should initialize and resolve placements for Audience Network', () async {
      final adapter = MetaAdapter();
      final initSuccess = await adapter.initialize(testConfig);
      expect(initSuccess, isTrue);

      final result = await adapter.loadAd(AdFormat.banner);
      expect(result.isSuccess, isTrue);
      expect(result.network, equals(AdNetwork.meta));
      expect(result.adUnitId, equals('meta_place_banner'));

      // Unconfigured format should return skipped
      final nativeResult = await adapter.loadAd(AdFormat.native);
      expect(nativeResult.status, equals(AdLoadStatus.skipped));
    });

    test('AppLovinAdapter should initialize and handle real-time mediation requests', () async {
      final adapter = AppLovinAdapter();
      final initSuccess = await adapter.initialize(testConfig);
      expect(initSuccess, isTrue);

      final rewardedResult = await adapter.loadAd(AdFormat.rewarded);
      expect(rewardedResult.isSuccess, isTrue);
      expect(rewardedResult.network, equals(AdNetwork.applovin));
      expect(rewardedResult.adUnitId, equals('max_unit_rewarded'));
    });

    testWidgets('WapAdsAdapter should delegate cleanly to WapPromoHook without SDK coupling', (tester) async {
      bool bannerRequested = false;
      bool interstitialPresented = false;

      final testPromoHook = DelegatePromoHook(
        availabilityChecker: () => true,
        bannerBuilder: (context, {onAdClicked, onAdLoaded}) {
          bannerRequested = true;
          onAdLoaded?.call();
          return const Text('Test Promo Hook Banner');
        },
        interstitialHandler: (context, {onDismissed}) async {
          interstitialPresented = true;
          onDismissed?.call();
          return true;
        },
      );

      final adapter = WapAdsAdapter(promoHook: testPromoHook);
      await adapter.initialize(testConfig);

      // Load ad returns success when hook is available
      final result = await adapter.loadAd(AdFormat.banner);
      expect(result.isSuccess, isTrue);
      expect(result.network, equals(AdNetwork.wapads));

      // Widget delegates to hook
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Builder(
            builder: (context) => adapter.buildBannerWidget(context: context),
          ),
        ),
      );

      expect(bannerRequested, isTrue);
      expect(find.text('Test Promo Hook Banner'), findsOneWidget);

      // Interstitial delegates to hook
      final shown = await adapter.showInterstitial(
        context: tester.element(find.text('Test Promo Hook Banner')),
      );
      expect(shown, isTrue);
      expect(interstitialPresented, isTrue);
    });

    test('WapAdsAdapter should return no-fill when no promo hook is registered or promo is capped', () async {
      // 1. No hook registered
      final adapterNoHook = WapAdsAdapter(promoHook: null);
      await adapterNoHook.initialize(testConfig);
      final res1 = await adapterNoHook.loadAd(AdFormat.banner);
      expect(res1.isSuccess, isFalse);
      expect(res1.status, equals(AdLoadStatus.noFill));

      // 2. Hook registered but campaign unavailable / capped
      final cappedHook = DelegatePromoHook(availabilityChecker: () => false);
      final adapterCapped = WapAdsAdapter(promoHook: cappedHook);
      await adapterCapped.initialize(testConfig);
      final res2 = await adapterCapped.loadAd(AdFormat.banner);
      expect(res2.isSuccess, isFalse);
      expect(res2.status, equals(AdLoadStatus.noFill));
    });

    test('InMobiAdapter should initialize and resolve placements for InMobi', () async {
      final adapter = InMobiAdapter();
      expect(adapter.isInitialized, isFalse);
      final initSuccess = await adapter.initialize(testConfig);
      expect(initSuccess, isTrue);
      expect(adapter.isInitialized, isTrue);

      final result = await adapter.loadAd(AdFormat.banner);
      expect(result.isSuccess, isTrue);
      expect(result.network, equals(AdNetwork.inmobi));
      expect(result.adUnitId, equals('1612345678901'));

      // Unsupported/unconfigured format should return skipped
      final appOpenResult = await adapter.loadAd(AdFormat.appOpen);
      expect(appOpenResult.status, equals(AdLoadStatus.skipped));
    });

    test('UnityAdapter should initialize and resolve placements for Unity Ads', () async {
      final adapter = UnityAdapter();
      expect(adapter.isInitialized, isFalse);
      final initSuccess = await adapter.initialize(testConfig);
      expect(initSuccess, isTrue);
      expect(adapter.isInitialized, isTrue);

      final result = await adapter.loadAd(AdFormat.rewarded);
      expect(result.isSuccess, isTrue);
      expect(result.network, equals(AdNetwork.unity));
      expect(result.adUnitId, equals('Rewarded_Android'));

      // Native not supported on Unity Ads
      final nativeResult = await adapter.loadAd(AdFormat.native);
      expect(nativeResult.status, equals(AdLoadStatus.skipped));
    });

    test('InMobiProvider and UnityAdsProvider should initialize and expose correct network ids', () async {
      final inmobiProvider = InMobiProvider();
      expect(inmobiProvider.id, equals('inmobi'));
      expect(inmobiProvider.name, equals('InMobi'));
      expect(inmobiProvider.isFormatSupported(AdFormat.banner), isTrue);
      expect(inmobiProvider.isFormatSupported(AdFormat.appOpen), isFalse);

      final unityProvider = UnityAdsProvider();
      expect(unityProvider.id, equals('unity'));
      expect(unityProvider.name, equals('Unity Ads'));
      expect(unityProvider.isFormatSupported(AdFormat.rewarded), isTrue);
      expect(unityProvider.isFormatSupported(AdFormat.native), isFalse);
    });
  });
}
