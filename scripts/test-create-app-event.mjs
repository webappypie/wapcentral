import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createApplicationEvent } from '../services/admin-api/dist/services/notificationService.js';

initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});
getFirestore().settings({ ignoreUndefinedProperties: true });

async function run() {
  try {
    const res = await createApplicationEvent('filezen', {
      appId: 'filezen',
      title: 'Document Processed',
      message: 'Your file has been organized.',
      category: 'CUSTOM',
      priority: 'high',
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('CAUGHT ERROR:', err);
  }
}

run();
