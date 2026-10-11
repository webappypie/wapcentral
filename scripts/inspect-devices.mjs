import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});
const db = getFirestore();

async function inspectDevices() {
  const snap = await db.collection('notificationDevices').get();
  console.log('Total devices:', snap.size);
  snap.docs.forEach((d) => console.log(d.id, d.data()));
}

inspectDevices();
