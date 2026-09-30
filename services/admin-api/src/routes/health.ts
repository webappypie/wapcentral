import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter: Router = Router();

const startTime = Date.now();

healthRouter.get(['/', '/health', '/v1/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-api',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: config.environment,
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
