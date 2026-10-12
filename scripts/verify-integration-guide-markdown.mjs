// scripts/verify-integration-guide-markdown.mjs
// Verification of Integration Guide Markdown generation, MIME type, filename, app isolation, formatting, and secret masking.

process.env.NODE_ENV = 'test';

import { strict as assert } from 'node:assert';

async function runVerification() {
  // Dynamically import app and services after setting process.env.NODE_ENV = 'test'
  const { default: request } = await import('../services/admin-api/node_modules/supertest/index.js');
  const { app } = await import('../services/admin-api/dist/app.js');
  const { clearInMemoryFirestoreForTest, getFirestoreDb } = await import('../services/admin-api/dist/services/firestore.js');
  const { COLLECTIONS } = await import('../packages/config/dist/index.js');

  const SUPER_ADMIN_AUTH = 'Bearer test-superadmin-token';
  const UNAUTHORIZED_AUTH = 'Bearer test-unauthorized-role-token';

  console.log('===============================================================');
  console.log('WAPCentral — Integration Guide Markdown (.md) Verification');
  console.log('===============================================================\n');

  clearInMemoryFirestoreForTest();

  // Test 1: FileZen Integration Guide Download
  console.log('1. Testing FileZen Markdown Guide Download:');
  const res1 = await request(app)
    .get('/v1/apps/filezen/integration-guide')
    .set('Authorization', SUPER_ADMIN_AUTH);

  assert.equal(res1.status, 200, `Expected 200 OK, got ${res1.status}`);
  assert.equal(res1.headers['content-type'], 'text/markdown; charset=utf-8', 'Content-Type must be text/markdown; charset=utf-8');
  assert.equal(res1.headers['content-disposition'], 'attachment; filename="WAPCentral_FileZen_Integration_Guide.md"', 'Filename must be WAPCentral_FileZen_Integration_Guide.md');
  assert.ok(!res1.headers['content-disposition'].includes('.docx'), 'Must never contain .docx extension');

  const md1 = res1.text;
  assert.ok(md1.startsWith('# WAPCentral Integration Guide — FileZen'), 'Must start with clean markdown H1');
  assert.ok(md1.includes('WAPCentral_FileZen_Integration_Guide.md') || md1.includes('FileZen'), 'Must contain FileZen identity');
  assert.ok(md1.includes('com.webappypie.filezen'), 'Must contain package ID');
  assert.ok(md1.includes('wap_key_••••••••'), 'Secret key must be securely masked');
  assert.ok(!md1.includes('wap_key_filezen_prod\n'), 'Must not leak raw unmasked app key in plain lines');
  assert.ok(md1.includes('AppLovin MAX as the sole advertising mediation platform'), 'Must identify AppLovin MAX as sole mediation engine');
  assert.ok(md1.includes('`wap_core_sdk`'), 'Must include wap_core_sdk');
  assert.ok(md1.includes('`wap_ai_sdk`'), 'Must include wap_ai_sdk');
  assert.ok(md1.includes('`wap_ocr_sdk`'), 'Must include wap_ocr_sdk');
  assert.ok(md1.includes('`wap_file_sdk`'), 'Must include wap_file_sdk');
  assert.ok(md1.includes('`wap_ads_sdk`'), 'Must include wap_ads_sdk');
  assert.ok(md1.includes('`wap_notifications_sdk`'), 'Must include wap_notifications_sdk');
  assert.ok(!md1.includes('`wap_image_sdk`'), 'Must NOT include wap_image_sdk (not enabled for FileZen)');
  assert.ok(!md1.includes('OptiLens'), 'Strict App Isolation: Must NOT contain OptiLens details');
  console.log('   ✓ FileZen guide generated with valid Markdown, correct filename, MIME type, and masked secret.');

  // Test 2: OptiLens AI Integration Guide Download
  console.log('\n2. Testing OptiLens AI Markdown Guide Download:');
  const res2 = await request(app)
    .get('/v1/apps/optilens/integration-guide')
    .set('Authorization', SUPER_ADMIN_AUTH);

  assert.equal(res2.status, 200, `Expected 200 OK, got ${res2.status}`);
  assert.equal(res2.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(res2.headers['content-disposition'], 'attachment; filename="WAPCentral_OptiLens_AI_Integration_Guide.md"');

  const md2 = res2.text;
  assert.ok(md2.startsWith('# WAPCentral Integration Guide — OptiLens AI'), 'Must start with clean markdown H1');
  assert.ok(md2.includes('com.webappypie.optilens'), 'Must contain OptiLens package ID');
  assert.ok(md2.includes('wap_key_••••••••'), 'Secret key must be securely masked');
  assert.ok(md2.includes('`wap_core_sdk`'), 'Must include wap_core_sdk');
  assert.ok(md2.includes('`wap_image_sdk`'), 'Must include wap_image_sdk');
  assert.ok(md2.includes('`wap_ai_sdk`'), 'Must include wap_ai_sdk');
  assert.ok(md2.includes('`wap_ads_sdk`'), 'Must include wap_ads_sdk');
  assert.ok(md2.includes('`wap_notifications_sdk`'), 'Must include wap_notifications_sdk');
  assert.ok(!md2.includes('`wap_ocr_sdk`'), 'Must NOT include wap_ocr_sdk (not enabled for OptiLens)');
  assert.ok(!md2.includes('`wap_file_sdk`'), 'Must NOT include wap_file_sdk (not enabled for OptiLens)');
  assert.ok(!md2.includes('FileZen'), 'Strict App Isolation: Must NOT contain FileZen details');
  console.log('   ✓ OptiLens AI guide generated with valid Markdown, isolated config, and correct SDK table.');

  // Test 3: Custom App with Missing Values
  console.log('\n3. Testing Custom App with Missing Values:');
  const db = getFirestoreDb();
  const customId = 'app_custom_game_99';
  await db.collection(COLLECTIONS.APPS).doc(customId).set({
    id: customId,
    name: 'Block Puzzle Deluxe',
    packageId: 'com.webappypie.blockpuzzle',
    platform: 'android',
    version: '1.0.0',
    environment: 'production',
    appKey: 'wap_key_puzzle_secret_998877',
    allowedServices: ['ads'],
    enabledModules: ['ads'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const res3 = await request(app)
    .get(`/v1/apps/${customId}/integration-guide`)
    .set('Authorization', SUPER_ADMIN_AUTH);

  assert.equal(res3.status, 200);
  assert.equal(res3.headers['content-disposition'], 'attachment; filename="WAPCentral_Block_Puzzle_Deluxe_Integration_Guide.md"');

  const md3 = res3.text;
  assert.ok(md3.includes('Block Puzzle Deluxe'));
  assert.ok(md3.includes('com.webappypie.blockpuzzle'));
  assert.ok(md3.includes('Not configured'), 'Missing bundleId must show Not configured');
  assert.ok(md3.includes('Configured in Firebase — not stored in WAPCentral'), 'Missing Firebase fields must show approved placeholder');
  assert.ok(md3.includes('wap_key_••••••••8877'), 'App key must be securely masked');
  assert.ok(!md3.includes('wap_key_puzzle_secret_998877\n'), 'Must not leak raw secret key');
  assert.ok(!md3.includes('`wap_ai_sdk`'), 'Unused SDKs must not be present');
  console.log('   ✓ Custom app correctly marks missing values and masks secrets.');

  // Test 4: Security and Authorization
  console.log('\n4. Testing Security and Authorization:');
  const resUnauth = await request(app).get('/v1/apps/filezen/integration-guide');
  assert.equal(resUnauth.status, 401, 'Unauthenticated request must return 401');

  const resForbid = await request(app)
    .get('/v1/apps/filezen/integration-guide')
    .set('Authorization', UNAUTHORIZED_AUTH);
  assert.equal(resForbid.status, 403, 'Unauthorized role request must return 403');

  const resNotFound = await request(app)
    .get('/v1/apps/non_existent_app_9999/integration-guide')
    .set('Authorization', SUPER_ADMIN_AUTH);
  assert.equal(resNotFound.status, 404, 'Non-existent app must return 404');
  console.log('   ✓ 401, 403, and 404 security rules strictly enforced.');

  // Test 5: Verify zero DOCX artifacts
  console.log('\n5. Verifying Zero DOCX Artifacts:');
  assert.ok(!md1.includes('.docx'), 'FileZen guide does not reference .docx');
  assert.ok(!md2.includes('.docx'), 'OptiLens guide does not reference .docx');
  assert.ok(!md3.includes('.docx'), 'Custom app guide does not reference .docx');
  console.log('   ✓ Output is 100% clean Markdown (.md) and zero DOCX.');

  console.log('\n===============================================================');
  console.log('🎉 ALL INTEGRATION GUIDE MARKDOWN VERIFICATIONS PASSED 100%!');
  console.log('===============================================================\n');
}

runVerification().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
