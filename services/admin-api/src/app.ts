import cors from 'cors';
import express, { Router } from 'express';
import type { Express, Request, Response, NextFunction } from 'express';

import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { requireRole } from './middleware/rbac.js';
import { aiPoliciesRouter } from './routes/aiPolicies.js';
import { aiProvidersRouter, handlePlaygroundInference } from './routes/aiProviders.js';
import { appsRouter } from './routes/apps.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { campaignsRouter } from './routes/campaigns.js';
import { flagsRouter } from './routes/flags.js';
import { healthRouter } from './routes/health.js';
import { infrastructureRouter } from './routes/infrastructure.js';
import { secretsRouter } from './routes/secrets.js';
import { analyticsRouter } from './routes/analytics.js';
import { adsRouter } from './routes/ads.js';
import { notificationsRouter } from './routes/notifications.js';
import { platformRouter } from './platform/routes/index.js';
import type { AuthenticatedRequest } from './types/auth.js';

export function createApp(): Express {
  const app = express();

  // Basic Security & Headers
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }
        if (config.corsOrigins.includes(origin) || config.nodeEnv !== 'production') {
          callback(null, true);
          return;
        }
        callback(null, true); // Permissive in dev/staging
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  // Body Parsing
  app.use(express.json({ limit: '1mb' }));

  // Global Authentication Middleware
  app.use(authenticate);

  const aiPlaygroundRouter = Router();
  aiPlaygroundRouter.post(
    '/infer',
    requireRole('super_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      await handlePlaygroundInference(req, res);
    },
  );
  aiPlaygroundRouter.post(
    '/',
    requireRole('super_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      await handlePlaygroundInference(req, res);
    },
  );

  // Routes - Support direct calls (/v1/...) and Firebase Hosting proxied calls (/api/admin/v1/...)
  const mountRoutes = (prefix: string) => {
    app.use(`${prefix}/health`, healthRouter);
    app.use(`${prefix}/v1/health`, healthRouter);
    app.use(`${prefix}/v1/secrets`, secretsRouter);
    app.use(`${prefix}/v1/apps`, appsRouter);
    app.use(`${prefix}/v1/campaigns`, campaignsRouter);
    app.use(`${prefix}/v1/flags`, flagsRouter);
    app.use(`${prefix}/v1/audit-logs`, auditLogsRouter);
    app.use(`${prefix}/v1/infrastructure`, infrastructureRouter);
    app.use(`${prefix}/v1/ai/providers`, aiProvidersRouter);
    app.use(`${prefix}/v1/ai/models`, aiProvidersRouter);
    app.use(`${prefix}/v1/ai/policies`, aiPoliciesRouter);
    app.use(`${prefix}/v1/ai/playground`, aiPlaygroundRouter);
    app.use(`${prefix}/v1/analytics`, analyticsRouter);
    app.use(`${prefix}/v1/ads`, adsRouter);
    app.use(`${prefix}/v1/notifications`, notificationsRouter);
    app.use(`${prefix}/v1/platform`, platformRouter);
  };

  mountRoutes('');
  mountRoutes('/api/admin');

  // Platform Services API Gateway direct mounts
  app.use('/api/platform/v1', platformRouter);
  app.use('/api/platform', platformRouter);
  app.use('/v1/platform', platformRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint '${req.method} ${req.originalUrl}' does not exist.`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Global Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          config.nodeEnv === 'production' ? 'An unexpected internal error occurred.' : message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export const app: Express = createApp();
