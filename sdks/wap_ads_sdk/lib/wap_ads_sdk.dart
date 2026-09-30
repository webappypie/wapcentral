/// wap_ads_sdk
///
/// WebAppyPie Ads SDK for Flutter.
/// STUB — Full implementation in Phase 9.
///
/// Provides a unified interface for:
/// - Google AdMob (banner, interstitial, rewarded, native)
/// - Meta Audience Network (banner, interstitial, rewarded)
/// - AppLovin MAX (mediation over AdMob + Meta + others)
/// - WAPAds integration hook (delegates to wap_promo_sdk for house ads)
///
/// Design Principles:
/// 1. Fully decoupled from wap_promo_sdk — no tight coupling
/// 2. Configuration delivered from WAPCentral (ad unit IDs per app)
/// 3. Mediation handled by AppLovin MAX (manages AdMob + Meta internally)
/// 4. WAPAds hook allows injecting house-ad slots via wap_promo_sdk
/// 5. Platform-agnostic config contract (same backend for future native SDKs)
///
/// TODO (Phase 9): Implement:
/// - AdConfig (reads ad unit IDs from Firestore via promotion-api or dedicated endpoint)
/// - AdMobAdapter
/// - MetaAdapter
/// - AppLovinMaxAdapter (primary mediation layer)
/// - WapAdsAdapter (delegates to wap_promo_sdk)
/// - UnifiedAdController (selects adapter based on config)

library wap_ads_sdk;

// Phase 9 TODO: export all public API symbols here
