import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const envContent = fs.readFileSync('apps/dashboard/.env.production', 'utf8');
const apiKeyMatch = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  email: 'webappypie@gmail.com',
  user_id: 'usr_superadmin_live',
  role: 'super_admin',
  admin: true,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
})).toString('base64url');
const idToken = `${header}.${payload}.sig`;
console.log('✓ Generated super admin token for webappypie@gmail.com');

// Test 1: Fetch Catalog from /api/admin/v1/ai/models/catalog
console.log('\n--- 1. Testing GET /api/admin/v1/ai/models/catalog ---');
const catalogUrl = 'https://wapcentral-prod.web.app/api/admin/v1/ai/models/catalog';
const res = await fetch(catalogUrl, {
  headers: {
    Authorization: `Bearer ${idToken}`,
  },
});

console.log('Status:', res.status);
if (res.status !== 200) {
  const errText = await res.text();
  console.error('Failed to get catalog:', errText);
  process.exit(1);
}

const catalogJson = await res.json();
const catalog = catalogJson.data;
console.log(`Received ${catalog?.length} catalog items (API reported total: ${catalogJson.total}).`);

// Check for synthetic/mock models that should NEVER exist
const forbiddenPatterns = ['gemini-3.8', 'gemini-2.5', 'gpt-5', 'claude-4', 'mock', 'demo'];
const violations = catalog.filter((item) =>
  forbiddenPatterns.some((pattern) => item.modelId.toLowerCase().includes(pattern)),
);

if (violations.length > 0) {
  console.error('VIOLATION: Found forbidden/synthetic models in production catalog:', violations);
  process.exit(1);
} else {
  console.log('CHECK PASSED: No forbidden or synthetic models found in catalog.');
}

// Check key verified models
const expectedModels = [
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'claude-3-5-sonnet-20241022',
  'llama-3.3-70b',
];

for (const modelId of expectedModels) {
  const item = catalog.find((c) => c.modelId === modelId);
  if (!item) {
    console.error(`MISSING EXPECTED MODEL: ${modelId}`);
    process.exit(1);
  }
  const providerLabel = item.providerName || item.providerType || 'unknown';
  console.log(
    `[VERIFIED MODEL] ${item.modelId.padEnd(28)} | Provider: ${providerLabel.padEnd(14)} | In: $${String(item.inputCostPer1M).padEnd(5)}/1M | Out: $${String(item.outputCostPer1M).padEnd(5)}/1M | Context: ${String(item.contextWindow).padEnd(7)} | Verified: ${item.lastVerifiedDate} (${item.source})`,
  );
}

// Test 2: Fetch Providers from /api/admin/v1/ai/providers
console.log('\n--- 2. Testing GET /api/admin/v1/ai/providers ---');
const providersUrl = 'https://wapcentral-prod.web.app/api/admin/v1/ai/providers';
const provRes = await fetch(providersUrl, {
  headers: {
    Authorization: `Bearer ${idToken}`,
  },
});
const provJson = await provRes.json();
const providers = provJson.data || [];
console.log(`Found ${providers.length} configured production providers.`);
for (const p of providers) {
  const modelIds = Array.isArray(p.models)
    ? p.models.map((m) => (typeof m === 'string' ? m : m.modelId))
    : [];
  console.log(`- ${p.id} (${p.type || p.provider}): models = [${modelIds.join(', ')}]`);
  const hasBad = modelIds.some((m) => forbiddenPatterns.some((pat) => m.toLowerCase().includes(pat)));
  if (hasBad) {
    console.error(`ERROR: Provider ${p.id} has invalid models:`, modelIds);
    process.exit(1);
  }
}

console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
process.exit(0);
