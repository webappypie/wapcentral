import { Router } from 'express';
import type { Request, Response } from 'express';
import { APP_VERSION } from '@wapcentral/config';

export const healthRouter: Router = Router();

const healthHandler = (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    service: 'promotion-api',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  });
};

healthRouter.get('/', healthHandler);
healthRouter.get('/health', healthHandler);
healthRouter.get('/v1/health', healthHandler);
