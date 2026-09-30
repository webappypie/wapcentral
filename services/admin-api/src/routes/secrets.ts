import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { writeSecret, getSecretStatusList, deleteSecret } from '../services/secretVault.js';

export const secretsRouter: Router = Router();

// GET /v1/secrets/status - List all credentials with configured status (Admin+)
secretsRouter.get(
  '/status',
  requireRole('admin'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const list = await getSecretStatusList();
      res.json({
        success: true,
        data: list,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve secret status list';
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /v1/secrets/:name - Write or rotate secret (Write-Only, Admin+)
secretsRouter.post(
  '/:name',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const secretName = String(req.params['name'] || '');
      const { value } = req.body || {};

      if (!value || typeof value !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: "Field 'value' is required and must be a non-empty string.",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await writeSecret(secretName, value, {
        uid: req.user.uid,
        email: req.user.email,
      });

      res.json({
        success: true,
        data: result,
        message: `Secret '${secretName}' rotated and stored in vault successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to store secret';
      res.status(400).json({
        success: false,
        error: { code: 'SECRET_ERROR', message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /v1/secrets/:name - Delete or purge a secret (Super Admin Only)
secretsRouter.delete(
  '/:name',
  requireRole('super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const secretName = String(req.params['name'] || '');

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await deleteSecret(secretName, {
        uid: req.user.uid,
        email: req.user.email,
      });

      res.json({
        success: true,
        data: result,
        message: `Secret '${secretName}' deleted from vault.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete secret';
      res.status(400).json({
        success: false,
        error: { code: 'SECRET_ERROR', message },
        timestamp: new Date().toISOString(),
      });
    }
  },
);
