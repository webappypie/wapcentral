import type { Response, NextFunction } from 'express';
import type { AppAuthenticatedRequest } from '../types/auth.js';
import { config } from '../config.js';

interface ClientWindow {
  timestamps: number[];
  blockedUntil?: number;
}

const rateLimitMap: Map<string, ClientWindow> = new Map();

/**
 * Resets rate limiter memory state (useful for tests).
 */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Sliding-window rate limiting middleware with abuse protection.
 * Tracks requests per appKey (fallback to IP).
 */
export function promotionRateLimiter(
  req: AppAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const clientIdentifier =
    req.appCaller?.appKey ||
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : null) ||
    req.ip ||
    'anonymous';

  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequestsPerWindow;
  const abuseThreshold = config.rateLimit.abuseThreshold;
  const abuseCooldownMs = config.rateLimit.abuseCooldownMs;

  let clientRecord = rateLimitMap.get(clientIdentifier);
  if (!clientRecord) {
    clientRecord = { timestamps: [] };
    rateLimitMap.set(clientIdentifier, clientRecord);
  }

  // Check if client is in abuse cooldown
  if (clientRecord.blockedUntil && clientRecord.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((clientRecord.blockedUntil - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.status(429).json({
      success: false,
      error: {
        code: 'ABUSE_DETECTED',
        message: `Abuse protection triggered. Too many requests. Cooldown active for ${retryAfterSeconds}s.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Prune timestamps older than the sliding window
  const windowStart = now - windowMs;
  clientRecord.timestamps = clientRecord.timestamps.filter((ts) => ts > windowStart);

  // Check if request count triggers abuse threshold
  if (clientRecord.timestamps.length >= abuseThreshold) {
    clientRecord.blockedUntil = now + abuseCooldownMs;
    const retryAfterSeconds = Math.ceil(abuseCooldownMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.status(429).json({
      success: false,
      error: {
        code: 'ABUSE_DETECTED',
        message: `Excessive request volume detected. Client throttled for ${retryAfterSeconds}s.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Check normal rate limit
  if (clientRecord.timestamps.length >= maxRequests) {
    const oldest = clientRecord.timestamps[0] ?? now;
    const resetTime = oldest + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit of ${maxRequests} requests per minute exceeded. Please retry in ${retryAfterSeconds}s.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Record this request
  clientRecord.timestamps.push(now);

  const remaining = Math.max(0, maxRequests - clientRecord.timestamps.length);
  const resetEpoch = Math.ceil((now + windowMs) / 1000);

  res.setHeader('X-RateLimit-Limit', String(maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetEpoch));

  next();
}
