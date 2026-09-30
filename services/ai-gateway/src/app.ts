import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { gatewayRouter } from './routes/gateway.js';

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
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin) || config.nodeEnv !== 'production') {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  // Body Parsing (allow 10mb for multimodal image uploads)
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use('/health', healthRouter);
  app.use('/v1/health', healthRouter);
  app.use('/v1/gateway', gatewayRouter);
  app.use('/v1/ai/gateway', gatewayRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint '${req.method} ${req.originalUrl}' not found on AI Gateway.`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred in AI Gateway.',
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
