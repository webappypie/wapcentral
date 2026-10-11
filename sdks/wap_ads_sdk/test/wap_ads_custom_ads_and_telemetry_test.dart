import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:wap_ads_sdk/wap_ads.dart';
import 'package:wap_ads_sdk/src/core/wap_ads_core.dart';
import 'package:wap_ads_sdk/src/custom_ads/custom_ad_tracker.dart';

class MockTrackingHttpClient extends http.BaseClient {
  final List<http.Request> recordedRequests = [];

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final req = request as http.Request;
    recordedRequests.add(req);
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode({'success': true}))),
      200,
    );
  }
}

void main() {
  setUp(() {
    WapAdsCore.instance.reset();
  });

  tearDown(() {
    WapAdsCore.instance.reset();
  });

  group('Custom Ads & Telemetry Hooks', () {
    testWidgets('1. CustomAdWidget tracks impression on mount and click on tap', (tester) async {
      final mockHttp = MockTrackingHttpClient();
      final tracker = CustomAdTracker(
        options: const WapAdsOptions(
          appId: 'filezen',
          appKey: 'wap_key_filezen_prod',
          baseUrl: 'https://test.wapcentral.com',
        ),
        client: mockHttp,
      );

      const fallback = CustomAdFallback(
        campaignId: 'optilens_promo_01',
        title: 'OptiLens AI',
        description: 'Smart Photo Enhancer',
        ctaText: 'Get Now',
        destinationUrl: 'https://optilens.app',
      );

      bool clicked = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomAdWidget(
              fallbackData: fallback,
              placementKey: 'test_banner',
              tracker: tracker,
              onClicked: () => clicked = true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Impression should have been sent to /api/platform/v1/ads/custom/track
      expect(mockHttp.recordedRequests.length, 1);
      final impReq = mockHttp.recordedRequests.first;
      expect(impReq.url.path, '/api/platform/v1/ads/custom/track');
      expect(impReq.headers['x-app-id'], 'filezen');

      final impBody = jsonDecode(impReq.body) as Map<String, dynamic>;
      expect(impBody['appId'], 'filezen');
      expect(impBody['campaignId'], 'optilens_promo_01');
      expect(impBody['type'], 'impression');

      // Tap on promo CTA
      await tester.tap(find.text('Get Now'));
      await tester.pumpAndSettle();

      expect(clicked, isTrue);
      expect(mockHttp.recordedRequests.length, 2);
      final clickReq = mockHttp.recordedRequests.last;
      final clickBody = jsonDecode(clickReq.body) as Map<String, dynamic>;
      expect(clickBody['type'], 'click');
      expect(clickBody['campaignId'], 'optilens_promo_01');
    });

    test('2. Dispatches telemetry events safely without sensitive user data', () async {
      final List<AdEvent> receivedEvents = [];
      final listener = (AdEvent event) {
        receivedEvents.add(event);
      };

      AdTelemetryDispatcher.addListener(listener);

      // Dispatch a lifecycle event
      AdTelemetryDispatcher.dispatch(
        AdEvent(
          type: AdEventType.loaded,
          appId: 'filezen',
          format: AdFormat.banner,
          provider: 'admob',
          placementKey: 'header_banner',
          requestId: 'req_12345',
        ),
      );

      expect(receivedEvents.length, 1);
      final event = receivedEvents.first;
      expect(event.type, AdEventType.loaded);
      expect(event.appId, 'filezen');
      expect(event.format, AdFormat.banner);
      expect(event.provider, 'admob');
      expect(event.requestId, 'req_12345');

      // Verify JSON serialization contains no PII
      final json = event.toJson();
      final jsonStr = jsonEncode(json).toLowerCase();
      expect(jsonStr.contains('email'), isFalse);
      expect(jsonStr.contains('password'), isFalse);
      expect(jsonStr.contains('secret'), isFalse);

      AdTelemetryDispatcher.removeListener(listener);
    });
  });
}
