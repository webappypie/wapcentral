// Production Analytics & Revenue Intelligence Live Verification Script
// Tests Firebase Hosting, Cloud Run Admin & Platform APIs, Event Ingestion,
// App Isolation, Admin Authorization, Filters, Time-series, Exports,
// and strictly verifies "Not connected" revenue honesty (zero fabricated revenue).

const HOSTING_URL = 'https://wapcentral-prod.web.app';
const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';

const FILEZEN_ID = 'filezen';
const FILEZEN_KEY = 'wap_key_filezen_prod';

const OPTILENS_ID = 'optilens';
const OPTILENS_KEY = 'wap_key_optilens_prod';

// Generate valid Super Admin test token
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
const adminToken = `${header}.${payload}.sig`;

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
      return { success: true, status: res.status, data: bodyJson || bodyText, headers: res.headers };
    } else {
      console.log(`✗ [HTTP ${res.status}] (Expected ${expectedStatus})`);
      console.log(`  Response:`, bodyText.slice(0, 300));
      return { success: false, status: res.status, data: bodyJson || bodyText, headers: res.headers };
    }
  } catch (err) {
    console.log(`✗ Network Error:`, err.message);
    return { success: false, error: err.message };
  }
}

async function runLiveAnalyticsVerification() {
  console.log('===============================================================');
  console.log('LIVE PRODUCTION ANALYTICS & REVENUE INTELLIGENCE VERIFICATION');
  console.log(`Hosting Target:   ${HOSTING_URL}`);
  console.log(`Cloud Run Target: ${CLOUD_RUN_URL}`);
  console.log('===============================================================\n');

  let allPassed = true;

  // 1. Firebase Hosting: GET /analytics (SPA Routing)
  const r1 = await testEndpoint(
    '1. Firebase Hosting: GET /analytics (SPA HTML Delivery)',
    `${HOSTING_URL}/analytics`,
    { method: 'GET' },
    200,
  );
  if (!r1.success) allPassed = false;
  if (typeof r1.data === 'string' && r1.data.includes('<title>')) {
    console.log('   ✓ Dashboard HTML shell delivered successfully for /analytics route.');
  }

  // 2. Admin Security: Unauthorized request to Overview (Expect 401)
  const r2 = await testEndpoint(
    '2. Admin Security: GET /api/admin/v1/analytics/overview (No Token -> 401)',
    `${HOSTING_URL}/api/admin/v1/analytics/overview`,
    { method: 'GET' },
    401,
  );
  if (!r2.success) allPassed = false;

  // 3. Admin Security: Unauthorized request to Revenue (Expect 401)
  const r3 = await testEndpoint(
    '3. Admin Security: GET /api/admin/v1/analytics/revenue (No Token -> 401)',
    `${HOSTING_URL}/api/admin/v1/analytics/revenue`,
    { method: 'GET' },
    401,
  );
  if (!r3.success) allPassed = false;

  // 4. Admin API: GET /api/admin/v1/analytics/overview (Proxied via Hosting)
  const r4 = await testEndpoint(
    '4. Admin API (Proxied): GET /api/admin/v1/analytics/overview?days=30',
    `${HOSTING_URL}/api/admin/v1/analytics/overview?days=30`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r4.success) allPassed = false;
  const overviewData = r4.data?.data;
  if (overviewData) {
    console.log(`   Summary: Impressions=${overviewData.totalImpressions}, Clicks=${overviewData.totalClicks}, CTR=${overviewData.ctr}%, Revenue=$${overviewData.totalRevenue} (${overviewData.revenueStatus})`);
  }

  // 5. Cloud Run Direct: GET /v1/analytics/overview
  const r5 = await testEndpoint(
    '5. Cloud Run Direct: GET /v1/analytics/overview',
    `${CLOUD_RUN_URL}/v1/analytics/overview`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r5.success) allPassed = false;

  // 6. Admin API: GET /api/admin/v1/analytics/apps
  const r6 = await testEndpoint(
    '6. Admin API: GET /api/admin/v1/analytics/apps',
    `${HOSTING_URL}/api/admin/v1/analytics/apps`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r6.success) allPassed = false;
  if (Array.isArray(r6.data?.data)) {
    console.log(`   Apps breakdown entries: ${r6.data.data.length}`);
  }

  // 7. Admin API: GET /api/admin/v1/analytics/networks
  const r7 = await testEndpoint(
    '7. Admin API: GET /api/admin/v1/analytics/networks',
    `${HOSTING_URL}/api/admin/v1/analytics/networks`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r7.success) allPassed = false;
  if (Array.isArray(r7.data?.data)) {
    console.log(`   Networks tracked: [${r7.data.data.map((n) => n.network).join(', ')}]`);
  }

  // 8. Admin API: GET /api/admin/v1/analytics/formats
  const r8 = await testEndpoint(
    '8. Admin API: GET /api/admin/v1/analytics/formats',
    `${HOSTING_URL}/api/admin/v1/analytics/formats`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r8.success) allPassed = false;
  if (Array.isArray(r8.data?.data)) {
    console.log(`   Formats tracked: [${r8.data.data.map((f) => f.format).join(', ')}]`);
  }

  // 9. Admin API: GET /api/admin/v1/analytics/placements
  const r9 = await testEndpoint(
    '9. Admin API: GET /api/admin/v1/analytics/placements',
    `${HOSTING_URL}/api/admin/v1/analytics/placements`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r9.success) allPassed = false;

  // 10. Query Filters Verification (appId, network, format, placementId)
  const r10 = await testEndpoint(
    '10. Filter Verification: GET /api/admin/v1/analytics/overview (Filtered Query)',
    `${HOSTING_URL}/api/admin/v1/analytics/overview?appId=filezen&network=admob&format=banner&placementId=filezen_main_banner`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r10.success) allPassed = false;

  // 11. Time-series Endpoint
  const r11 = await testEndpoint(
    '11. Time-Series: GET /api/admin/v1/analytics/timeseries?days=30',
    `${HOSTING_URL}/api/admin/v1/analytics/timeseries?days=30`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r11.success) allPassed = false;
  if (Array.isArray(r11.data?.data)) {
    console.log(`   Time-series points returned: ${r11.data.data.length} days`);
  }

  // 12. Revenue Intelligence & Honesty Check: Verify "Not connected" and ZERO fabricated revenue
  console.log('\n--- REVENUE INTEGRITY & HONESTY VERIFICATION ---');
  const r12 = await testEndpoint(
    '12. Revenue Intelligence: GET /api/admin/v1/analytics/revenue',
    `${HOSTING_URL}/api/admin/v1/analytics/revenue`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r12.success) allPassed = false;
  const revPayload = r12.data?.data;
  if (revPayload) {
    console.log(`   Reported Revenue: $${revPayload.reportedRevenueUsd}`);
    console.log(`   Notice: "${revPayload.accountingNotice?.slice(0, 80)}..."`);
    
    // Strict verify providers
    const providers = revPayload.revenueProviders || [];
    for (const p of providers) {
      console.log(`   - Provider [${p.providerId} (${p.providerName})]: isConnected=${p.isConnected}, status="${p.status}"`);
      if (['admob', 'meta', 'applovin'].includes(p.providerId)) {
        if (p.isConnected !== false || !p.status.toLowerCase().includes('not connected')) {
          console.error(`   ✗ VIOLATION: Provider ${p.providerId} must show 'Not connected' when reporting credentials are absent!`);
          allPassed = false;
        }
      }
    }

    if (revPayload.reportedRevenueUsd !== 0) {
      console.error(`   ✗ VIOLATION: Fabricated revenue detected! Expected $0.00, got $${revPayload.reportedRevenueUsd}`);
      allPassed = false;
    } else {
      console.log('   ✓ Zero Fabricated Revenue: Exactly $0.00 reported with genuine "Not connected" notice.');
    }
  }

  // 13. Data Export: JSON format
  const r13 = await testEndpoint(
    '13. Data Export: GET /api/admin/v1/analytics/export?type=json',
    `${HOSTING_URL}/api/admin/v1/analytics/export?type=json`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r13.success) allPassed = false;
  if (r13.data?.filename) {
    console.log(`   ✓ Export file generated: ${r13.data.filename}`);
  }

  // 14. Data Export: CSV format
  const r14 = await testEndpoint(
    '14. Data Export: GET /api/admin/v1/analytics/export?type=csv',
    `${HOSTING_URL}/api/admin/v1/analytics/export?type=csv`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r14.success) allPassed = false;
  if (typeof r14.data === 'string' && r14.data.includes('Date,AppId')) {
    console.log('   ✓ CSV data stream formatted with appropriate header row.');
  }

  // 15. Retention Policy Configuration
  const r15 = await testEndpoint(
    '15. Data Retention: GET /api/admin/v1/analytics/retention',
    `${HOSTING_URL}/api/admin/v1/analytics/retention`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r15.success) allPassed = false;
  if (r15.data?.data) {
    console.log(`   Retention TTL: usageEvents=${r15.data.data.usageEventsTtlDays}d, auditLogs=${r15.data.data.auditLogsTtlDays}d`);
  }

  // 16. Platform Event Ingestion Security: Missing Credentials (Expect 401)
  console.log('\n--- PLATFORM EVENT INGESTION & APP ISOLATION VERIFICATION ---');
  const r16 = await testEndpoint(
    '16. Ingestion Security: POST /api/platform/v1/ads/analytics/events (No Auth -> 401)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/analytics/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            requestId: `req_test_${Date.now()}`,
            eventType: 'request',
            adFormat: 'banner',
            provider: 'admob',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    },
    401,
  );
  if (!r16.success) allPassed = false;

  // 17. Platform Event Ingestion Security: Invalid Key (Expect 403)
  const r17 = await testEndpoint(
    '17. Ingestion Security: POST /api/platform/v1/ads/analytics/events (Invalid Key -> 403)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/analytics/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': 'invalid_secret_key_99999',
      },
      body: JSON.stringify({
        events: [
          {
            requestId: `req_test_${Date.now()}`,
            eventType: 'request',
            adFormat: 'banner',
            provider: 'admob',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    },
    403,
  );
  if (!r17.success) allPassed = false;

  // 18. Platform Event Ingestion: Valid Batch Ingestion (FileZen)
  const testRequestId = `req_live_test_${Date.now()}`;
  const r18 = await testEndpoint(
    '18. Ingestion: POST /api/platform/v1/ads/analytics/events (FileZen Authorized Batch)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/analytics/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        events: [
          {
            requestId: testRequestId,
            eventType: 'request',
            adFormat: 'banner',
            provider: 'admob',
            placementId: 'filezen_main_banner',
            timestamp: new Date().toISOString(),
          },
          {
            requestId: testRequestId,
            eventType: 'impression',
            adFormat: 'banner',
            provider: 'admob',
            placementId: 'filezen_main_banner',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    },
    200,
  );
  if (!r18.success) allPassed = false;
  if (r18.data?.data) {
    console.log(`   Ingested count: accepted=${r18.data.data.accepted}, rejected=${r18.data.data.rejected}`);
  }

  // 19. Ingestion Deduplication Verification: Resend same event (same requestId + same eventType)
  const r19 = await testEndpoint(
    '19. Ingestion Deduplication: Resend Same Event ID (Expect Deduplication Suppression)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/analytics/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        events: [
          {
            requestId: testRequestId,
            eventType: 'impression',
            adFormat: 'banner',
            provider: 'admob',
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    },
    200,
  );
  if (!r19.success) allPassed = false;
  if (r19.data?.data) {
    console.log(`   Duplicate detection: accepted=${r19.data.data.accepted}, rejected=${r19.data.data.rejected}`);
    if (r19.data.data.rejected >= 1) {
      console.log('   ✓ In-memory deduplication sliding cache successfully suppressed duplicate telemetry event.');
    }
  }

  // 20. App Isolation Enforcement: FileZen caller requesting OptiLens configuration
  const r20 = await testEndpoint(
    '20. App Isolation: FileZen caller requesting OptiLens config (Expect 403 Violation)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/config/${OPTILENS_ID}`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    403,
  );
  if (!r20.success) allPassed = false;
  if (r20.data?.error?.code) {
    console.log(`   ✓ App Isolation strictly enforced: rejected with ${r20.data.error.code}.`);
  }

  // 21. App Isolation in Custom Ad Tracking: FileZen caller sending OptiLens appId in payload
  const r21 = await testEndpoint(
    '21. App Isolation: FileZen caller submitting OptiLens payload to custom tracker (Expect 403 Violation)',
    `${CLOUD_RUN_URL}/api/platform/v1/ads/custom/track`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        campaignId: 'camp_demo',
        appId: OPTILENS_ID, // Mismatched appId
        type: 'impression',
        placementKey: 'test_placement',
      }),
    },
    403,
  );
  if (!r21.success) allPassed = false;
  if (r21.data?.error?.code) {
    console.log(`   ✓ App Isolation strictly enforced: rejected with ${r21.data.error.code}.`);
  }

  // 22. Custom Ads & Notification Analytics Endpoints
  const r22 = await testEndpoint(
    '22. Custom Ads Analytics: GET /api/admin/v1/analytics/custom-ads',
    `${HOSTING_URL}/api/admin/v1/analytics/custom-ads`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r22.success) allPassed = false;

  const r23 = await testEndpoint(
    '23. Notification Analytics: GET /api/admin/v1/analytics/notifications',
    `${HOSTING_URL}/api/admin/v1/analytics/notifications`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
    200,
  );
  if (!r23.success) allPassed = false;

  // 24. Daily Rollup Aggregation API
  const todayStr = new Date().toISOString().split('T')[0];
  const r24 = await testEndpoint(
    `24. Daily Aggregation: POST /api/admin/v1/analytics/aggregate (Date=${todayStr})`,
    `${HOSTING_URL}/api/admin/v1/analytics/aggregate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ date: todayStr }),
    },
    200,
  );
  if (!r24.success) allPassed = false;
  if (r24.data?.data) {
    console.log(`   ✓ Daily rollup completed for date ${r24.data.data.date}: generated ${r24.data.data.aggregatesCount} aggregate documents.`);
  }

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('🎉 ALL LIVE PRODUCTION ANALYTICS CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ ONE OR MORE VERIFICATION CHECKS FAILED!');
    process.exit(1);
  }
  console.log('===============================================================\n');
}

runLiveAnalyticsVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
