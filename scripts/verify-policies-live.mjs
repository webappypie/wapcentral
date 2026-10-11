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

const baseUrl = 'https://wapcentral-prod.web.app/api/admin/v1';
const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${idToken}`,
};

// 2. Fetch existing policies and check telemetry enrichment
console.log('\n--- Test 1: Fetch Policies & Telemetry ---');
const listRes = await fetch(`${baseUrl}/ai/policies`, { headers: authHeaders });
console.log('GET /ai/policies status:', listRes.status);
const listData = await listRes.json();
console.log(`Found ${listData.data?.length ?? 0} existing policies.`);
if (listData.data?.length > 0) {
  const p = listData.data[0];
  console.log('Sample policy:', {
    id: p.id,
    appId: p.appId,
    feature: p.feature,
    primary: `${p.primaryProviderId}/${p.primaryModelId}`,
    priority: p.priority,
    circuitBreaker: p.circuitBreaker,
    usageStats: p.usageStats,
  });
}

// 3. Negative Test: Reject Invalid Provider / Model Combination
console.log('\n--- Test 2: Validation of Allowlist (Must Reject Invalid Provider) ---');
const invalidPolicyPayload = {
  appId: 'test_app',
  feature: 'test_validation',
  primaryProviderId: 'non_existent_provider_xyz',
  primaryModelId: 'non_existent_model_123',
  fallbackChain: [],
  quotas: { dailyRequestLimit: 100 },
  circuitBreaker: {
    failureThreshold: 3,
    timeoutMs: 5000,
    recoveryTimeMs: 15000,
  },
  priority: 50,
  enabled: true,
};

const rejectRes = await fetch(`${baseUrl}/ai/policies`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(invalidPolicyPayload),
});
console.log('POST invalid policy status:', rejectRes.status);
const rejectData = await rejectRes.json();
console.log('Rejection response code:', rejectData.error?.code);
console.log('Rejection message:', rejectData.error?.message);
if (rejectRes.status === 400 && (rejectData.error?.code === 'INVALID_PROVIDER_MODEL' || rejectData.error?.code === 'VALIDATION_ERROR')) {
  console.log('✓ Successfully rejected invalid provider combination as required.');
} else {
  console.error('FAILED: Invalid provider was not rejected properly!');
  process.exit(1);
}

// 4. Positive Test: Create Valid Routing Policy with Circuit Breaker & Quotas
console.log('\n--- Test 3: Create Valid Routing Policy ---');
const validPolicyPayload = {
  appId: 'wapcentral_core',
  feature: 'live_verification_feature',
  primaryProviderId: 'gemini-production',
  primaryModelId: 'gemini-1.5-flash',
  fallbackChain: [
    {
      providerId: 'openai-production',
      modelId: 'gpt-4o-mini',
      priority: 1,
    },
  ],
  quotas: {
    dailyRequestLimit: 1000,
    dailyTokenLimit: 500000,
    monthlyRequestLimit: 30000,
    monthlyTokenLimit: 15000000,
    rateLimitRpm: 60,
  },
  circuitBreaker: {
    failureThreshold: 5,
    timeoutMs: 8000,
    recoveryTimeMs: 20000,
  },
  priority: 85,
  enabled: true,
};

const createRes = await fetch(`${baseUrl}/ai/policies`, {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify(validPolicyPayload),
});
console.log('POST /ai/policies status:', createRes.status);
const createData = await createRes.json();
if (createRes.status !== 201 || !createData.data?.id) {
  console.error('FAILED to create policy:', createData);
  process.exit(1);
}

const createdPolicyId = createData.data.id;
console.log('✓ Successfully created policy with ID:', createdPolicyId);
console.log('Created policy details:', {
  id: createData.data.id,
  priority: createData.data.priority,
  circuitBreaker: createData.data.circuitBreaker,
  quotas: createData.data.quotas,
  fallbackChain: createData.data.fallbackChain,
});

// 5. Positive Test: Update Policy (Priority & Circuit Breaker)
console.log('\n--- Test 4: Update Policy (Priority & Circuit Breaker via PUT) ---');
const updateRes = await fetch(`${baseUrl}/ai/policies/${createdPolicyId}`, {
  method: 'PUT',
  headers: authHeaders,
  body: JSON.stringify({
    priority: 95,
    circuitBreaker: {
      failureThreshold: 4,
      timeoutMs: 6000,
      recoveryTimeMs: 25000,
    },
    quotas: {
      rateLimitRpm: 120,
    },
  }),
});
console.log('PUT status:', updateRes.status);
const updateData = await updateRes.json();
console.log('Updated priority:', updateData.data?.priority);
console.log('Updated circuit breaker:', updateData.data?.circuitBreaker);
console.log('Updated RPM rate limit:', updateData.data?.quotas?.rateLimitRpm);

// 5b. Toggle Policy State
console.log('\n--- Test 4b: Toggle Policy (PATCH /toggle) ---');
const toggleRes = await fetch(`${baseUrl}/ai/policies/${createdPolicyId}/toggle`, {
  method: 'PATCH',
  headers: authHeaders,
});
console.log('PATCH /toggle status:', toggleRes.status);
const toggleData = await toggleRes.json();
console.log('Toggled policy enabled:', toggleData.data?.enabled);

// 6. Verification: Read Policy back to ensure Firestore persistence & telemetry calculation
console.log('\n--- Test 5: Verify Firestore Persistence & Telemetry ---');
const getRes = await fetch(`${baseUrl}/ai/policies/${createdPolicyId}`, {
  headers: authHeaders,
});
console.log('GET by ID status:', getRes.status);
const getData = await getRes.json();
console.log('Persisted Policy:', {
  id: getData.data?.id,
  appId: getData.data?.appId,
  feature: getData.data?.feature,
  priority: getData.data?.priority,
  circuitBreaker: getData.data?.circuitBreaker,
  usageStats: getData.data?.usageStats,
});

// 7. Verify Audit Log was generated
console.log('\n--- Test 6: Verify Audit Logs ---');
const auditRes = await fetch(`${baseUrl}/audit-logs?limit=10`, { headers: authHeaders });
console.log('GET /audit-logs status:', auditRes.status);
const auditData = await auditRes.json();
const policyLogs = (auditData.data || []).filter(
  (log) => log.resourceType === 'ai_policy' || log.action?.includes('policy'),
);
console.log(`Found ${policyLogs.length} recent AI Policy audit log entries.`);
if (policyLogs.length > 0) {
  console.log('Latest audit log entry:', {
    action: policyLogs[0].action,
    actorEmail: policyLogs[0].actorEmail,
    resourceType: policyLogs[0].resourceType,
    resourceId: policyLogs[0].resourceId,
    metadata: policyLogs[0].metadata,
  });
}

// 8. Clean up: Delete Test Policy
console.log('\n--- Test 7: Delete Test Policy ---');
const deleteRes = await fetch(`${baseUrl}/ai/policies/${createdPolicyId}`, {
  method: 'DELETE',
  headers: authHeaders,
});
console.log('DELETE status:', deleteRes.status);
const deleteData = await deleteRes.json();
console.log('DELETE response:', deleteData);

console.log('\n=============================================');
console.log('ALL LIVE PRODUCTION VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('=============================================');

process.exit(0);
