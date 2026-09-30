import type { Response, NextFunction } from 'express';
import type { GatewayAuthenticatedRequest } from '../types/auth.js';
import { config } from '../config.js';

export function authenticateGateway(
  req: GatewayAuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header. Bearer token required.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  // Test / Local Development Token Handling
  if (config.isTest || config.nodeEnv !== 'production') {
    if (token.startsWith('mock-token-') || token.startsWith('test-token-')) {
      const parts = token.split('-');
      const roleOrType = parts[2] || 'app';
      req.caller = {
        uid: `uid_${roleOrType}_${Date.now()}`,
        appId: req.body?.appId || 'app_01',
        email: `${roleOrType}@webappypie.com`,
        role: roleOrType,
      };
      next();
      return;
    }
  }

  // Attempt lightweight base64 JWT payload parsing
  try {
    const segments = token.split('.');
    if (segments.length === 3 && segments[1]) {
      const payloadJson = Buffer.from(segments[1], 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        user_id?: string;
        email?: string;
        app_id?: string;
      };

      req.caller = {
        uid: payload.sub || payload.user_id || 'anonymous_user',
        email: payload.email,
        appId: payload.app_id || req.body?.appId,
      };
      next();
      return;
    }
  } catch {
    // Proceed to rejection
  }

  // If in test and token provided, accept
  if (config.isTest && token.length > 5) {
    req.caller = {
      uid: 'test_caller_id',
      appId: req.body?.appId || 'app_01',
      email: 'tester@webappypie.com',
    };
    next();
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired Firebase Auth token.',
    },
    timestamp: new Date().toISOString(),
  });
}
