import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../cache/promo_cache.dart';
import '../models/promo_config.dart';
import '../models/promo_payload.dart';
import '../utils/crypto_validator.dart';

/// Central promotion delivery and lifecycle service.
/// Guarantees non-blocking, cache-first operation with graceful degradation.
class PromoService {
  final PromoConfig config;
  final PromoCache cache;
  final http.Client _client;

  /// Reactive notifier alerting UI components whenever a fresh campaign is resolved.
  final ValueNotifier<PromoPayload?> promoNotifier = ValueNotifier<PromoPayload?>(null);

  bool _isRefreshing = false;

  PromoService({
    required this.config,
    required this.cache,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Reads cached payload immediately for zero-latency startup and schedules a background refresh.
  void initFromCache() {
    final cached = cache.getCachedPayload(config.appId);
    if (cached != null && cached.hasContent && !isFrequencyCapped(cached)) {
      promoNotifier.value = cached;
      _log('Loaded promo from local cache: ${cached.campaignId}');
    }

    // Always refresh in the background without blocking the UI
    scheduleBackgroundRefresh();
  }

  /// Triggers a non-blocking background refresh.
  void scheduleBackgroundRefresh() {
    if (_isRefreshing) return;
    unawaited(fetchCampaign(forceRefresh: true).catchError((_) => null));
  }

  /// Fetches the latest campaign for this application.
  /// If [forceRefresh] is false and the cache is fresh, returns the cached payload.
  Future<PromoPayload?> fetchCampaign({bool forceRefresh = false}) async {
    if (!forceRefresh && cache.isCacheFresh(config.appId)) {
      final cached = cache.getCachedPayload(config.appId);
      if (cached != null) {
        if (!isFrequencyCapped(cached)) {
          promoNotifier.value = cached;
        }
        return cached;
      }
    }

    _isRefreshing = true;

    try {
      final queryParams = {
        'appId': config.appId,
        'version': config.appVersion,
        'env': config.environment,
        'platform': config.platform,
      };

      final uri = Uri.parse('${config.cleanBaseUrl}/v1/promotion')
          .replace(queryParameters: queryParams);

      _log('Fetching promo from $uri');

      final response = await _client.get(
        uri,
        headers: {
          'X-App-Key': config.appKey,
          'Accept': 'application/json',
        },
      ).timeout(config.networkTimeout);

      if (response.statusCode == 200) {
        final Map<String, dynamic> jsonMap =
            jsonDecode(response.body) as Map<String, dynamic>;

        // 1. Verify HMAC signature before trusting the payload
        final isValidSignature = CryptoValidator.verifySignature(
          jsonMap,
          config.signingSecret,
        );

        if (!isValidSignature) {
          _log('HMAC verification FAILED. Untrusted response ignored.');
          // Retain cached payload if available
          return cache.getCachedPayload(config.appId);
        }

        // 2. Parse payload
        final payload = PromoPayload.fromJson(jsonMap);

        // 3. Persist to cache
        await cache.setCachedPayload(config.appId, payload);

        // 4. Update UI notifier if not frequency-capped
        if (!isFrequencyCapped(payload)) {
          promoNotifier.value = payload;
        } else {
          promoNotifier.value = null;
        }

        _log('Successfully fetched and cached promo: ${payload.campaignId}');
        return payload;
      } else {
        _log('Server responded with HTTP ${response.statusCode}');
        return cache.getCachedPayload(config.appId);
      }
    } catch (e) {
      _log('Network failure during promo fetch: $e');
      // On network failure: use local cache or safe empty default
      final cached = cache.getCachedPayload(config.appId);
      return cached;
    } finally {
      _isRefreshing = false;
    }
  }

  /// Checks if a payload is currently blocked by frequency capping rules.
  bool isFrequencyCapped(PromoPayload payload) {
    if (!payload.hasContent || payload.campaignId == null) return false;
    final cap = payload.frequencyCap;
    if (cap == null) return false;

    return cache.isFrequencyCapped(
      payload.campaignId!,
      cap.maxImpressions,
      cap.periodHours,
    );
  }

  /// Records an impression locally and dispatches a fire-and-forget analytics event.
  void recordImpression(String campaignId) {
    unawaited(cache.recordImpression(campaignId));

    // Check if cap was reached after this impression
    final current = promoNotifier.value;
    if (current != null && current.campaignId == campaignId && isFrequencyCapped(current)) {
      promoNotifier.value = null; // Hide after reaching limit
    }

    _dispatchAnalytics('/v1/analytics/impression', {
      'campaignId': campaignId,
      'appId': config.appId,
    });
  }

  /// Dispatches a fire-and-forget click analytics event.
  void recordClick(String campaignId) {
    _dispatchAnalytics('/v1/analytics/click', {
      'campaignId': campaignId,
      'appId': config.appId,
    });
  }

  void _dispatchAnalytics(String endpoint, Map<String, dynamic> body) {
    unawaited(
      _client
          .post(
            Uri.parse('${config.cleanBaseUrl}$endpoint'),
            headers: {
              'X-App-Key': config.appKey,
              'Content-Type': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 3))
          .catchError((_) => http.Response('{}', 500)),
    );
  }

  void _log(String message) {
    if (config.enableLogging) {
      // ignore: avoid_print
      print('[WapPromoSdk] $message');
    }
  }

  void dispose() {
    _client.close();
    promoNotifier.dispose();
  }
}
