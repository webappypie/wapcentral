import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() {
  const secret = 'test_secret_sponsor';
  final testConfig = PromoConfig(
    appId: 'app_sponsor_01',
    appKey: 'wap_key_sponsor_test',
    baseUrl: 'https://promotion-api.webappypie.com',
    signingSecret: secret,
  );

  group('WapSponsoredPlacement Widget', () {
    late PromoCache cache;

    setUp(() {
      WapPromoSdk.reset();
      cache = PromoCache(null);
    });

    tearDown(() {
      WapPromoSdk.reset();
    });

    testWidgets('renders SizedBox.shrink when SDK is not ready', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapSponsoredPlacement(),
          ),
        ),
      );

      expect(find.byType(WapSponsoredPlacement), findsOneWidget);
      expect(find.text('SPONSORED'), findsNothing);
      expect(find.byType(InkWell), findsNothing);
    });

    testWidgets('renders SizedBox.shrink when promo has no content or is expired',
        (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));
      await WapPromoSdk.init(testConfig, cache: cache, client: mockClient);

      // Null promo
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapSponsoredPlacement(),
          ),
        ),
      );
      expect(find.text('SPONSORED'), findsNothing);

      // Expired promo
      final expiredPromo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_exp',
        title: 'Expired Promo',
        expiresAt: DateTime.now().subtract(const Duration(hours: 1)),
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );
      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = expiredPromo;
      await tester.pump();

      expect(find.text('Expired Promo'), findsNothing);
      expect(find.text('SPONSORED'), findsNothing);
    });

    testWidgets('renders compact sponsored native layout with max 120dp height and custom sponsorLabel',
        (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));
      await WapPromoSdk.init(testConfig, cache: cache, client: mockClient);

      final promo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_sponsored_active',
        title: 'Cloud Storage Pro',
        description: 'Get 100GB cloud storage securely for life',
        ctaText: 'Claim',
        storeUrl: 'https://storage.webappypie.com/promo',
        sponsorLabel: 'Sponsored by WebAppyPie',
        layoutVariant: PromoLayoutVariant.sponsored,
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = promo;

      String? tappedUrl;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: WapSponsoredPlacement(
                onDestinationTap: (url) {
                  tappedUrl = url;
                },
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      // Check sponsored label
      expect(find.text('SPONSORED BY WEBAPPYPIE'), findsOneWidget);
      expect(find.text('Cloud Storage Pro'), findsOneWidget);
      expect(find.text('Get 100GB cloud storage securely for life'), findsOneWidget);
      expect(find.text('Claim'), findsOneWidget);

      // Verify height constraints (must not exceed 120 dp)
      final boxFinder = find.byWidgetPredicate(
        (widget) =>
            widget is ConstrainedBox &&
            widget.constraints.maxHeight <= 120.0,
      );
      expect(boxFinder, findsWidgets);

      final renderBox = tester.renderObject<RenderBox>(find.byType(WapSponsoredPlacement));
      expect(renderBox.size.height, lessThanOrEqualTo(120.0));

      // Test tap dispatches destination
      await tester.tap(find.text('Claim'));
      await tester.pump();

      expect(tappedUrl, 'https://storage.webappypie.com/promo');
    });

    testWidgets('defaults to SPONSORED when sponsorLabel is null or empty',
        (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));
      await WapPromoSdk.init(testConfig, cache: cache, client: mockClient);

      final promo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_default_label',
        title: 'Music Studio App',
        description: 'Create beats anywhere',
        ctaText: 'Install',
        storeUrl: 'https://beats.webappypie.com',
        layoutVariant: PromoLayoutVariant.sponsored,
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = promo;

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapSponsoredPlacement(),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('SPONSORED'), findsOneWidget);
      expect(find.text('Music Studio App'), findsOneWidget);
      expect(find.text('Install'), findsOneWidget);
    });
  });
}
