const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';
const FILEZEN_ID = 'filezen';
const FILEZEN_KEY = 'wap_key_filezen_prod';

async function checkEvents() {
  const res = await fetch(`${CLOUD_RUN_URL}/api/platform/v1/notifications/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': FILEZEN_ID,
      'X-App-Key': FILEZEN_KEY,
    },
    body: JSON.stringify({
      appId: FILEZEN_ID,
      title: 'Document Processed',
      message: 'Your file has been organized.',
      category: 'CUSTOM',
      priority: 'high',
    }),
  });
  console.log('Status events:', res.status, await res.text());
}

checkEvents();
