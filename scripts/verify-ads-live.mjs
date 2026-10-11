// Production Ads & Monetization Live Verification Script
// Tests Firebase Hosting, Cloud Run, Platform Ads APIs, Authentication, Effective Config, Secrets & Kill-Switch Guards

const HOSTING_URL = 'https://wapcentral-prod.web.app';
const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';

const FILEZEN_ID = 'filezen';
const FILEZEN_KEY = 'wap_key_filezen_prod';

const OPTILENS_ID = 'optilens';
const OPTILENS_KEY = 'wap_key_optilens_prod';

async function testEndpoint(name, url, options, expectedStatus) {
  process.stdout.write(`Testing: ${name}... `);
  try {
    const res = await fetch(url, options);
    const bodyText = await res.text();
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {}

    if (res.status === expectedStatus) {
      console.log(`✓ [HTTP ${res.status}] Passed.`);
      return { success: true, status: res.status, data: bodyJson || bodyText };
    } else {
      console.log(`✗ [HTTP ${res.status}] (Expected ${expectedStatus})`);
      console.log(`  Response:`, bodyText.slice(0, 300));
      return { success: false, status: res.status, data: bodyJson || bodyText };
    }
  } catch (err) {
    console.log(`✗ Network Error:`, err.message);
    return { success: false, error: err.message };
  }
}

async function runLiveAdsVerification() {
  console.log('===============================================================');
  console.log('LIVE PRODUCTION ADS VERIFICATION — WAPCENTRAL PROD');
  console.log(`Hosting Target:   ${HOSTING_URL}`);
  console.log(`Cloud Run Target: ${CLOUD_RUN_URL}`);
  console.log('===============================================================\n');

  let allPassed = true;

  // 1. Hosting Dashboard /ads access
  const r1 = await testEndpoint(
    '1. Firebase Hosting: GET /ads (SPA HTML Routing)',
    `${HOSTING_URL}/ads`,
    { method: 'GET' },
    200,
  );
  if (!r1.success) allPassed = false;
  if (typeof r1.data === 'string' && r1.data.includes('<title>')) {
    console.log('   Dashboard HTML shell delivered successfully.');
  }

  // 2. Cloud Run Direct Health
  const r2 = await testEndpoint(
    '2. Cloud Run Direct: GET /api/platform/v1/health',
    `${CLOUD_RUN_URL}/api/platform/v1/health`,
    { method: 'GET' },
    200,
  );
  if (!r2.success) allPassed = false;
  if (r2.data?.data?.services) {
    console.log(`   Registered Services: [${Object.keys(r2.data.data.services).join(', ')}]`);
  }

  // 3. Hosting Proxy Health
  const r3 = await testEndpoint(
    '3. Hosting Proxy: GET /api/platform/v1/health (Firebase Rewrites)',
    `${HOSTING_URL}/api/platform/v1/health`,
    { method: 'GET' },
    200,
  );
  if (!r3.success) allPassed = false;

  // 4. Platform Ads Config: Missing Auth (Expected 401)
  const r4 = await testEndpoint(
    '4. Security: GET /api/platform/v1/ads/config (No Credentials)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/config`,
    { method: 'GET' },
    401,
  );
  if (!r4.success) allPassed = false;

  // 5. Platform Ads Config: Invalid App Key (Expected 403)
  const r5 = await testEndpoint(
    '5. Security: GET /api/platform/v1/ads/config (Invalid Key)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': 'invalid_secret_key_12345',
      },
    },
    403,
  );
  if (!r5.success) allPassed = false;

  // 6. Platform Ads Config: Authorized FileZen
  const r6 = await testEndpoint(
    '6. Authorized FileZen: GET /api/platform/v1/ads/config',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    200,
  );
  if (!r6.success) allPassed = false;

  if (r6.data?.data) {
    const cfg = r6.data.data;
    console.log(`   Effective App ID:     ${cfg.appId}`);
    console.log(`   Ads Master Enabled:   ${cfg.enabled}`);
    console.log(`   Config Version Hash:  ${cfg.version}`);
    console.log(`   Safety Max Rating:    ${cfg.safety?.maxAdRating}`);
    console.log(`   Blocked Categories:   [${(cfg.safety?.blockedCategories || []).join(', ')}]`);

    // Verify format configurations
    const formats = Object.keys(cfg.formats || {});
    console.log(`   Configured Formats:   [${formats.join(', ')}]`);

    // Check banner safe refresh
    if (cfg.formats?.banner) {
      console.log(`   Banner Refresh Sec:   ${cfg.formats.banner.refreshIntervalSeconds}s (Policy >= 30s)`);
      if (cfg.formats.banner.refreshIntervalSeconds < 30) {
        console.error('   ✗ Policy violation: Banner refresh is below 30s!');
        allPassed = false;
      }
    }

    // Inspect for zero secret leakage
    const jsonStr = JSON.stringify(cfg);
    const forbiddenKeywords = ['secret', 'apiKey', 'privateKey', 'secretReferenceName'];
    const foundKeywords = forbiddenKeywords.filter(k => jsonStr.toLowerCase().includes(k.toLowerCase()));
    if (foundKeywords.length > 0) {
      console.error(`   ✗ Secret leakage detected! Forbidden keywords found: ${foundKeywords.join(', ')}`);
      allPassed = false;
    } else {
      console.log('   ✓ Zero Secret Leakage: No provider secrets exposed to mobile payload.');
    }
  }

  // 7. Authorized OptiLens: GET /api/platform/v1/ads/config
  const r7 = await testEndpoint(
    '7. Authorized OptiLens: GET /api/platform/v1/ads/config',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': OPTILENS_ID,
        'X-App-Key': OPTILENS_KEY,
      },
    },
    200,
  );
  if (!r7.success) allPassed = false;
  if (r7.data?.data) {
    console.log(`   OptiLens Config Resolved: appId=${r7.data.data.appId}, enabled=${r7.data.data.enabled}`);
  }

  // 8. Hosting Proxy: Authorized FileZen Ads Config
  const r8 = await testEndpoint(
    '8. Hosting Proxy: GET /api/platform/v1/ads/config (Through CDN rewrite)',
    `${HOSTING_URL}/api/platform/v1/ads/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    200,
  );
  if (!r8.success) allPassed = false;

  // 9. Custom Ad Tracking: POST /api/platform/v1/ads/custom/track
  const r9 = await testEndpoint(
    '9. Authorized Tracking: POST /api/platform/v1/ads/custom/track (Impression)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/custom/track`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        appId: FILEZEN_ID,
        campaignId: 'camp_001',
        type: 'impression',
        placementKey: 'main_dashboard_banner',
      }),
    },
    200,
  );
  if (!r9.success) allPassed = false;

  // 10. Admin API Route Protection: Unauthenticated Kill Switch Access (Expected 401)
  const r10 = await testEndpoint(
    '10. Admin Security: GET /api/admin/v1/ads/kill-switches (No Admin Token)',
    `${CLOUD_RUN_URL}/api/admin/v1/ads/kill-switches`,
    { method: 'GET' },
    401,
  );
  if (!r10.success) allPassed = false;

  // 11. Admin API Route Protection: Unauthorized Kill Switch Mutation (Expected 401)
  const r11 = await testEndpoint(
    '11. Admin Security: PUT /api/admin/v1/ads/kill-switches (No Admin Token)',
    `${CLOUD_RUN_URL}/api/admin/v1/ads/kill-switches`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalAdsDisabled: true, reason: 'unauthorized test' }),
    },
    401,
  );
  if (!r11.success) allPassed = false;

  // 12. Admin Overview Protection (Expected 401)
  const r12 = await testEndpoint(
    '12. Admin Security: GET /v1/ads/overview (No Admin Token)',
    `${CLOUD_RUN_URL}/v1/ads/overview`,
    { method: 'GET' },
    401,
  );
  if (!r12.success) allPassed = false;

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('🎉 ALL LIVE PRODUCTION ADS CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ ONE OR MORE LIVE CHECKS FAILED!');
  }
  console.log('===============================================================');

  return allPassed;
}

runLiveAdsVerification().then(success => {
  process.exit(success ? 0 : 1);
});
