export const config = {
  port: Number(process.env['PORT']) || 3002,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  environment: (process.env['ENVIRONMENT'] || 'development') as
    'development' | 'staging' | 'production',
  firebaseProjectId:
    process.env['FIREBASE_PROJECT_ID'] || process.env['GOOGLE_CLOUD_PROJECT'] || 'wapcentral-dev',
  corsOrigins: process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',')
    : ['http://localhost:3000', 'http://localhost:5173'],
  isTest: process.env['NODE_ENV'] === 'test' || !!process.env['VITEST'],
  defaultTimeoutMs: Number(process.env['DEFAULT_TIMEOUT_MS']) || 30000,
  maxRetries: 2,
};
