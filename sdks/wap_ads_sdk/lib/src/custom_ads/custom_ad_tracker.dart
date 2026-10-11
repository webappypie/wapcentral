import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/wap_ads_options.dart';
import '../models/ad_format.dart';
import '../telemetry/ad_telemetry.dart';

/// Client for reporting WebAppyPie custom ad impressions and clicks to WAPCentral.
class CustomAdTracker {
  final WapAdsOptions options;
  final http.Client _client;

  CustomAdTracker({
    required this.options,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Records an impression or click event for an in-house custom campaign.
  Future<bool> track({
    required String campaignId,
    required String type, // 'impression' | 'click'
    String? placementKey,
    AdFormat? format,
  }) async {
    final requestId = 'req_${DateTime.now().millisecondsSinceEpoch}';
    final uri = Uri.parse('${options.baseUrl}/api/platform/v1/ads/custom/track');

    AdTelemetryDispatcher.dispatch(
      AdEvent(
        type: type == 'impression' ? AdEventType.displayed : AdEventType.clicked,
        appId: options.appId,
        format: format,
        provider: 'custom_ads',
        placementKey: placementKey,
        campaignId: campaignId,
        requestId: requestId,
      ),
    );

    try {
      final response = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Id': options.appId,
          'X-App-Key': options.appKey,
        },
        body: jsonEncode({
          'appId': options.appId,
          'campaignId': campaignId,
          'type': type,
          if (placementKey != null) 'placementKey': placementKey,
          if (format != null) 'format': format.apiValue,
        }),
      ).timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      // Tracking failures are non-blocking to user experience
      return false;
    }
  }

  void dispose() {
    _client.close();
  }
}
