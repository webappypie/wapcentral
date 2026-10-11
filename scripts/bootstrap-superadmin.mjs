#!/usr/bin/env node
/**
 * scripts/bootstrap-superadmin.mjs
 *
 * Production-Grade Super Admin Provisioner for WebAppyPie Central (WAPCentral).
 *
 * Requirements & Architecture:
 * - Uses Firebase Admin SDK with Google Cloud Application Default Credentials (ADC),
 *   service-account environment variables (GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_KEY),
 *   or local Firebase Emulator (--emulator).
 * - Zero client API-key fallback in production. Administrative operations strictly require
 *   Google Cloud Admin authority.
 * - Proactively verifies ADC credentials with project 'wapcentral-prod' and stops with a clear,
 *   actionable error if credentials are missing or invalid.
 * - Automatically provisions/updates:
 *     1. Firebase Auth user (creates or synchronizes credentials)
 *     2. Custom Auth Claims: { role: 'super_admin', admin: true }
 *     3. Firestore document: /roles/{uid} with:
 *        { role: 'super_admin', email: '<admin email>', updatedAt: FieldValue.serverTimestamp() }
 * - Reads back and verifies /roles/{uid} in Firestore.
 * - Never prints passwords, secrets, API keys, or private keys.
 * - Safe TTY prompt handling on Windows without hanging or libuv handle closure assertions.
 * - Supports non-interactive automated provisioning via SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeApp, deleteApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment files if present (.env.local > .env.production > .env)
const candidateEnvFiles = [
  path.join(rootDir, '.env.local'),
  path.join(rootDir, '.env.production'),
  path.join(rootDir, '.env'),
];

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

const args = process.argv.slice(2);
const isEmulator =
  args.includes('--emulator') ||
  process.env.USE_FIREBASE_EMULATOR === 'true';

let projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'wapcentral-prod';

if (isEmulator && !projectId.startsWith('demo-')) {
  projectId = `demo-${projectId}`;
}

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

let pipedLinesQueue = null;

async function getNextPipedLine() {
  if (pipedLinesQueue === null) {
    if (process.stdin.destroyed || process.stdin.readableEnded) {
      pipedLinesQueue = [];
      return '';
    }
    const chunks = [];
    const readStdinPromise = (async () => {
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8');
    })();
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(''), 1500));
    const fullText = await Promise.race([readStdinPromise, timeoutPromise]);
    pipedLinesQueue = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  return pipedLinesQueue.shift() || '';
}

/**
 * Safely prompt for text via readline.
 */
function promptText(query) {
  if (!process.stdin.isTTY) {
    return getNextPipedLine();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Safely prompt for password with masked characters.
 * Ensures raw mode is cleanly disabled before returning to prevent Windows libuv assertion errors.
 * Never echoes or logs password.
 */
function promptPassword(query) {
  if (!process.stdin.isTTY) {
    return getNextPipedLine();
  }

  return new Promise((resolve) => {
    process.stdout.write(query);
    let password = '';

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY && process.stdin.isRaw) {
        try {
          process.stdin.setRawMode(false);
        } catch {
          // ignore cleanup errors
        }
      }
      process.stdin.pause();
    };

    const onData = (chunk) => {
      const str = chunk.toString('utf8');
      for (const char of str) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          resolve(password.trim());
          return;
        } else if (char === '\u0003') {
          // Ctrl+C
          cleanup();
          process.stdout.write('\nOperation cancelled by user.\n');
          process.exitCode = 130;
          resolve('');
          return;
        } else if (char === '\u0008' || char === '\x7f') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += char;
        }
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
WAPCentral Super Admin Bootstrap Provisioner
---------------------------------------------
Usage:
  node scripts/bootstrap-superadmin.mjs [options]
  pnpm bootstrap:admin [options]

Options:
  --emulator    Target local Firebase Emulator suite (ports 9099 / 8080)
  --help, -h    Show this help message

Authentication (Production Cloud):
  Google Cloud Application Default Credentials (ADC) or Service Account:
    1. ADC: Run 'gcloud auth application-default login'
    2. Path: Set GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
    3. JSON: Set FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

Environment Variables (Optional):
  SUPER_ADMIN_EMAIL       Email for the Super Admin (skips interactive prompt)
  SUPER_ADMIN_PASSWORD    Password for the Super Admin (min 8 chars, skips prompt)
  FIREBASE_PROJECT_ID     Firebase / GCP project ID (default: 'wapcentral-prod')
`);
    return;
  }

  console.log('============================================================');
  console.log(' WAPCentral Super Admin Bootstrap Provisioner');
  console.log(` Target Mode: ${isEmulator ? 'Firebase Local Emulator' : 'Firebase Production Cloud (Firebase Admin SDK)'}`);
  console.log(` Project ID:  ${projectId}`);
  console.log('============================================================\n');

  console.log(`⏳ Initializing Firebase Admin SDK connection for project: ${projectId}...`);

  let app;
  let credential;

  try {
    if (isEmulator) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
      process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
      process.env.GCLOUD_PROJECT = projectId;
      app = initializeApp({ projectId }, 'wapcentral-bootstrap');
      console.log(` Connected to Firebase Emulator (Auth: ${authHost}, Firestore: ${firestoreHost})`);
    } else {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          credential = cert(serviceAccount);
          console.log(` Authenticating with FIREBASE_SERVICE_ACCOUNT_KEY`);
        } catch (jsonErr) {
          console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON:', jsonErr.message);
          process.exitCode = 1;
          return;
        }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        if (!fs.existsSync(credPath)) {
          console.error(`❌ GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
          process.exitCode = 1;
          return;
        }
        credential = applicationDefault();
        console.log(` Authenticating with GOOGLE_APPLICATION_CREDENTIALS file: ${credPath}`);
      } else {
        credential = applicationDefault();
        console.log(` Authenticating with Google Cloud Application Default Credentials (ADC)`);
      }

      // Proactively verify credential can acquire an access token
      console.log('⏳ Verifying Google Cloud credentials with OAuth2 endpoint...');
      try {
        const tokenPromise = credential.getAccessToken();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timed out waiting for Google Cloud credentials. Metadata service unreachable.')), 5000)
        );
        const tokenResult = await Promise.race([tokenPromise, timeoutPromise]);
        if (!tokenResult || !tokenResult.access_token) {
          throw new Error('Credential did not return an access token.');
        }
        console.log('✅ Google Cloud Admin credentials successfully verified.');
      } catch (authErr) {
        console.error('\n❌ Google Cloud ADC / Admin SDK Initialization Error:');
        console.error(`   ${authErr.message}\n`);
        console.error('Actionable Steps to Provide Production Google Cloud Admin Credentials:');
        console.error('  1. Login with Google Cloud Application Default Credentials (ADC):');
        console.error('     gcloud auth application-default login\n');
        console.error('  2. Or set GOOGLE_APPLICATION_CREDENTIALS to a local service-account key:');
        console.error('     $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\path\\to\\service-account.json"\n');
        console.error('  3. Or pass service-account JSON via FIREBASE_SERVICE_ACCOUNT_KEY:');
        console.error('     $env:FIREBASE_SERVICE_ACCOUNT_KEY = \'{"type":"service_account",...}\'\n');
        console.error('  4. Or test against the local emulator suite:');
        console.error('     pnpm bootstrap:admin --emulator\n');
        process.exitCode = 1;
        return;
      }

      app = initializeApp({ credential, projectId }, 'wapcentral-bootstrap');
    }
  } catch (initErr) {
    console.error('\n❌ Admin SDK Initialization Error:', initErr.message);
    process.exitCode = 1;
    return;
  }

  // Obtain Super Admin credentials
  let email = (process.env.SUPER_ADMIN_EMAIL || '').trim();
  let password = (process.env.SUPER_ADMIN_PASSWORD || '').trim();

  if (!email) {
    email = await promptText('Enter Super Admin Email: ');
  }

  if (process.exitCode === 130) return;

  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exitCode = 1;
    return;
  }

  if (!password) {
    password = await promptPassword('Enter Super Admin Password (min 8 chars): ');
  }

  if (process.exitCode === 130) return;

  if (!password || password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long.');
    process.exitCode = 1;
    return;
  }

  try {
    const auth = getAuth(app);
    const db = getFirestore(app);

    console.log(`\n⏳ Provisioning/verifying Super Admin in Firebase Auth: ${email}...`);
    let uid = null;

    try {
      const existingUser = await auth.getUserByEmail(email);
      uid = existingUser.uid;
      await auth.updateUser(uid, {
        password,
        emailVerified: true,
        displayName: 'Super Admin',
      });
      console.log(`✅ Firebase Auth user verified & credentials synchronized. UID: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email,
          password,
          emailVerified: true,
          displayName: 'Super Admin',
        });
        uid = newUser.uid;
        console.log(`✅ Firebase Auth user created successfully. UID: ${uid}`);
      } else {
        throw authErr;
      }
    }

    if (!uid) {
      throw new Error('Failed to resolve Firebase Auth UID.');
    }

    // Set custom claims on Firebase Auth
    console.log(`⏳ Setting custom claims for UID: ${uid}...`);
    await auth.setCustomUserClaims(uid, {
      role: 'super_admin',
      admin: true,
    });
    console.log(`✅ Custom claims applied: { role: 'super_admin', admin: true }`);

    // Provision Firestore RBAC role document using Admin SDK
    console.log(`⏳ Provisioning Firestore role document: /roles/${uid}...`);
    const roleDocRef = db.collection('roles').doc(uid);
    const roleData = {
      role: 'super_admin',
      email,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await roleDocRef.set(roleData, { merge: true });

    // Verify written role document in Firestore
    const snap = await roleDocRef.get();
    if (snap.exists && snap.data()?.role === 'super_admin') {
      console.log(`✅ Firestore RBAC role document verified in database:`);
      console.log(`   Document: /roles/${uid}`);
      console.log(`   Role:     ${snap.data()?.role}`);
      console.log(`   Email:    ${snap.data()?.email}`);
    } else {
      throw new Error(`Verification failed: /roles/${uid} does not contain role: 'super_admin'.`);
    }

    console.log('\n============================================================');
    console.log('🎉 Super Admin Production Bootstrap Complete!');
    console.log(` Email:  ${email}`);
    console.log(` UID:    ${uid}`);
    console.log(` Role:   super_admin (Full System Authority)`);
    console.log(` Target: ${isEmulator ? 'Local Emulator' : projectId}`);
    console.log('============================================================\n');
  } catch (err) {
    console.error('\n❌ Bootstrap failed during provisioning:');
    console.error(`   Code:    ${err.code || 'UNKNOWN'}`);
    console.error(`   Message: ${err.message}\n`);
    if (err.message && err.message.includes('Could not load the default credentials')) {
      console.error('Google Cloud ADC credentials were not found on this machine.');
      console.error('To authenticate, run:');
      console.error('  gcloud auth application-default login\n');
    } else if (err.code === 'auth/insufficient-permission' || (err.message && err.message.includes('insufficient permission'))) {
      console.error('The active Google Cloud identity does not have administrative permissions on project:', projectId);
      console.error('Ensure your GCP identity has Firebase Admin / Cloud Datastore User role on wapcentral-prod.\n');
    }
    process.exitCode = 1;
  } finally {
    if (app) {
      try {
        await deleteApp(app);
      } catch {
        // ignore delete app errors
      }
    }
  }
}

main().catch((e) => {
  console.error('\n❌ Fatal unhandled error:', e.message || e);
  process.exitCode = 1;
});
