/// wap_promo_sdk
///
/// WebAppyPie Promotion SDK for Flutter.
/// STUB — Full implementation in Phase 8.
///
/// Design Principles:
/// 1. NEVER block app startup — always return immediately from cache
/// 2. Refresh in background — no startup await on network call
/// 3. Graceful degradation — cache → empty/default → hide (never crash)
/// 4. HMAC validation — validate server signature before applying any payload
/// 5. Frequency capping — respect per-device impression limits
/// 6. Analytics — fire-and-forget impression/click events
/// 7. Platform-agnostic API contract — same backend contract for future native SDKs
///
/// Usage:
/// ```dart
/// // Initialize once at app startup (non-blocking)
/// await WapPromoSdk.init(
///   appKey: 'your-app-key',
///   baseUrl: 'https://promotion-api.webappypie.com',
/// );
///
/// // Show promotion in UI
/// WapPromoBanner(
///   onInstall: () { /* handle CTA */ },
/// )
/// ```
///
/// TODO (Phase 8): Implement:
/// - PromoConfig (configuration model)
/// - PromoCache (SharedPreferences persistence)
/// - PromoService (HTTP client, background refresh, HMAC validation)
/// - PromoWidget / WapPromoBanner (banner, interstitial, native variants)
/// - FrequencyCapManager
/// - AnalyticsDispatcher (fire-and-forget impression/click)

library wap_promo_sdk;

// Phase 8 TODO: export all public API symbols here
