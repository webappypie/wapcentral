import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});
const db = getFirestore();

async function main() {
  console.log('=== APPS COLLECTION ===');
  const appsSnap = await db.collection('apps').get();
  console.log(`Found ${appsSnap.size} apps:`);
  for (const d of appsSnap.docs) {
    const data = d.data();
    console.log(`App Doc ID: ${d.id}, name: ${data.name}, appId: ${data.appId}`);
  }

  console.log('\n=== ALL NOTIFICATION DEVICES ===');
  const devSnap = await db.collection('notificationDevices').get();
  console.log(`Found ${devSnap.size} total devices:`);
  for (const d of devSnap.docs) {
    console.log(d.id, JSON.stringify(d.data(), null, 2));
  }

  console.log('\n=== RECENT DELIVERY LOGS (ALL) ===');
  const logSnap = await db.collection('notificationDeliveryLogs').orderBy('timestamp', 'desc').limit(20).get();
  console.log(`Found ${logSnap.size} delivery logs:`);
  for (const d of logSnap.docs) {
    console.log(d.id, JSON.stringify(d.data(), null, 2));
  }

  console.log('\n=== RECENT NOTIFICATION RECIPIENTS (ALL) ===');
  const recipSnap = await db.collection('notificationRecipients').orderBy('createdAt', 'desc').limit(20).get();
  console.log(`Found ${recipSnap.size} recipients:`);
  for (const d of recipSnap.docs) {
    console.log(d.id, JSON.stringify(d.data(), null, 2));
  }
}

main().catch(console.error);
