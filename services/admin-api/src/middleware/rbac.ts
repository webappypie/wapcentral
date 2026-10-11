import { ROLE_HIERARCHY } from '@wapcentral/config';
import type { UserRole } from '@wapcentral/types';
import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from '../types/auth.js';

export function requireRole(_requiredRole: UserRole = 'super_admin') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please provide a valid Bearer token.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "Insufficient permissions. WAPCentral requires 'super_admin' access.",
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
