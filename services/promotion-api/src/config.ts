import { PROMOTION } from '@wapcentral/config';

export const config = {
  port: parseInt(process.env['PROMOTION_API_PORT'] || process.env['PORT'] || '3003', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  corsOrigin: process.env['CORS_ORIGIN'] || '*',
  signingSecret:
    process.env['PROMOTION_SIGNING_SECRET'] ||
    'wapcentral_dev_promotion_signing_secret_998877_secure!',
  rateLimit: {
    maxRequestsPerWindow: PROMOTION.RATE_LIMIT_REQUESTS_PER_MINUTE, // 60 req/min
    windowMs: 60 * 1000, // 1 minute
    abuseThreshold: 120, // 2x normal max triggers abuse protection
    abuseCooldownMs: 5 * 60 * 1000, // 5 minutes cool-off
  },
  cache: {
    defaultTtlSeconds: PROMOTION.DEFAULT_CACHE_TTL_SECONDS, // 21600 (6 hours)
    emptyTtlSeconds: 3600, // 1 hour for empty/retry
    maxTtlSeconds: PROMOTION.MAX_CACHE_TTL_SECONDS, // 86400 (24 hours)
    minTtlSeconds: PROMOTION.MIN_CACHE_TTL_SECONDS, // 300 (5 mins)
  },
};
