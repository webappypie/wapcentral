import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:wap_promo_sdk/wap_promo_sdk.dart';

void main() {
  const secret = 'test_secret_9988';
  final testConfig = PromoConfig(
    appId: 'app_01',
    appKey: 'wap_key_test',
    baseUrl: 'https://promotion-api.webappypie.com',
    signingSecret: secret,
  );

  group('WapPromoBanner Widget', () {
    late PromoCache cache;

    setUp(() {
      WapPromoSdk.reset();
      cache = PromoCache(null);
    });

    tearDown(() {
      WapPromoSdk.reset();
    });

    testWidgets('renders SizedBox.shrink when SDK is not ready or promo is null',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapPromoBanner(),
          ),
        ),
      );

      expect(find.byType(Card), findsNothing);
      expect(find.byType(SizedBox), findsWidgets);
    });

    testWidgets('renders promotional banner when active promo exists', (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));

      await WapPromoSdk.init(
        testConfig,
        cache: cache,
        client: mockClient,
      );

      final promo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_widget_test',
        title: 'Super Math Solver',
        description: 'Solve equations with AI',
        ctaText: 'Install Now',
        storeUrl: 'https://play.google.com/store/apps/details?id=com.math',
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      // Set current promo in notifier
      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = promo;

      String? tappedUrl;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapPromoBanner(
              onCtaTap: (url) {
                tappedUrl = url;
              },
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('Super Math Solver'), findsOneWidget);
      expect(find.text('Solve equations with AI'), findsOneWidget);
      expect(find.text('Install Now'), findsOneWidget);

      // Tap the CTA button
      await tester.tap(find.text('Install Now'));
      await tester.pump();

      expect(tappedUrl, 'https://play.google.com/store/apps/details?id=com.math');
    });

    testWidgets('renders WapPromoNative card with PROMOTED badge', (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));

      await WapPromoSdk.init(
        testConfig,
        cache: cache,
        client: mockClient,
      );

      final promo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_native_test',
        title: 'Native Card Promo',
        description: 'Feed item description',
        ctaText: 'Try Free',
        storeUrl: 'https://play.google.com/store',
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = promo;

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: WapPromoNative(),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('PROMOTED'), findsOneWidget);
      expect(find.text('Native Card Promo'), findsOneWidget);
      expect(find.text('Feed item description'), findsOneWidget);
      expect(find.text('Try Free'), findsOneWidget);
    });

    testWidgets('WapPromoBuilder gives access to promo in custom builders', (tester) async {
      final mockClient = MockClient((_) async => http.Response('{}', 200));

      await WapPromoSdk.init(
        testConfig,
        cache: cache,
        client: mockClient,
      );

      final promo = PromoPayload(
        schemaVersion: 1,
        enabled: true,
        campaignId: 'camp_builder_test',
        title: 'Custom UI Title',
        cacheTtlSeconds: 3600,
        signature: 'sig',
      );

      (WapPromoSdk.promoNotifier as ValueNotifier<PromoPayload?>).value = promo;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WapPromoBuilder(
              builder: (context, p) {
                if (p == null) return const Text('NO PROMO');
                return Text('CUSTOM: ${p.title}');
              },
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.text('CUSTOM: Custom UI Title'), findsOneWidget);
    });
  });
}
