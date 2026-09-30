import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AuthUser } from '../types/auth.js';
import type { UserRole } from '@wapcentral/types';
import { ROLE_HIERARCHY } from '@wapcentral/config';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided; leave req.user undefined for RBAC middleware to handle
    next();
    return;
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Development & Test Mode token support (mock tokens: mock-token-<role>)
  if (token.startsWith('mock-token-') || token.startsWith('demo-token-')) {
    const rawRole = token.replace(/^(mock|demo)-token-/, '');
    const validRole = Object.keys(ROLE_HIERARCHY).includes(rawRole)
      ? (rawRole as UserRole)
      : 'viewer';

    req.user = {
      uid: `usr_${validRole}_01`,
      email: `${validRole}@webappypie.com`,
      role: validRole,
      token,
    };
    next();
    return;
  }

  // Standard token decoding placeholder / JWT parsing
  try {
    // If a JWT token with 3 parts is provided, decode payload claims safely
    const parts = token.split('.');
    if (parts.length === 3 && parts[1]) {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      const role: UserRole =
        payload.role && Object.keys(ROLE_HIERARCHY).includes(payload.role)
          ? payload.role
          : 'viewer';

      req.user = {
        uid: payload.user_id || payload.sub || 'usr_unknown',
        email: payload.email || 'user@webappypie.com',
        role,
        token,
      };
      next();
      return;
    }

    // Default authenticated viewer user if token is non-empty string
    req.user = {
      uid: 'usr_authenticated',
      email: 'user@webappypie.com',
      role: 'viewer',
      token,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Failed to parse authorization token' },
      timestamp: new Date().toISOString(),
    });
  }
}
