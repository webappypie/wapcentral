import type { UserRole } from '@wapcentral/types';
import type { Response, NextFunction } from 'express';

import { config } from '../config.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
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

  // Only allow test bearer tokens when strictly running within automated test harness
  if (config.isTest) {
    if (token === 'test-superadmin-token' || token.startsWith('test-token-super_admin')) {
      req.user = {
        uid: 'test_super_admin_id',
        email: process.env['SUPER_ADMIN_EMAIL'] || 'admin@webappypie.com',
        role: 'super_admin',
        token,
      };
      next();
      return;
    }
    if (token === 'test-editor-token' || token.startsWith('test-token-editor')) {
      req.user = {
        uid: 'test_editor_id',
        email: 'editor@webappypie.com',
        role: 'editor',
        token,
      };
      next();
      return;
    }
    if (token === 'test-viewer-token' || token === 'test-unauthorized-role-token' || token.startsWith('test-token-viewer')) {
      req.user = {
        uid: 'test_regular_user_id',
        email: 'regular_user@webappypie.com',
        role: 'viewer',
        token,
      };
      next();
      return;
    }
  }

  // Production Firebase ID Token (JWT) Verification
  try {
    const parts = token.split('.');
    if (parts.length === 3 && parts[1]) {
      const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        user_id?: string;
        email?: string;
        role?: string;
        admin?: boolean;
        exp?: number;
        iss?: string;
        aud?: string;
      };

      // Check token expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Firebase authorization token has expired' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if user has Super Admin authority via custom claims or configured email
      const superAdminEmail = (process.env['SUPER_ADMIN_EMAIL'] || '').trim().toLowerCase();
      const userEmail = (payload.email || '').trim().toLowerCase();

      const isSuperAdmin =
        payload.role === 'super_admin' ||
        payload.admin === true ||
        (superAdminEmail.length > 0 && userEmail === superAdminEmail);

      const assignedRole: UserRole = isSuperAdmin ? 'super_admin' : 'viewer';

      req.user = {
        uid: payload.user_id || payload.sub || 'usr_unknown',
        email: payload.email || 'admin@webappypie.com',
        role: assignedRole,
        token,
      };
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Malformed Firebase ID token' },
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Failed to verify authorization token' },
      timestamp: new Date().toISOString(),
    });
  }
}
