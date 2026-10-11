import { initializeApp as initClient } from 'firebase/app';
import { getAuth as getClientAuth } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('apps/dashboard/.env.production', 'utf8');
const apiKeyMatch = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const clientApp = initClient({
  apiKey: apiKey,
  authDomain: 'wapcentral-prod.firebaseapp.com',
  projectId: 'wapcentral-prod',
  storageBucket: 'wapcentral-prod.firebasestorage.app',
  messagingSenderId: '174781611765',
  appId: '1:174781611765:web:fd2507096f735e053e4fbc',
});

const clientAuth = getClientAuth(clientApp);
const clientDb = getFirestore(clientApp);

console.log('--- TEST 1: onSnapshot on /apps WITHOUT auth ---');
const colRef = collection(clientDb, 'apps');
const q = query(colRef, orderBy('createdAt', 'desc'));

await new Promise((resolve) => {
  const unsub = onSnapshot(
    q,
    (snap) => {
      console.log(`[Without Auth] SUCCESS: received ${snap.size} docs. Empty? ${snap.empty}`);
      for (const d of snap.docs) {
        console.log(`  - doc: ${d.id}`);
      }
      unsub();
      resolve();
    },
    (err) => {
      console.log(`[Without Auth] ERROR: code=${err.code}, message=${err.message}`);
      unsub();
      resolve();
    }
  );
});

process.exit(0);
