const HOSTING_URL = 'https://wapcentral-prod.web.app';
const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';

async function testEndpoint(name, url, options, expectedStatus) {
  process.stdout.write(`Testing ${name}... `);
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

async function runLiveVerification() {
  console.log('====================================================');
  console.log('LIVE PRODUCTION VERIFICATION — WAPCENTRAL PLATFORM');
  console.log(`Hosting Target:   ${HOSTING_URL}`);
  console.log(`Cloud Run Target: ${CLOUD_RUN_URL}`);
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Direct Cloud Run Health
  const r1 = await testEndpoint(
    'Cloud Run Direct: GET /api/platform/v1/health',
    `${CLOUD_RUN_URL}/api/platform/v1/health`,
    { method: 'GET' },
    200,
  );
  if (!r1.success) allPassed = false;
  if (r1.data?.data) {
    console.log(`   Service Status: ${r1.data.data.status}, Services: [${Object.keys(r1.data.data.services).join(', ')}]`);
  }

  // 2. Hosting Proxy Health
  const r2 = await testEndpoint(
    'Hosting Proxy: GET /api/platform/v1/health',
    `${HOSTING_URL}/api/platform/v1/health`,
    { method: 'GET' },
    200,
  );
  if (!r2.success) allPassed = false;

  // 3. Auth Rejection: Missing App ID
  const r3 = await testEndpoint(
    'Auth Rejection: POST /api/platform/v1/files/search (No Credentials)',
    `${CLOUD_RUN_URL}/api/platform/v1/files/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    },
    401,
  );
  if (!r3.success) allPassed = false;

  // 4. Auth Rejection: Invalid App Key
  const r4 = await testEndpoint(
    'Auth Rejection: POST /api/platform/v1/files/search (Wrong Key)',
    `${CLOUD_RUN_URL}/api/platform/v1/files/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': 'filezen',
        'X-App-Key': 'invalid_secret_key',
      },
      body: JSON.stringify({ appId: 'filezen', query: 'test' }),
    },
    403,
  );
  if (!r4.success) allPassed = false;

  // 5. Server-side Service Authorization Isolation Check:
  // OptiLens has ['image', 'ai'], but NOT 'ocr'. Calling /ocr/extract MUST be forbidden (403)
  const r5 = await testEndpoint(
    'Service Authorization Isolation: OptiLens calling /ocr/extract (Should be 403 Forbidden)',
    `${CLOUD_RUN_URL}/api/platform/v1/ocr/extract`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': 'optilens',
        'X-App-Key': 'wap_key_optilens_prod',
      },
      body: JSON.stringify({
        appId: 'optilens',
        imageData: 'sample_base64',
        documentType: 'receipt',
      }),
    },
    403,
  );
  if (!r5.success) allPassed = false;

  // 6. Authorized Service Call: OptiLens calling /image/analyze
  const r6 = await testEndpoint(
    'Authorized OptiLens: POST /api/platform/v1/image/analyze',
    `${CLOUD_RUN_URL}/api/platform/v1/image/analyze`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': 'optilens',
        'X-App-Key': 'wap_key_optilens_prod',
      },
      body: JSON.stringify({
        appId: 'optilens',
        imageData: 'data:image/jpeg;base64,mockrawjpegdata',
      }),
    },
    200,
  );
  if (!r6.success) allPassed = false;
  if (r6.data?.data) {
    console.log(`   Quality Score: ${r6.data.data.qualityScore}, Is Blurry: ${r6.data.data.isBlurry}, Est Res: ${r6.data.data.estimatedResolution?.width}x${r6.data.data.estimatedResolution?.height}`);
  }

  // 7. Authorized Service Call: FileZen calling /files/search ("2025 ka electricity bill dhundo")
  const r7 = await testEndpoint(
    'Authorized FileZen: POST /api/platform/v1/files/search ("2025 ka electricity bill dhundo")',
    `${CLOUD_RUN_URL}/api/platform/v1/files/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': 'filezen',
        'X-App-Key': 'wap_key_filezen_prod',
      },
      body: JSON.stringify({
        appId: 'filezen',
        query: '2025 ka electricity bill dhundo',
        localCandidates: [
          {
            id: 'file_001',
            name: 'Electricity_Bill_March_2025.pdf',
            extension: 'pdf',
            sizeBytes: 450000,
            extractedSnippet: 'Electricity power consumption charges for March 2025',
          },
          {
            id: 'file_002',
            name: 'Gym_Membership_2024.pdf',
            extension: 'pdf',
            sizeBytes: 120000,
            extractedSnippet: 'Annual gym membership receipt',
          },
        ],
      }),
    },
    200,
  );
  if (!r7.success) allPassed = false;
  if (r7.data?.data) {
    console.log(`   Parsed Intent: ${r7.data.data.parsedIntent?.category}, Year: ${r7.data.data.parsedIntent?.targetYear}`);
    console.log(`   Matched Files: ${r7.data.data.matchedFiles?.length}, Top match: "${r7.data.data.matchedFiles?.[0]?.fileName}" (Score: ${r7.data.data.matchedFiles?.[0]?.relevanceScore})`);
  }

  // 8. Authorized Service Call: FileZen calling /ocr/extract
  const r8 = await testEndpoint(
    'Authorized FileZen: POST /api/platform/v1/ocr/extract',
    `${CLOUD_RUN_URL}/api/platform/v1/ocr/extract`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': 'filezen',
        'X-App-Key': 'wap_key_filezen_prod',
      },
      body: JSON.stringify({
        appId: 'filezen',
        imageData: 'data:image/png;base64,mockpngdata',
        documentType: 'receipt',
        structuredExtract: true,
      }),
    },
    200,
  );
  if (!r8.success) allPassed = false;

  console.log('\n====================================================');
  if (allPassed) {
    console.log('ALL LIVE ENDPOINTS AND SECURITY RULES VERIFIED 100%!');
  } else {
    console.log('SOME LIVE CHECKS FAILED — Review logs above.');
  }
  console.log('====================================================');
}

runLiveVerification();
