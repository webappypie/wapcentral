import 'package:flutter_test/flutter_test.dart';
import 'package:wap_ads_sdk/wap_ads_sdk.dart';

void main() {
  group('Ad Models & Configuration', () {
    test('AdNetwork and AdFormat should parse strings and expose display names', () {
      expect(AdNetwork.fromString('admob'), equals(AdNetwork.admob));
      expect(AdNetwork.fromString('meta'), equals(AdNetwork.meta));
      expect(AdNetwork.fromString('applovin'), equals(AdNetwork.applovin));
      expect(AdNetwork.fromString('wapads'), equals(AdNetwork.wapads));
      expect(AdNetwork.fromString('unknown'), equals(AdNetwork.admob));

      expect(AdNetwork.wapads.isFirstParty, isTrue);
      expect(AdNetwork.admob.isFirstParty, isFalse);
      expect(AdNetwork.applovin.isMediationPlatform, isTrue);

      expect(AdFormat.fromString('banner'), equals(AdFormat.banner));
      expect(AdFormat.fromString('interstitial'), equals(AdFormat.interstitial));
      expect(AdFormat.fromString('rewarded'), equals(AdFormat.rewarded));
      expect(AdFormat.fromString('native'), equals(AdFormat.native));
      expect(AdFormat.fromString('rewarded_interstitial'), equals(AdFormat.rewardedInterstitial));
    });

    test('AdUnitConfig and AdPlacement should serialize and deserialize correctly', () {
      final unitJson = {
        'id': 'unit_1',
        'name': 'Home Banner',
        'type': 'banner',
        'platform': 'android',
        'adUnitId': 'ca-app-pub-12345/67890',
        'network': 'admob',
      };

      final unit = AdUnitConfig.fromJson(unitJson);
      expect(unit.id, equals('unit_1'));
      expect(unit.name, equals('Home Banner'));
      expect(unit.type, equals(AdFormat.banner));
      expect(unit.platform, equals('android'));
      expect(unit.adUnitId, equals('ca-app-pub-12345/67890'));
      expect(unit.network, equals(AdNetwork.admob));

      final serialized = unit.toJson();
      expect(serialized['id'], equals('unit_1'));
      expect(serialized['type'], equals('banner'));

      final placementJson = {
        'id': 'place_1',
        'name': 'Meta Feed Banner',
        'type': 'banner',
        'placementId': 'meta_placement_123',
      };
      final placement = AdPlacement.fromJson(placementJson);
      expect(placement.id, equals('place_1'));
      expect(placement.placementId, equals('meta_placement_123'));
      expect(placement.toJson()['placementId'], equals('meta_placement_123'));
    });

    test('MediationPriority should parse list and map formats and provide defaults', () {
      final defaultPriority = MediationPriority.defaultPriority;
      expect(defaultPriority.waterfall, equals([
        AdNetwork.admob,
        AdNetwork.meta,
        AdNetwork.applovin,
        AdNetwork.wapads,
      ]));
      expect(defaultPriority.fallbackTimeoutMs, equals(5000));
      expect(defaultPriority.enableFallback, isTrue);

      // Parse from List
      final parsedList = MediationPriority.fromJson(['meta', 'admob', 'wapads']);
      expect(parsedList.waterfall, equals([AdNetwork.meta, AdNetwork.admob, AdNetwork.wapads]));

      // Parse from Map
      final parsedMap = MediationPriority.fromJson({
        'waterfall': ['applovin', 'wapads'],
        'fallbackTimeoutMs': 3000,
        'enableFallback': false,
      });
      expect(parsedMap.waterfall, equals([AdNetwork.applovin, AdNetwork.wapads]));
      expect(parsedMap.fallbackTimeoutMs, equals(3000));
      expect(parsedMap.enableFallback, isFalse);
    });

    test('AdConfig should deserialize complete multi-network configuration and match units', () {
      final configJson = {
        'appId': 'app_reader_01',
        'testMode': true,
        'admob': {
          'appId': 'ca-app-pub-test~123',
          'enabled': true,
          'adUnits': [
            {
              'id': 'u1',
              'name': 'Android Banner',
              'type': 'banner',
              'platform': 'android',
              'adUnitId': 'ca-app-pub-test/banner_android',
            },
            {
              'id': 'u2',
              'name': 'iOS Banner',
              'type': 'banner',
              'platform': 'ios',
              'adUnitId': 'ca-app-pub-test/banner_ios',
            },
            {
              'id': 'u3',
              'name': 'Interstitial',
              'type': 'interstitial',
              'platform': 'all',
              'adUnitId': 'ca-app-pub-test/interstitial',
            },
          ],
        },
        'meta': {
          'appId': 'meta_app_123',
          'enabled': true,
          'placements': [
            {
              'id': 'p1',
              'name': 'Meta Banner',
              'type': 'banner',
              'placementId': 'meta_banner_place_1',
            },
          ],
        },
        'applovin': {
          'sdkKey': 'max_sdk_key_999',
          'enabled': true,
          'adUnits': [
            {
              'id': 'max_u1',
              'name': 'MAX Rewarded',
              'type': 'rewarded',
              'platform': 'all',
              'adUnitId': 'max_rewarded_unit_1',
            },
          ],
        },
        'wapads': {
          'appKey': 'wap_key_reader_prod',
          'enabled': true,
        },
        'mediationPriority': ['admob', 'meta', 'applovin', 'wapads'],
      };

      final config = AdConfig.fromJson(configJson);
      expect(config.appId, equals('app_reader_01'));
      expect(config.testMode, isTrue);
      expect(config.admob?.enabled, isTrue);
      expect(config.meta?.enabled, isTrue);
      expect(config.applovin?.enabled, isTrue);
      expect(config.wapads?.enabled, isTrue);

      // Match AdMob Android banner
      final admobAndroid = config.findAdUnit(AdNetwork.admob, AdFormat.banner, platform: 'android');
      expect(admobAndroid?.adUnitId, equals('ca-app-pub-test/banner_android'));

      // Match AdMob iOS banner
      final admobIos = config.findAdUnit(AdNetwork.admob, AdFormat.banner, platform: 'ios');
      expect(admobIos?.adUnitId, equals('ca-app-pub-test/banner_ios'));

      // Match Meta placement
      final metaBanner = config.findAdUnit(AdNetwork.meta, AdFormat.banner);
      expect(metaBanner?.adUnitId, equals('meta_banner_place_1'));

      // Match AppLovin rewarded
      final maxRewarded = config.findAdUnit(AdNetwork.applovin, AdFormat.rewarded);
      expect(maxRewarded?.adUnitId, equals('max_rewarded_unit_1'));

      // Match WAPAds house ads
      final wapadsUnit = config.findAdUnit(AdNetwork.wapads, AdFormat.banner);
      expect(wapadsUnit?.adUnitId, equals('wap_key_reader_prod'));
    });

    test('AdLoadResult factories should record status and latency accurately', () {
      final success = AdLoadResult.success(
        network: AdNetwork.admob,
        format: AdFormat.banner,
        adUnitId: 'u1',
        latencyMs: 42,
      );
      expect(success.isSuccess, isTrue);
      expect(success.status, equals(AdLoadStatus.loaded));
      expect(success.latencyMs, equals(42));

      final failure = AdLoadResult.failure(
        network: AdNetwork.meta,
        format: AdFormat.interstitial,
        errorMessage: 'Network timeout',
        errorCode: 'TIMEOUT',
      );
      expect(failure.isSuccess, isFalse);
      expect(failure.status, equals(AdLoadStatus.failed));
      expect(failure.errorMessage, equals('Network timeout'));

      final noFill = AdLoadResult.noFill(
        network: AdNetwork.applovin,
        format: AdFormat.native,
      );
      expect(noFill.status, equals(AdLoadStatus.noFill));
    });
  });
}
