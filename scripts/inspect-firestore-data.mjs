import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const db = getFirestore(app);

async function inspectFirestore() {
  console.log('=== Inspecting collections in wapcentral-prod ===');
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} collections:`);
  for (const col of collections) {
    const snap = await col.get();
    console.log(`- Collection "${col.id}": ${snap.size} documents`);
    for (const doc of snap.docs) {
      console.log(`   Doc ID: ${doc.id}`);
      if (col.id === 'apps' || col.id === 'roles') {
        console.log(`   Data:`, JSON.stringify(doc.data(), null, 2));
      }
    }
  }
}

inspectFirestore().catch(console.error);
