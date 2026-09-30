import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { healthRouter } from './routes/health.js';
import { secretsRouter } from './routes/secrets.js';
import { appsRouter } from './routes/apps.js';
import { campaignsRouter } from './routes/campaigns.js';
import { flagsRouter } from './routes/flags.js';
import { auditLogsRouter } from './routes/auditLogs.js';

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
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin) || config.nodeEnv !== 'production') {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev/staging
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

  // Routes
  app.use('/health', healthRouter);
  app.use('/v1/health', healthRouter);
  app.use('/v1/secrets', secretsRouter);
  app.use('/v1/apps', appsRouter);
  app.use('/v1/campaigns', campaignsRouter);
  app.use('/v1/flags', flagsRouter);
  app.use('/v1/audit-logs', auditLogsRouter);

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
