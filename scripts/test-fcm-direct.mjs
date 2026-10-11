import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

async function testFcm() {
  try {
    const messaging = getMessaging();
    const res = await messaging.sendEachForMulticast({
      tokens: ['fcm_smoke_test_token_verification_only'],
      notification: { title: 'Test', body: 'Body' },
    });
    console.log('FCM Success:', res);
  } catch (err) {
    console.error('FCM Error:', err);
  }
}

testFcm();
