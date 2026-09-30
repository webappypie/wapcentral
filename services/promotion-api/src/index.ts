import { createApp } from './app.js';
import { config } from './config.js';

export * from './config.js';
export * from './app.js';
export * from './utils/crypto.js';
export * from './utils/semver.js';
export * from './services/campaignMatcher.js';
export * from './services/analyticsService.js';
export * from './middleware/auth.js';
export * from './middleware/rateLimiter.js';

const app = createApp();

if (process.env['NODE_ENV'] !== 'test') {
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[promotion-api] Listening on port ${config.port} (env: ${config.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.log(`[promotion-api] Received ${signal}, closing server gracefully...`);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('[promotion-api] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
