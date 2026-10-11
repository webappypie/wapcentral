// Production Notifications Live Verification Script
// Tests Firebase Hosting, Cloud Run, Platform Notifications APIs, Authentication,
// Effective Config, Security Isolation, Secrets Protection & Device Registration

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

async function runLiveNotificationsVerification() {
  console.log('===============================================================');
  console.log('LIVE PRODUCTION NOTIFICATIONS VERIFICATION — WAPCENTRAL PROD');
  console.log(`Hosting Target:   ${HOSTING_URL}`);
  console.log(`Cloud Run Target: ${CLOUD_RUN_URL}`);
  console.log('===============================================================\n');

  let allPassed = true;

  // 1. Hosting Dashboard /notifications access
  const r1 = await testEndpoint(
    '1. Firebase Hosting: GET /notifications (SPA HTML Routing)',
    `${HOSTING_URL}/notifications`,
    { method: 'GET' },
    200,
  );
  if (!r1.success) allPassed = false;
  if (typeof r1.data === 'string' && r1.data.includes('<title>')) {
    console.log('   Dashboard HTML shell delivered successfully.');
  }

  // 2. Cloud Run Health
  const r2 = await testEndpoint(
    '2. Cloud Run: GET /api/platform/v1/health',
    `${CLOUD_RUN_URL}/api/platform/v1/health`,
    { method: 'GET' },
    200,
  );
  if (!r2.success) allPassed = false;

  // 3. Platform Notification Config API (FileZen)
  const r3 = await testEndpoint(
    '3. Platform API: GET /api/platform/v1/notifications/config (FileZen)',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    200,
  );
  if (!r3.success) allPassed = false;
  if (r3.data && r3.data.data) {
    const cfg = r3.data.data;
    console.log(`   Config retrieved: App=${cfg.appId}, Enabled=${cfg.notificationsEnabled}, GlobalOff=${cfg.globalNotificationsOff}`);
    if (cfg.activeCategories && cfg.activeCategories.length > 0) {
      console.log(`   Active Categories: ${cfg.activeCategories.map(c => c.id).join(', ')}`);
    }
  }

  // 4. Platform Bell Notifications Feed API (FileZen)
  const r4 = await testEndpoint(
    '4. Platform API: GET /api/platform/v1/notifications (Bell Feed)',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications?limit=10&deviceId=dev_smoke_test`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    200,
  );
  if (!r4.success) allPassed = false;

  // 5. Platform Unread Count API
  const r5 = await testEndpoint(
    '5. Platform API: GET /api/platform/v1/notifications/unread-count',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/unread-count?deviceId=dev_smoke_test`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    },
    200,
  );
  if (!r5.success) allPassed = false;
  if (r5.data && r5.data.data) {
    console.log(`   Unread Count: ${r5.data.data.unreadCount}`);
  }

  // 6. Platform Preferences API
  const r6 = await testEndpoint(
    '6. Platform API: GET /api/platform/v1/notifications/preferences',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/preferences?deviceId=dev_smoke_test`,
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

  // 7. Device Token Registration (Synthetic smoke test token - no real push sent)
  const testDeviceId = `dev_smoke_${Date.now()}`;
  const r7 = await testEndpoint(
    '7. Platform API: POST /api/platform/v1/notifications/devices/register',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/devices/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        deviceId: testDeviceId,
        fcmToken: 'fcm_smoke_test_token_verification_only',
        platform: 'android',
        appVersion: '2.1.0',
        deviceModel: 'SmokeTestDevice',
        osVersion: 'Android 14',
      }),
    },
    200,
  );
  if (!r7.success) allPassed = false;

  // 8. Device Token Cleanup / Unregistration
  const r8 = await testEndpoint(
    '8. Platform API: POST /api/platform/v1/notifications/devices/unregister',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/devices/unregister`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
      body: JSON.stringify({
        deviceId: testDeviceId,
      }),
    },
    200,
  );
  if (!r8.success) allPassed = false;

  // 9. Admin Authorization Guard: GET /api/admin/v1/notifications/overview without token
  const r9 = await testEndpoint(
    '9. Security: GET /api/admin/v1/notifications/overview without Token (Expect 401)',
    `${CLOUD_RUN_URL}/api/admin/v1/notifications/overview`,
    { method: 'GET' },
    401,
  );
  if (!r9.success) allPassed = false;

  // 10. Admin Authorization Guard: GET /api/admin/v1/notifications/settings without token
  const r10 = await testEndpoint(
    '10. Security: GET /api/admin/v1/notifications/settings without Token (Expect 401)',
    `${CLOUD_RUN_URL}/api/admin/v1/notifications/settings`,
    { method: 'GET' },
    401,
  );
  if (!r10.success) allPassed = false;

  // 11. Security: App Isolation with Invalid Key
  const r11 = await testEndpoint(
    '11. Security: Platform API with Invalid App Key (Expect 403)',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': 'invalid_secret_key_attempt',
      },
    },
    403,
  );
  if (!r11.success) allPassed = false;

  // 12. Security: Platform API Missing Headers
  const r12 = await testEndpoint(
    '12. Security: Platform API without App Headers (Expect 401)',
    `${CLOUD_RUN_URL}/api/platform/v1/notifications/config`,
    { method: 'GET' },
    401,
  );
  if (!r12.success) allPassed = false;

  // 13. Security: Check for Leaked Secrets in responses
  console.log('\n--- SECRETS AUDIT ---');
  const allResponsesText = JSON.stringify([r1.data, r2.data, r3.data, r4.data, r5.data, r6.data, r7.data]);
  const sensitivePatterns = [
    'private_key',
    'client_secret',
    'service_account',
    'FIREBASE_ADMIN',
    'BEGIN PRIVATE KEY',
    'fcm_server_key',
  ];
  let leakFound = false;
  for (const pattern of sensitivePatterns) {
    if (allResponsesText.includes(pattern)) {
      console.log(`❌ LEAK DETECTED: Found '${pattern}' in public response!`);
      leakFound = true;
      allPassed = false;
    }
  }
  if (!leakFound) {
    console.log('✓ Zero provider secrets, FCM keys, or private keys exposed to public responses.');
  }

  // 14. Rewrites verification through Firebase Hosting
  const r14 = await testEndpoint(
    '14. Hosting CDN Rewrite: GET /api/platform/v1/notifications/config through Hosting',
    `${HOSTING_URL}/api/platform/v1/notifications/config`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': OPTILENS_ID,
        'X-App-Key': OPTILENS_KEY,
      },
    },
    200,
  );
  if (!r14.success) allPassed = false;

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('🎉 ALL LIVE PRODUCTION NOTIFICATIONS VERIFICATIONS PASSED SUCCESSFULLY!');
  } else {
    console.log('❌ SOME VERIFICATIONS FAILED.');
    process.exit(1);
  }
  console.log('===============================================================');
}

runLiveNotificationsVerification();
