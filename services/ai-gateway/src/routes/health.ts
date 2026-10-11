import { Router } from 'express';
import type { Request, Response } from 'express';
import { APP_VERSION } from '@wapcentral/config';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ai-gateway',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
