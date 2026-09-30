/**
 * promotion-api — WAPCentral Campaign Delivery Service
 *
 * STUB — Implementation in Phase 7.
 *
 * Responsibilities:
 * - Serve active campaigns to mobile apps (GET /v1/promotion)
 * - App-key authentication (light auth — identifies app, not a secret)
 * - Rate limiting (60 req/min per app-key, abuse protection)
 * - HMAC-SHA256 payload signing (PROMOTION_SIGNING_SECRET from Secret Manager)
 * - Campaign selection (active, priority-ordered, targeting rules)
 * - Cache-Control headers (cacheTtlSeconds from campaign config)
 * - Analytics ingestion (impression / click events)
 * - Health check endpoint (GET /v1/health)
 *
 * Security:
 * - App keys are identifiers, not secrets — do not use for sensitive operations
 * - All private operations remain server-side
 * - Signing secret never exposed in responses
 * - Rate limit exceeded returns 429 with Retry-After header
 *
 * Platform-agnostic API Contract:
 * - Same endpoint consumed by Flutter (wap_promo_sdk) and future native SDKs
 * - Response schema versioned (schemaVersion field)
 *
 * Runtime: Cloud Run (Node.js)
 */

// Stub implementation � see above TODO comments

export {};
