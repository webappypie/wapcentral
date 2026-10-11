import { Router } from 'express';
import { config } from '../config.js';
import { APP_VERSION } from '@wapcentral/config';

export const healthRouter: Router = Router();

const startTime = Date.now();

healthRouter.get(['/', '/health', '/v1/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-api',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: config.environment,
    version: APP_VERSION,
    release: {
      version: APP_VERSION,
      environment: config.environment,
      commitSha: process.env['COMMIT_SHA'] || process.env['K_REVISION'] || 'prod',
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});
