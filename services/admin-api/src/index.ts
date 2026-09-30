import { app } from './app.js';
import { config } from './config.js';

export * from './config.js';
export * from './app.js';
export * from './types/auth.js';
export * from './middleware/auth.js';
export * from './middleware/rbac.js';
export * from './services/secretVault.js';
export * from './services/auditService.js';

// Only start listening when not running inside a test runner
if (process.env['NODE_ENV'] !== 'test' && !process.env['VITEST']) {
  app.listen(config.port, () => {
    console.log(`[admin-api] Server running on port ${config.port} (${config.environment})`);
  });
}
