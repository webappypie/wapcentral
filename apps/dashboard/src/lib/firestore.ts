import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { app } from './firebase.js';

export const isTestEnv =
  (typeof process !== 'undefined' && !!process.env['VITEST']) || import.meta.env?.MODE === 'test';

export const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

export const isOfflineMode = isTestEnv && !isEmulator;

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Connect to Firestore and Storage Emulators if enabled
if (isEmulator) {
  const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080;
  const storageHost = import.meta.env.VITE_STORAGE_EMULATOR_HOST || '127.0.0.1';
  const storagePort = Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT) || 9199;

  try {
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
  } catch {
    // Emulator might already be connected
  }

  try {
    connectStorageEmulator(storage, storageHost, storagePort);
  } catch {
    // Emulator might already be connected
  }
}
