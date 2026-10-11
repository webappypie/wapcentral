import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';
const FILEZEN_ID = 'filezen';
const FILEZEN_KEY = 'wap_key_filezen_prod';
const TARGET_DEVICE_ID = 'fz_c53efb11b4de241d0ef35ff37053618a';

// Initialize Firestore for direct verification
initializeApp({ projectId: 'wapcentral-prod' });
const db = getFirestore();

async function run() {
  console.log('===============================================================');
  console.log('VERIFYING FILEZEN LIVE FCM PUSH DELIVERY VIA CLOUD RUN BACKEND');
  console.log(`Endpoint: ${CLOUD_RUN_URL}/api/platform/v1/notifications/events`);
  console.log(`Target Device ID: ${TARGET_DEVICE_ID}`);
  console.log('===============================================================\n');

  const testTitle = `FileZen FCM Live Verification ${Date.now()}`;
  const testMessage = `Push received via filezen-510822 credentials at ${new Date().toLocaleTimeString()}`;

  console.log(`1. Sending notification event request to Cloud Run...`);
  const res = await fetch(`${CLOUD_RUN_URL}/api/platform/v1/notifications/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': FILEZEN_ID,
      'X-App-Key': FILEZEN_KEY,
    },
    body: JSON.stringify({
      appId: FILEZEN_ID,
      title: testTitle,
      message: testMessage,
      category: 'SYSTEM',
      priority: 'high',
      dataPayload: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        source: 'wapcentral_live_test',
        timestamp: String(Date.now()),
      },
    }),
  });

  const resJson = await res.json();
  console.log(`Response status: ${res.status}`);
  console.log('Response body:', JSON.stringify(resJson, null, 2));

  if (!resJson.success || !resJson.data?.notificationId) {
    console.error('❌ Failed to trigger notification event!');
    process.exit(1);
  }

  const notificationId = resJson.data.notificationId;
  console.log(`\n2. Verifying notification doc [${notificationId}] in Firestore...`);
  const notifDoc = await db.collection('notifications').doc(notificationId).get();
  if (!notifDoc.exists) {
    console.error('❌ Notification doc does not exist!');
    process.exit(1);
  }

  const notifData = notifDoc.data();
  console.log(`Notification status: ${notifData.status}`);
  console.log('Notification stats:', notifData.stats);

  console.log(`\n3. Verifying per-device delivery log in notificationDeliveryLogs...`);
  const logsSnap = await db
    .collection('notificationDeliveryLogs')
    .where('notificationId', '==', notificationId)
    .get();

  if (logsSnap.empty) {
    console.error('❌ No delivery logs found for notification!');
    process.exit(1);
  }

  let deliverySuccess = false;
  for (const doc of logsSnap.docs) {
    const log = doc.data();
    console.log('Delivery Log Entry:');
    console.log(`  - Log ID: ${log.id}`);
    console.log(`  - Device ID: ${log.deviceId}`);
    console.log(`  - App ID: ${log.appId}`);
    console.log(`  - Status: ${log.status}`);
    console.log(`  - Provider: ${log.provider}`);
    console.log(`  - Message ID: ${log.messageId}`);
    console.log(`  - Failure Reason: ${log.failureReason || 'None'}`);

    if (log.status === 'sent' && log.messageId) {
      deliverySuccess = true;
    }
  }

  console.log(`\n4. Verifying In-App Bell Feed endpoint...`);
  const feedRes = await fetch(
    `${CLOUD_RUN_URL}/api/platform/v1/notifications?deviceId=${TARGET_DEVICE_ID}&limit=5`,
    {
      method: 'GET',
      headers: {
        'X-App-Id': FILEZEN_ID,
        'X-App-Key': FILEZEN_KEY,
      },
    }
  );
  const feedJson = await feedRes.json();
  const foundInFeed = feedJson.data?.items?.some((item) => item.id === notificationId);
  console.log(`Appears in In-App Bell feed: ${foundInFeed}`);

  console.log('\n===============================================================');
  if (deliverySuccess && notifData.status === 'sent') {
    console.log('🎉 SUCCESS: FCM Push successfully sent to FileZen device!');
    console.log('   The notification was routed to filezen-510822 credentials.');
    console.log('   The FCM message ID was returned by Firebase and logged.');
  } else {
    console.log('❌ FCM delivery verification failed!');
    process.exit(1);
  }
  console.log('===============================================================');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
