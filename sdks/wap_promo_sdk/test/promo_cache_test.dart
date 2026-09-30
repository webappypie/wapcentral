import 'package:flutter_test/flutter_test.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() {
  group('PromoCache', () {
    late PromoCache cache;

    setUp(() {
      cache = PromoCache(null); // Use in-memory store
    });

    test('should store and retrieve payload without latency', () async {
      final payload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_cache_test',
        title: 'Cached Promotion',
        cacheTtlSeconds: 3600,
        signature: 'sig_123',
      );

      await cache.setCachedPayload('app_01', payload);

      final retrieved = cache.getCachedPayload('app_01');
      expect(retrieved, isNotNull);
      expect(retrieved!.campaignId, 'camp_cache_test');
      expect(retrieved.title, 'Cached Promotion');
      expect(cache.isCacheFresh('app_01'), isTrue);
    });

    test('should return null for non-existent app cache', () {
      final missing = cache.getCachedPayload('unknown_app');
      expect(missing, isNull);
      expect(cache.isCacheFresh('unknown_app'), isFalse);
    });

    test('should track impression frequency and enforce limits within window', () async {
      const campaignId = 'camp_freq_test';

      expect(cache.isFrequencyCapped(campaignId, 3, 24), isFalse);

      await cache.recordImpression(campaignId);
      expect(cache.isFrequencyCapped(campaignId, 3, 24), isFalse);

      await cache.recordImpression(campaignId);
      expect(cache.isFrequencyCapped(campaignId, 3, 24), isFalse);

      await cache.recordImpression(campaignId);
      // 3rd impression reached the limit
      expect(cache.isFrequencyCapped(campaignId, 3, 24), isTrue);
    });

    test('clearAll should reset all cached data', () async {
      final payload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_to_clear',
        title: 'Clear Me',
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      await cache.setCachedPayload('app_01', payload);
      await cache.recordImpression('camp_to_clear');

      await cache.clearAll();

      expect(cache.getCachedPayload('app_01'), isNull);
      expect(cache.isFrequencyCapped('camp_to_clear', 1, 24), isFalse);
    });
  });
}
