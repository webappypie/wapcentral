import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const envContent = fs.readFileSync('apps/dashboard/.env.production', 'utf8');
const apiKeyMatch = envContent.match(/VITE_FIREBASE_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const auth = getAuth(app);

// Get the super admin user
const user = await auth.getUserByEmail('webappypie@gmail.com');
console.log('Found user UID:', user.uid);

// Create custom token with super_admin claim
const customToken = await auth.createCustomToken(user.uid, {
  role: 'super_admin',
  admin: true,
});

// Exchange custom token for ID token
const tokenRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);

const tokenData = await tokenRes.json();
const idToken = tokenData.idToken;
console.log('Obtained ID token successfully.');

// Query /api/admin/v1/ai/providers through Firebase Hosting proxy
const providersUrl = 'https://wapcentral-prod.web.app/api/admin/v1/ai/providers';
const res = await fetch(providersUrl, {
  headers: {
    Authorization: `Bearer ${idToken}`,
  },
});

console.log('Status:', res.status);
const data = await res.json();
console.log('Body:', JSON.stringify(data, null, 2));

process.exit(0);
