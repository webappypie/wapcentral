import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth';

const isTestEnv =
  (typeof process !== 'undefined' && !!process.env['VITEST']) ||
  import.meta.env.MODE === 'test';
const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isPlaceholderKey =
  !rawApiKey ||
  rawApiKey.toLowerCase().includes('placeholder') ||
  rawApiKey.toLowerCase().includes('demo');


// Enforce real, valid Firebase API key in live/production environments
if (!isTestEnv && !isEmulator && isPlaceholderKey) {
  throw new Error(
    'Firebase initialization failed: Missing or invalid VITE_FIREBASE_API_KEY. A valid production Firebase API key is required.',
  );
}

const firebaseConfig = {
  apiKey: rawApiKey || (isEmulator ? 'emulator-api-key' : isTestEnv ? 'test-api-key' : ''),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (isEmulator ? 'wapcentral-dev.firebaseapp.com' : 'wapcentral-prod.firebaseapp.com'),
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    (isEmulator ? 'wapcentral-dev' : 'wapcentral-prod'),
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (isEmulator ? 'wapcentral-dev.firebasestorage.app' : 'wapcentral-prod.firebasestorage.app'),
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    (isEmulator ? '1234567890' : '174781611765'),
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    (isEmulator ? '1:1234567890:web:abcdef' : '1:174781611765:web:fd2507096f735e053e4fbc'),
};

// Initialize Firebase once
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const auth: Auth = getAuth(app);

// Connect to Auth Emulator if enabled
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  try {
    connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
  } catch {
    // Emulator might already be connected
  }
}
