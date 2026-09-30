#!/usr/bin/env node
/**
 * scripts/validate-env.js
 *
 * Validates that required environment variables are set before starting services.
 * Run this as a pre-flight check in CI or deployment scripts.
 *
 * Usage: node scripts/validate-env.js [--service admin-api|promotion-api|ai-gateway]
 */

const REQUIRED_FOR_ALL = ['NODE_ENV', 'ENVIRONMENT', 'FIREBASE_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT'];

const REQUIRED_BY_SERVICE = {
  'admin-api': ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'PROMOTION_SIGNING_SECRET'],
  'promotion-api': ['PROMOTION_SIGNING_SECRET', 'FIREBASE_PROJECT_ID'],
  'ai-gateway': ['OPENAI_API_KEY', 'GEMINI_API_KEY'],
};

const args = process.argv.slice(2);
const serviceIndex = args.indexOf('--service');
const service = serviceIndex !== -1 ? args[serviceIndex + 1] : null;

const requiredVars = [
  ...REQUIRED_FOR_ALL,
  ...(service ? (REQUIRED_BY_SERVICE[service] ?? []) : []),
];

const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables:`);
  missing.forEach((v) => console.error(`   - ${v}`));
  console.error(`\nSee .env.example for the complete list of required variables.\n`);
  process.exit(1);
}

console.log(`✅ All required environment variables are set${service ? ` for ${service}` : ''}.`);
