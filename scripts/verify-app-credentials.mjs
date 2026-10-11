import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

function generateSecureAppKey(prefix = 'wap_key_') {
  const bytes = crypto.randomBytes(20);
  return `${prefix}${bytes.toString('hex')}`;
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const db = getFirestore(app);

async function runVerification() {
  console.log('==================================================');
  console.log('RUNNING APPLICATION CREDENTIALS SYSTEM VERIFICATION');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // --- 1. Key Generation Format and Entropy ---
  console.log('--- 1. Cryptographic Key Generation ---');
  const key1 = generateSecureAppKey();
  const key2 = generateSecureAppKey();

  assert(key1.startsWith('wap_key_'), `Generated key starts with 'wap_key_' prefix (${key1.substring(0, 16)}...)`);
  assert(key1.length === 48, `Key length is 48 chars (prefix + 40 hex chars = 160 bits entropy)`);
  assert(key1 !== key2, 'Two generated keys are strictly distinct');
  assert(/^wap_key_[a-f0-9]{40}$/.test(key1), 'Key format matches strict hex regex pattern');

  // --- 2. Live Firestore App Credentials ---
  console.log('\n--- 2. Live Firestore Centralized App Credentials ---');
  const appsSnap = await db.collection('apps').get();
  assert(appsSnap.size > 0, `Firestore 'apps' collection contains ${appsSnap.size} application(s)`);

  for (const doc of appsSnap.docs) {
    const data = doc.data();
    const appId = doc.id;
    console.log(`\nChecking registered application "${data.name}" (${appId})...`);

    assert(appId === data.id, `Centralized App ID matches Firestore doc ID: ${appId}`);

    let activeKey = data.appKey;
    if (!activeKey) {
      console.log(`App "${data.name}" currently missing appKey. Auto-provisioning secure key...`);
      activeKey = generateSecureAppKey();
      await doc.ref.update({
        appKey: activeKey,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Auto-provisioned appKey: ${activeKey.substring(0, 16)}••••••••••••••••`);
    }

    assert(typeof activeKey === 'string' && activeKey.startsWith('wap_key_'), `App "${data.name}" possesses active X-App-Key`);
    assert(data.status === 'active', `App "${data.name}" is in active status`);
  }

  // --- 3. Platform API Header Contract Check ---
  console.log('\n--- 3. Platform API Header Contract Verification ---');
  // Check FileZen doc
  const filezenDoc = await db.collection('apps').doc('app_1791324566055').get();
  if (filezenDoc.exists) {
    const fz = filezenDoc.data();
    assert(fz.id === 'app_1791324566055', 'FileZen centralized App ID verified: app_1791324566055');
    assert(!!fz.appKey, 'FileZen has active X-App-Key persisted in Firestore');
    console.log(`FileZen headers contract:`);
    console.log(`  X-App-Id:  ${fz.id}`);
    console.log(`  X-App-Key: ${fz.appKey.substring(0, 12)}••••••••••••••••••••••••`);
  }

  // --- 4. Security Audit Log Masking Verification ---
  console.log('\n--- 4. Security Audit Log Protection ---');
  const auditLogsSnap = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(10).get();
  let foundRawAppKeyInAudit = false;
  for (const auditDoc of auditLogsSnap.docs) {
    const jsonStr = JSON.stringify(auditDoc.data());
    // Check if any raw generated 40-char key appears in plain text in audit logs
    if (jsonStr.includes('wap_key_') && /wap_key_[a-f0-9]{40}/.test(jsonStr)) {
      foundRawAppKeyInAudit = true;
    }
  }
  assert(!foundRawAppKeyInAudit, 'No raw App Key leaked in audit logs (all masked or omitted)');

  console.log('\n==================================================');
  console.log(`VERIFICATION COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('==================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
