import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { getAuditLogs } from '../services/auditService.js';

export const auditLogsRouter: Router = Router();

// GET /v1/audit-logs - Read immutable administrative audit trail (Admin+)
auditLogsRouter.get('/', requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const limitParam = Number(req.query['limit']) || 50;
  const logs = getAuditLogs(limitParam);

  res.json({
    success: true,
    data: logs,
    total: logs.length,
    timestamp: new Date().toISOString(),
  });
});
