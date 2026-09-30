import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import type { UserRole } from '@wapcentral/types';
import { ROLE_HIERARCHY } from '@wapcentral/config';

export function requireRole(requiredRole: UserRole) {
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

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 99;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Operation requires '${requiredRole}' role or higher. Current role: '${req.user.role}'.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
