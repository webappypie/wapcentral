import { Router } from 'express';
import type { Request, Response } from 'express';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ai-gateway',
    version: '0.6.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
