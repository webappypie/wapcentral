import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() {
  const testSecret = 'dev_test_signing_secret_9988_key';

  final validConfig = PromoConfig(
    appId: 'app_01',
    appKey: 'wap_app_key_notes_dev',
    baseUrl: 'https://promotion-api.webappypie.com',
    signingSecret: testSecret,
    appVersion: '1.0.0',
    platform: 'android',
  );

  group('PromoService (Phase 8 Lifecycle & Reliability)', () {
    late PromoCache cache;

    setUp(() {
      cache = PromoCache(null); // In-memory
    });

    test('1. Cache-First Startup: loads immediately from cache without awaiting network', () async {
      final cachedPayload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_from_cache',
        title: 'Offline Cached App Promo',
        description: 'Instant zero latency load',
        ctaText: 'Install',
        storeUrl: 'https://play.google.com/store',
        cacheTtlSeconds: 21600,
        signature: 'valid_sig',
      );

      await cache.setCachedPayload('app_01', cachedPayload);

      // Create a mock client that would take time or fail if called synchronously
      final client = MockClient((request) async {
        return http.Response('{}', 200);
      });

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      // Init from cache
      service.initFromCache();

      // Immediately available in promoNotifier with ZERO network latency
      expect(service.promoNotifier.value, isNotNull);
      expect(service.promoNotifier.value!.campaignId, 'camp_from_cache');
      expect(service.promoNotifier.value!.title, 'Offline Cached App Promo');
    });

    test('2. Remote Delivery & HMAC Validation: parses valid response and updates cache', () async {
      final serverMap = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_remote_fresh',
        'title': 'Fresh Remote Promotion',
        'description': 'Loaded from server',
        'ctaText': 'Explore',
        'storeUrl': 'https://play.google.com/store/apps/details?id=com.app',
        'layoutVariant': 'banner',
        'cacheTtlSeconds': 21600,
      };

      final signature = CryptoValidator.computeSignature(serverMap, testSecret);
      serverMap['signature'] = signature;

      final client = MockClient((request) async {
        expect(request.url.path, '/v1/promotion');
        expect(request.headers['X-App-Key'], 'wap_app_key_notes_dev');
        expect(request.url.queryParameters['appId'], 'app_01');

        return http.Response(jsonEncode(serverMap), 200);
      });

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      final fetched = await service.fetchCampaign(forceRefresh: true);

      expect(fetched, isNotNull);
      expect(fetched!.campaignId, 'camp_remote_fresh');
      expect(fetched.title, 'Fresh Remote Promotion');
      expect(service.promoNotifier.value?.campaignId, 'camp_remote_fresh');

      // Verify it was stored in local cache
      final inCache = cache.getCachedPayload('app_01');
      expect(inCache?.campaignId, 'camp_remote_fresh');
    });

    test('3. HMAC Tamper Rejection: rejects untrusted signature and retains cache', () async {
      final cachedPayload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_trusted_cache',
        title: 'Original Trusted Campaign',
        cacheTtlSeconds: 21600,
        signature: 'valid_sig',
      );
      await cache.setCachedPayload('app_01', cachedPayload);

      // Server response with tampered signature
      final badResponse = <String, dynamic>{
        'schemaVersion': 1,
        'enabled': true,
        'campaignId': 'camp_malicious_spoof',
        'title': 'Phishing Title',
        'cacheTtlSeconds': 21600,
        'signature': 'invalid_fake_signature_9999',
      };

      final client = MockClient((request) async {
        return http.Response(jsonEncode(badResponse), 200);
      });

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      service.promoNotifier.value = cachedPayload;

      final result = await service.fetchCampaign(forceRefresh: true);

      // Should reject the tampered payload and retain trusted cache
      expect(result?.campaignId, 'camp_trusted_cache');
      expect(service.promoNotifier.value?.campaignId, 'camp_trusted_cache');
    });

    test('4. Network Failure Resilience: graceful fallback to cache without crashing', () async {
      final cachedPayload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_fallback',
        title: 'Fallback Campaign',
        cacheTtlSeconds: 21600,
        signature: 'sig',
      );
      await cache.setCachedPayload('app_01', cachedPayload);

      // Client simulates HTTP 500 error or socket exception
      final client = MockClient((request) async {
        throw http.ClientException('Network connection unreachable');
      });

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      final result = await service.fetchCampaign(forceRefresh: true);

      // Gracefully returns cached payload without throwing
      expect(result, isNotNull);
      expect(result!.campaignId, 'camp_fallback');
    });

    test('5. Frequency Capping: hides campaign when impression limit is exceeded', () async {
      final payloadWithCap = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_capped',
        title: 'Limited Campaign',
        cacheTtlSeconds: 3600,
        signature: 'sig',
        frequencyCap: const PromoFrequencyCap(maxImpressions: 2, periodHours: 24),
      );

      final client = MockClient((request) async => http.Response('{}', 200));

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      service.promoNotifier.value = payloadWithCap;
      expect(service.promoNotifier.value, isNotNull);

      // 1st impression
      service.recordImpression('camp_capped');
      expect(service.promoNotifier.value, isNotNull);

      // 2nd impression (limit reached: maxImpressions = 2)
      service.recordImpression('camp_capped');
      // Should automatically clear notifier when frequency cap is reached
      expect(service.promoNotifier.value, isNull);
    });

    test('6. Telemetry Dispatch: records impressions and clicks via HTTP POST', () async {
      int impressionCalls = 0;
      int clickCalls = 0;

      final client = MockClient((request) async {
        if (request.url.path == '/v1/analytics/impression') {
          impressionCalls++;
          final body = jsonDecode(request.body);
          expect(body['campaignId'], 'camp_test');
          expect(body['appId'], 'app_01');
          return http.Response('{"success":true}', 202);
        }
        if (request.url.path == '/v1/analytics/click') {
          clickCalls++;
          final body = jsonDecode(request.body);
          expect(body['campaignId'], 'camp_test');
          return http.Response('{"success":true}', 202);
        }
        return http.Response('{}', 404);
      });

      final service = PromoService(
        config: validConfig,
        cache: cache,
        client: client,
      );

      service.recordImpression('camp_test');
      service.recordClick('camp_test');

      // Wait a tick for fire-and-forget unawaited calls
      await Future.delayed(const Duration(milliseconds: 50));

      expect(impressionCalls, 1);
      expect(clickCalls, 1);
    });
  });
}
