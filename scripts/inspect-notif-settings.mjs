import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});
const db = getFirestore();

async function inspect() {
  const snap = await db.collection('notificationSettings').doc('global').get();
  console.log('notificationSettings global exists:', snap.exists);
  if (snap.exists) {
    console.log('notificationSettings data:', snap.data());
  }

  const appSnap = await db.collection('apps').doc('filezen').get();
  console.log('apps filezen data:', appSnap.data());
}

inspect();
