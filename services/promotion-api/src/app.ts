import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { promotionRouter } from './routes/promotion.js';
import { analyticsRouter } from './routes/analytics.js';

export function createApp(): Express {
  const app: Express = express();

  // Basic security and parsing middlewares
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  // Security response headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Mount API routes
  app.use('/health', healthRouter);
  app.use('/v1/health', healthRouter);
  app.use('/v1/promotion', promotionRouter);
  app.use('/v1/analytics', analyticsRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found on promotion-api.`,
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
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
