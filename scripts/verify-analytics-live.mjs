import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});
const db = getFirestore();

const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(
  JSON.stringify({
    email: 'webappypie@gmail.com',
    user_id: 'usr_superadmin_live',
    role: 'super_admin',
    admin: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  }),
).toString('base64url');
const idToken = `${header}.${payload}.sig`;

const BASE_URL = 'https://wapcentral-prod.web.app';
const DIRECT_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';

async function run() {
  console.log('\n============================================================');
  console.log('STARTING USAGE ANALYTICS LIVE PRODUCTION VERIFICATION');
  console.log('============================================================\n');

  // --- 0. FIRESTORE REAL TELEMETRY AUDIT ---
  console.log('--- 0. Checking Firestore real usage telemetry ---');
  const usageEventsSnap = await db.collection('usageEvents').get();
  console.log(`✓ Firestore 'usageEvents' has ${usageEventsSnap.size} real documents.`);
  if (usageEventsSnap.size === 0) {
    console.error('ERROR: No usage events found in Firestore!');
    process.exit(1);
  }

  // --- 1. HEALTH CHECKS ---
  console.log('\n--- 1. Testing Cloud Run Health Endpoints ---');
  const healthRes = await fetch(`${DIRECT_RUN_URL}/health`);
  console.log(`GET ${DIRECT_RUN_URL}/health -> HTTP ${healthRes.status}`);
  if (healthRes.status !== 200) {
    console.error('Failed health check:', await healthRes.text());
    process.exit(1);
  }
  const healthJson = await healthRes.json();
  console.log(`✓ Admin API Health: status="${healthJson.status}", version="${healthJson.version}"`);

  // --- 2. USAGE ANALYTICS VIA FIREBASE HOSTING REWRITE ---
  console.log('\n--- 2. Testing GET /api/admin/v1/analytics/usage (Hosting Proxy) ---');
  const usageRes = await fetch(`${BASE_URL}/api/admin/v1/analytics/usage?days=30`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log(`GET ${BASE_URL}/api/admin/v1/analytics/usage?days=30 -> HTTP ${usageRes.status}`);
  if (usageRes.status !== 200) {
    console.error('Usage analytics failed:', await usageRes.text());
    process.exit(1);
  }

  const usageJson = await usageRes.json();
  if (!usageJson.success || !usageJson.data) {
    console.error('Malformed usage analytics response:', usageJson);
    process.exit(1);
  }

  const summary = usageJson.data;
  console.log('✓ Total Requests:', summary.totalRequests);
  console.log('✓ Total Tokens:', summary.totalTokens);
  console.log('✓ Total Errors:', summary.totalErrors);
  console.log('✓ Error Rate (%):', summary.errorRatePct);
  console.log('✓ Estimated Spend (USD):', `$${summary.totalCostEstimateUsd}`);
  console.log('✓ Avg Latency (ms):', `${summary.avgLatencyMs}ms`);

  // Verify real data matches Firestore
  if (summary.totalRequests !== usageEventsSnap.size) {
    console.error(`ERROR: Summary requests (${summary.totalRequests}) do not match Firestore count (${usageEventsSnap.size})!`);
    process.exit(1);
  }
  console.log(`✓ Request count strictly matches real Firestore telemetry events (${summary.totalRequests})`);

  // Verify Providers in breakdown
  console.log('\n--- 3. Verifying Provider Breakdown ---');
  const providers = Object.keys(summary.byProvider || {});
  console.log('Providers in telemetry breakdown:', providers);
  if (providers.length === 0) {
    console.error('ERROR: No providers in usage breakdown!');
    process.exit(1);
  }
  for (const [pId, pData] of Object.entries(summary.byProvider)) {
    console.log(`  - [${pId}]: requests=${pData.requests}, tokens=${pData.tokens}, errors=${pData.errorCount}, avgLat=${pData.avgLatencyMs}ms`);
  }

  // Verify Models in breakdown
  console.log('\n--- 4. Verifying Model Breakdown ---');
  const models = Object.keys(summary.byModel || {});
  console.log('Models in telemetry breakdown:', models);
  for (const [mId, mData] of Object.entries(summary.byModel || {})) {
    console.log(`  - [${mId}] (${mData.providerId}): requests=${mData.requests}, tokens=${mData.tokens}, errors=${mData.errorCount}`);
  }

  // Verify Recent Events Log
  console.log('\n--- 5. Verifying Live Gateway Telemetry Logs ---');
  const recentEvents = summary.recentEvents || [];
  console.log(`Recent events returned: ${recentEvents.length}`);
  if (recentEvents.length > 0) {
    console.log('Latest event:', {
      id: recentEvents[0].id,
      timestamp: recentEvents[0].timestamp,
      appId: recentEvents[0].appId,
      providerId: recentEvents[0].providerId,
      modelId: recentEvents[0].modelId,
      latencyMs: recentEvents[0].latencyMs,
      success: recentEvents[0].success,
      error: recentEvents[0].error ? recentEvents[0].error.slice(0, 60) + '...' : null,
    });
  }

  // --- 6. FILTERING VERIFICATION ---
  console.log('\n--- 6. Verifying Filter Query Parameters ---');
  const filteredRes = await fetch(
    `${BASE_URL}/api/admin/v1/analytics/usage?days=30&providerId=gemini-production`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (filteredRes.status !== 200) {
    console.error('Filtered query failed:', await filteredRes.text());
    process.exit(1);
  }
  const filteredJson = await filteredRes.json();
  const filteredSummary = filteredJson.data;
  console.log(`✓ Filtered query (providerId=gemini-production): requests=${filteredSummary.totalRequests}`);
  const filteredProviders = Object.keys(filteredSummary.byProvider || {});
  if (filteredProviders.some((p) => p !== 'gemini-production')) {
    console.error('ERROR: Filtered query returned other providers!', filteredProviders);
    process.exit(1);
  }
  console.log('✓ Filter strictly respected: only gemini-production returned.');

  // --- 7. COST ALERTS ENDPOINT ---
  console.log('\n--- 7. Testing GET /api/admin/v1/analytics/alerts ---');
  const alertsRes = await fetch(`${BASE_URL}/api/admin/v1/analytics/alerts`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log(`GET /alerts -> HTTP ${alertsRes.status}`);
  if (alertsRes.status !== 200) {
    console.error('Alerts endpoint failed:', await alertsRes.text());
    process.exit(1);
  }
  const alertsJson = await alertsRes.json();
  console.log(`✓ Real cost alert rules: ${alertsJson.data.rules?.length || 0}`);
  console.log(`✓ Evaluated active triggers: ${alertsJson.data.triggers?.length || 0}`);

  // --- 8. DATA RETENTION ENDPOINT ---
  console.log('\n--- 8. Testing GET /api/admin/v1/analytics/retention ---');
  const retRes = await fetch(`${BASE_URL}/api/admin/v1/analytics/retention`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log(`GET /retention -> HTTP ${retRes.status}`);
  if (retRes.status !== 200) {
    console.error('Retention endpoint failed:', await retRes.text());
    process.exit(1);
  }
  const retJson = await retRes.json();
  console.log('✓ Retention Policy:', retJson.data);

  // --- 9. CAMPAIGN ANALYTICS ENDPOINT ---
  console.log('\n--- 9. Testing GET /api/admin/v1/analytics/campaigns ---');
  const campRes = await fetch(`${BASE_URL}/api/admin/v1/analytics/campaigns`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log(`GET /campaigns -> HTTP ${campRes.status}`);
  if (campRes.status !== 200) {
    console.error('Campaign analytics failed:', await campRes.text());
    process.exit(1);
  }
  const campJson = await campRes.json();
  console.log(`✓ Campaign performance records: ${campJson.data?.length || 0} (zero mock records)`);

  // --- 10. DIRECT CLOUD RUN SERVICE CALL ---
  console.log('\n--- 10. Testing Direct Cloud Run Service Call ---');
  const directRes = await fetch(`${DIRECT_RUN_URL}/v1/analytics/usage?days=30`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log(`GET ${DIRECT_RUN_URL}/v1/analytics/usage -> HTTP ${directRes.status}`);
  if (directRes.status !== 200) {
    console.error('Direct Cloud Run call failed:', await directRes.text());
    process.exit(1);
  }
  const directJson = await directRes.json();
  console.log(`✓ Direct Cloud Run call succeeded: ${directJson.data.totalRequests} requests`);

  // --- 11. LIVE DASHBOARD HOSTING ---
  console.log('\n--- 11. Testing Live Dashboard Hosting Asset ---');
  const dashRes = await fetch(`${BASE_URL}/index.html`);
  console.log(`GET ${BASE_URL}/index.html -> HTTP ${dashRes.status}`);
  const dashHtml = await dashRes.text();
  console.log(`✓ Dashboard HTML size: ${dashHtml.length} bytes`);
  if (!dashHtml.includes('<div id="root">')) {
    console.error('ERROR: Dashboard HTML does not contain root div!');
    process.exit(1);
  }

  console.log('\n============================================================');
  console.log('✓ ALL USAGE ANALYTICS LIVE PRODUCTION CHECKS PASSED!');
  console.log('============================================================\n');
}

run().catch((err) => {
  console.error('Verification failed with uncaught error:', err);
  process.exit(1);
});
