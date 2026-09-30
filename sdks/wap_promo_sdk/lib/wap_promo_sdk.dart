/// WebAppyPie Promotion SDK for Flutter (wap_promo_sdk)
///
/// Design Guarantees:
/// 1. Zero-latency boot: loads cached promotion state immediately on startup.
/// 2. Never blocks app launch: all network fetches run in background.
/// 3. Graceful degradation: cache -> safe default -> hide widget (never throw).
/// 4. Cryptographic integrity: validates HMAC-SHA256 signatures before applying payloads.
/// 5. Frequency capping: protects user experience by limiting impressions per device.
/// 6. Fire-and-forget telemetry: logs impressions and clicks asynchronously.
library wap_promo_sdk;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'src/cache/promo_cache.dart';
import 'src/models/promo_config.dart';
import 'src/models/promo_payload.dart';
import 'src/service/promo_service.dart';

export 'src/models/promo_config.dart';
export 'src/models/promo_payload.dart';
export 'src/cache/promo_cache.dart';
export 'src/service/promo_service.dart';
export 'src/utils/crypto_validator.dart';
export 'src/widgets/promo_banner.dart';
export 'src/widgets/promo_interstitial.dart';
export 'src/widgets/promo_native.dart';
export 'src/widgets/promo_builder.dart';

/// Main SDK Facade for WebAppyPie Promotion System.
class WapPromoSdk {
  static PromoService? _service;

  /// Initializes the promotion SDK.
  ///
  /// **Non-blocking:** Reads cached campaign state immediately so widgets
  /// can render without waiting for the network, then schedules an asynchronous
  /// background refresh.
  static Future<void> init(
    PromoConfig config, {
    PromoCache? cache,
    http.Client? client,
  }) async {
    final promoCache = cache ?? await PromoCache.create();
    final promoService = PromoService(
      config: config,
      cache: promoCache,
      client: client,
    );

    _service = promoService;

    // Load from cache immediately and launch non-blocking background refresh
    promoService.initFromCache();
  }

  /// Whether the SDK has been initialized.
  static bool get isReady => _service != null;

  /// Reactive notifier containing the currently active promotional campaign.
  static ValueListenable<PromoPayload?> get promoNotifier {
    if (_service == null) {
      throw StateError('WapPromoSdk has not been initialized. Call WapPromoSdk.init() first.');
    }
    return _service!.promoNotifier;
  }

  /// Synchronously returns the currently cached and validated promotional campaign.
  static PromoPayload? getCurrentPromo() => _service?.promoNotifier.value;

  /// Manually triggers a background refresh of promotional campaigns.
  static Future<void> refresh() async {
    await _service?.fetchCampaign(forceRefresh: true);
  }

  /// Records an impression event and dispatches telemetry to the backend.
  static void recordImpression(String campaignId) {
    _service?.recordImpression(campaignId);
  }

  /// Records a click event and dispatches telemetry to the backend.
  static void recordClick(String campaignId) {
    _service?.recordClick(campaignId);
  }

  /// Resets SDK state (primarily for test teardown).
  @visibleForTesting
  static void reset() {
    _service?.dispose();
    _service = null;
  }
}
