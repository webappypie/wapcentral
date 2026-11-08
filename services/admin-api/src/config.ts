export const config = {
  port: Number(process.env['PORT']) || 3001,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  environment: (process.env['ENVIRONMENT'] || 'development') as
    'development' | 'staging' | 'production',
  firebaseProjectId:
    process.env['FIREBASE_PROJECT_ID'] || process.env['GOOGLE_CLOUD_PROJECT'] || 'wapcentral-dev',
  corsOrigins: process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',').map((s) => s.trim())
    : process.env['CORS_ORIGIN']
      ? process.env['CORS_ORIGIN'].split(',').map((s) => s.trim())
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://wapcentral.webappypie.com',
          'https://wapcentral-prod.web.app',
          'https://central.webappypie.com',
        ],
  isTest: process.env['NODE_ENV'] === 'test' || !!process.env['VITEST'],
};

export const ALLOWED_SECRET_NAMES = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'SELF_HOSTED_AI_CREDENTIALS',
  'ADMOB_REPORTING_CREDENTIALS',
  'META_AAN_CREDENTIALS',
  'APPLOVIN_API_KEY',
  'PROMOTION_SIGNING_SECRET',
  'WEBHOOK_SECRETS',
  'WEATHER_API_KEY',
] as const;

export type AllowedSecretName = (typeof ALLOWED_SECRET_NAMES)[number];

export function isAllowedSecretName(name: string): boolean {
  return (
    (ALLOWED_SECRET_NAMES as readonly string[]).includes(name) ||
    /^WEATHER_API_KEY_[A-Z0-9_]+$/.test(name) ||
    /^FCM_(CREDENTIALS|SERVICE_ACCOUNT)_[A-Z0-9_]+$/.test(name) ||
    /^FIREBASE_SERVICE_ACCOUNT_[A-Z0-9_]+$/.test(name)
  );
}
