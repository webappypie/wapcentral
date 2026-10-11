import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/config/wap_ads_config_service.dart';

class MockHttpClient extends http.BaseClient {
  final Future<http.Response> Function(http.Request request) handler;

  MockHttpClient(this.handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final req = request as http.Request;
    final response = await handler(req);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
    );
  }
}

void main() {
  group('WapAdsConfigService & Local Caching', () {
    const validConfigJson = {
      'success': true,
      'data': {
        'appId': 'filezen',
        'enabled': true,
        'testMode': false,
        'version': 'hash_v1_abc123',
        'safety': {
          'maxAdRating': 'PG',
          'blockedCategories': ['violence', 'weapons', 'adult_sexual'],
        },
        'formats': {
          'banner': {
            'enabled': true,
            'format': 'banner',
            'refreshIntervalSeconds': 60,
            'frequency': {
              'minIntervalSeconds': 30,
              'cooldownSeconds': 0,
              'sessionCap': 50,
              'dailyCap': 200,
            },
            'mediationChain': [
              {'networkId': 'admob', 'priority': 1, 'adUnitId': 'ca-app-pub-mock/banner1', 'timeoutMs': 5000},
              {'networkId': 'meta', 'priority': 2, 'adUnitId': 'meta_mock_banner1', 'timeoutMs': 5000},
            ],
            'customAdFallback': {
              'campaignId': 'camp_001',
              'title': 'OptiLens AI Promo',
              'description': 'AI Photo Enhancer',
              'ctaText': 'Install Now',
              'destinationUrl': 'https://webappypie.com/optilens',
            },
          },
        },
        'placements': {
          'home_banner': {
            'placementKey': 'home_banner',
            'format': 'banner',
            'enabled': true,
            'cooldownSeconds': 0,
            'sessionCap': 20,
            'dailyCap': 100,
          },
        },
        'disclaimer': 'Test disclaimer',
        'timestamp': '2026-10-06T12:00:00Z',
      },
    };

    test('1. Fetches effective configuration with platform headers', () async {
      http.Request? capturedRequest;

      final mockClient = MockHttpClient((request) async {
        capturedRequest = request;
        return http.Response(jsonEncode(validConfigJson), 200);
      });

      final options = WapAdsOptions(
        appId: 'filezen',
        appKey: 'wap_key_filezen_prod',
        baseUrl: 'https://test.wapcentral.com',
        autoRefreshConfig: false,
      );

      final service = WapAdsConfigService(options: options, client: mockClient);
      final config = await service.fetchRemoteConfig();

      expect(capturedRequest, isNotNull);
      expect(capturedRequest!.url.path, '/api/platform/v1/ads/config');
      expect(capturedRequest!.headers['x-app-id'], 'filezen');
      expect(capturedRequest!.headers['x-app-key'], 'wap_key_filezen_prod');

      expect(config.appId, 'filezen');
      expect(config.enabled, isTrue);
      expect(config.version, 'hash_v1_abc123');
      expect(config.formats.containsKey(AdFormat.banner), isTrue);

      final bannerConfig = config.formats[AdFormat.banner]!;
      expect(bannerConfig.refreshIntervalSeconds, 60);
      expect(bannerConfig.mediationChain.length, 2);
      expect(bannerConfig.mediationChain.first.networkId, 'admob');
      expect(bannerConfig.customAdFallback?.campaignId, 'camp_001');
    });

    test('2. Enforces minimum safe banner refresh interval of 30 seconds', () async {
      final aggressiveConfigJson = {
        'success': true,
        'data': {
          'appId': 'filezen',
          'enabled': true,
          'testMode': false,
          'version': 'hash_v2',
          'formats': {
            'banner': {
              'enabled': true,
              'format': 'banner',
              'refreshIntervalSeconds': 10, // Violates network policy
              'frequency': {'minIntervalSeconds': 0, 'cooldownSeconds': 0, 'sessionCap': 10, 'dailyCap': 50},
              'mediationChain': [],
            },
          },
        },
      };

      final mockClient = MockHttpClient((_) async => http.Response(jsonEncode(aggressiveConfigJson), 200));
      final options = WapAdsOptions(appId: 'filezen', appKey: 'key', autoRefreshConfig: false);
      final service = WapAdsConfigService(options: options, client: mockClient);
      final config = await service.fetchRemoteConfig();

      // Must be bumped to safe minimum 30s
      expect(config.formats[AdFormat.banner]!.refreshIntervalSeconds, 30);
    });

    test('3. Falls back gracefully to cached configuration when offline', () async {
      int requestCount = 0;
      final mockClient = MockHttpClient((_) async {
        requestCount++;
        if (requestCount == 1) {
          return http.Response(jsonEncode(validConfigJson), 200);
        } else {
          throw http.ClientException('Connection refused / offline');
        }
      });

      final options = WapAdsOptions(appId: 'filezen', appKey: 'key', autoRefreshConfig: false);
      final service = WapAdsConfigService(options: options, client: mockClient);

      // Initial successful fetch
      final firstConfig = await service.initialize();
      expect(firstConfig.enabled, isTrue);

      // Second initialization attempt while offline
      final offlineConfig = await service.initialize();
      expect(offlineConfig, isNotNull);
      expect(offlineConfig.enabled, isTrue);
      expect(offlineConfig.appId, 'filezen');
      expect(offlineConfig.version, 'hash_v1_abc123');
    });

    test('4. Safely falls back to safeDisabled when network fails and no cache exists', () async {
      final mockClient = MockHttpClient((_) async {
        throw http.ClientException('Network down');
      });

      final options = WapAdsOptions(appId: 'filezen', appKey: 'key', autoRefreshConfig: false);
      final service = WapAdsConfigService(options: options, client: mockClient);

      final safeConfig = await service.initialize();
      expect(safeConfig, isNotNull);
      expect(safeConfig.enabled, isFalse); // All ads disabled safely
      expect(safeConfig.isFormatEnabled(AdFormat.banner), isFalse);
    });

    test('5. Zero Secret Leakage: Payload never contains provider secret keys', () async {
      final mockClient = MockHttpClient((_) async => http.Response(jsonEncode(validConfigJson), 200));
      final options = WapAdsOptions(appId: 'filezen', appKey: 'key', autoRefreshConfig: false);
      final service = WapAdsConfigService(options: options, client: mockClient);
      final config = await service.fetchRemoteConfig();

      final jsonStr = jsonEncode(config.toJson()).toLowerCase();
      expect(jsonStr.contains('apikey'), isFalse);
      expect(jsonStr.contains('secretkey'), isFalse);
      expect(jsonStr.contains('secretreferencename'), isFalse);
      expect(jsonStr.contains('privatekey'), isFalse);
    });
  });
}
