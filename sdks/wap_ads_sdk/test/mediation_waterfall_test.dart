import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads_sdk.dart';

void main() {
  group('Mediation Waterfall & Priority Engine', () {
    late AdConfig baseConfig;

    setUp(() {
      baseConfig = const AdConfig(
        appId: 'test_app_waterfall',
        admob: AdMobConfig(
          appId: 'ca-app-pub-test~123',
          enabled: true,
          adUnits: [
            AdUnitConfig(
              id: 'admob_b',
              name: 'AdMob Banner',
              type: AdFormat.banner,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/b',
            ),
            AdUnitConfig(
              id: 'admob_i',
              name: 'AdMob Interstitial',
              type: AdFormat.interstitial,
              platform: 'all',
              adUnitId: 'ca-app-pub-test/i',
            ),
          ],
        ),
        meta: MetaConfig(
          appId: 'meta_app_123',
          enabled: true,
          placements: [
            AdPlacement(
              id: 'meta_b',
              name: 'Meta Banner',
              type: AdFormat.banner,
              placementId: 'meta_place_b',
            ),
          ],
        ),
        applovin: AppLovinConfig(
          sdkKey: 'max_key_123',
          enabled: true,
          adUnits: [
            AdUnitConfig(
              id: 'max_b',
              name: 'MAX Banner',
              type: AdFormat.banner,
              platform: 'all',
              adUnitId: 'max_unit_b',
            ),
          ],
        ),
        wapads: WapAdsConfig(
          appKey: 'wap_key_waterfall',
          enabled: true,
        ),
        mediationPriority: MediationPriority(
          waterfall: [
            AdNetwork.admob,
            AdNetwork.meta,
            AdNetwork.applovin,
            AdNetwork.wapads,
          ],
          fallbackTimeoutMs: 1000,
          enableFallback: true,
        ),
      );
    });

    test('1. Normal Waterfall: resolves AdMob as primary winner when healthy', () async {
      final manager = MediationManager();
      await manager.initialize(baseConfig);

      final decision = await manager.resolveAd(AdFormat.banner);

      expect(decision.hasWinner, isTrue);
      expect(decision.winnerNetwork, equals(AdNetwork.admob));
      expect(decision.winnerAdapter?.network, equals(AdNetwork.admob));
      expect(decision.attempts.length, equals(1));
      expect(decision.attempts.first.network, equals(AdNetwork.admob));
      expect(decision.attempts.first.result.isSuccess, isTrue);
    });

    test('2. AdMob Fails: waterfalls automatically to Meta Audience Network', () async {
      // Inject failing AdMob bridge
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final manager = MediationManager(customAdapters: [failingAdmob]);
      await manager.initialize(baseConfig);

      final decision = await manager.resolveAd(AdFormat.banner);

      expect(decision.hasWinner, isTrue);
      expect(decision.winnerNetwork, equals(AdNetwork.meta));
      expect(decision.winnerAdapter?.network, equals(AdNetwork.meta));

      // 2 attempts: 1st failed (AdMob), 2nd won (Meta)
      expect(decision.attempts.length, equals(2));
      expect(decision.attempts[0].network, equals(AdNetwork.admob));
      expect(decision.attempts[0].result.status, equals(AdLoadStatus.failed));
      expect(decision.attempts[1].network, equals(AdNetwork.meta));
      expect(decision.attempts[1].result.isSuccess, isTrue);
    });

    test('3. AdMob & Meta Fail: waterfalls to AppLovin MAX', () async {
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final failingMeta = MetaAdapter(
        bridge: DefaultMetaBridge(shouldSimulateNoFill: true),
      );
      final manager = MediationManager(
        customAdapters: [failingAdmob, failingMeta],
      );
      await manager.initialize(baseConfig);

      final decision = await manager.resolveAd(AdFormat.banner);

      expect(decision.hasWinner, isTrue);
      expect(decision.winnerNetwork, equals(AdNetwork.applovin));

      // 3 attempts
      expect(decision.attempts.length, equals(3));
      expect(decision.attempts[0].network, equals(AdNetwork.admob));
      expect(decision.attempts[1].network, equals(AdNetwork.meta));
      expect(decision.attempts[2].network, equals(AdNetwork.applovin));
      expect(decision.attempts[2].result.isSuccess, isTrue);
    });

    test('4. All External Networks Fail: waterfalls to WAPAds house-ad promo hook', () async {
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final failingMeta = MetaAdapter(
        bridge: DefaultMetaBridge(shouldSimulateFailure: true),
      );
      final failingMax = AppLovinAdapter(
        bridge: DefaultAppLovinBridge(shouldSimulateNoFill: true),
      );

      final promoHook = DelegatePromoHook(
        availabilityChecker: () => true,
      );

      final manager = MediationManager(
        customAdapters: [failingAdmob, failingMeta, failingMax],
        promoHook: promoHook,
      );
      await manager.initialize(baseConfig);

      final decision = await manager.resolveAd(AdFormat.banner);

      expect(decision.hasWinner, isTrue);
      expect(decision.winnerNetwork, equals(AdNetwork.wapads));

      // 4 attempts culminating in WAPAds success
      expect(decision.attempts.length, equals(4));
      expect(decision.attempts[0].network, equals(AdNetwork.admob));
      expect(decision.attempts[1].network, equals(AdNetwork.meta));
      expect(decision.attempts[2].network, equals(AdNetwork.applovin));
      expect(decision.attempts[3].network, equals(AdNetwork.wapads));
      expect(decision.attempts[3].result.isSuccess, isTrue);
    });

    test('5. Complete Network Exhaustion: returns empty decision without throwing', () async {
      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final failingMeta = MetaAdapter(
        bridge: DefaultMetaBridge(shouldSimulateFailure: true),
      );
      final failingMax = AppLovinAdapter(
        bridge: DefaultAppLovinBridge(shouldSimulateFailure: true),
      );
      // No promo hook registered
      final manager = MediationManager(
        customAdapters: [failingAdmob, failingMeta, failingMax],
        promoHook: null,
      );
      await manager.initialize(baseConfig);

      final decision = await manager.resolveAd(AdFormat.banner);

      expect(decision.hasWinner, isFalse);
      expect(decision.winnerNetwork, isNull);
      expect(decision.winnerAdapter, isNull);
      expect(decision.attempts.length, equals(4));
    });

    test('6. Custom Priority Reordering: prioritizes configured sequence', () async {
      // Configure Meta as primary, WAPAds as secondary
      final customConfig = AdConfig(
        appId: 'custom_order_app',
        meta: baseConfig.meta,
        wapads: baseConfig.wapads,
        mediationPriority: const MediationPriority(
          waterfall: [AdNetwork.meta, AdNetwork.wapads],
        ),
      );

      final manager = MediationManager();
      await manager.initialize(customConfig);

      final decision = await manager.resolveAd(AdFormat.banner);
      expect(decision.hasWinner, isTrue);
      expect(decision.winnerNetwork, equals(AdNetwork.meta));
      expect(decision.attempts.first.network, equals(AdNetwork.meta));
    });

    test('7. Fallback disabled flag halts at first provider', () async {
      final noFallbackConfig = AdConfig(
        appId: 'no_fallback_app',
        admob: baseConfig.admob,
        meta: baseConfig.meta,
        mediationPriority: const MediationPriority(
          waterfall: [AdNetwork.admob, AdNetwork.meta],
          enableFallback: false,
        ),
      );

      final failingAdmob = AdMobAdapter(
        bridge: DefaultAdMobBridge(shouldSimulateFailure: true),
      );
      final manager = MediationManager(customAdapters: [failingAdmob]);
      await manager.initialize(noFallbackConfig);

      final decision = await manager.resolveAd(AdFormat.banner);
      expect(decision.hasWinner, isFalse);
      // Only 1 attempt because fallback was disabled
      expect(decision.attempts.length, equals(1));
    });
  });
}
