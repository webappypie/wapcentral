import { Router } from 'express';
import type { Request, Response } from 'express';

export const healthRouter: Router = Router();

const healthHandler = (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    service: 'promotion-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
};

healthRouter.get('/', healthHandler);
healthRouter.get('/health', healthHandler);
healthRouter.get('/v1/health', healthHandler);
