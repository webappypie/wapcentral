import 'package:flutter_test/flutter_test.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() {
  group('PromoPayload Model', () {
    test('should serialize and deserialize complete campaign payload', () {
      final now = DateTime.now().add(const Duration(days: 2));
      final payload = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_notes',
        title: 'Unlock Pro Calculator',
        description: 'Upgrade your calculation workflow',
        ctaText: 'Get 50% Off',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.calc',
        imageUrl: 'https://storage.googleapis.com/wapcentral/banner.png',
        layoutVariant: PromoLayoutVariant.banner,
        expiresAt: now,
        cacheTtlSeconds: 21600,
        signature: 'mock_sig_123',
        frequencyCap: const PromoFrequencyCap(maxImpressions: 5, periodHours: 24),
      );

      final jsonStr = payload.toJsonString();
      expect(jsonStr, isNotEmpty);

      final parsed = PromoPayload.fromJsonString(jsonStr);
      expect(parsed, isNotNull);
      expect(parsed!.schemaVersion, 1);
      expect(parsed.enabled, isTrue);
      expect(parsed.campaignId, 'camp_notes');
      expect(parsed.title, 'Unlock Pro Calculator');
      expect(parsed.layoutVariant, PromoLayoutVariant.banner);
      expect(parsed.frequencyCap?.maxImpressions, 5);
      expect(parsed.hasContent, isTrue);
      expect(parsed.isExpired(), isFalse);
    });

    test('should identify expired campaign as not having usable content', () {
      final past = DateTime.now().subtract(const Duration(days: 1));
      final expired = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_old',
        title: 'Old Promo',
        expiresAt: past,
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      expect(expired.isExpired(), isTrue);
      expect(expired.hasContent, isFalse);
    });

    test('empty payload should have enabled: false and hasContent: false', () {
      final empty = PromoPayload.empty();
      expect(empty.enabled, isFalse);
      expect(empty.hasContent, isFalse);
      expect(empty.cacheTtlSeconds, 3600);
    });
  });
}
