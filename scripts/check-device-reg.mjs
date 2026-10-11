const CLOUD_RUN_URL = 'https://wapcentral-admin-api-174781611765.asia-south1.run.app';
const FILEZEN_ID = 'filezen';
const FILEZEN_KEY = 'wap_key_filezen_prod';

async function check() {
  const testDeviceId = `dev_smoke_${Date.now()}`;
  const res = await fetch(`${CLOUD_RUN_URL}/api/platform/v1/notifications/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': FILEZEN_ID,
      'X-App-Key': FILEZEN_KEY,
    },
    body: JSON.stringify({
      deviceId: testDeviceId,
      fcmToken: 'fcm_smoke_test_token_verification_only',
      platform: 'android',
      appVersion: '2.1.0',
      deviceModel: 'SmokeTestDevice',
      osVersion: 'Android 14',
    }),
  });
  console.log('Status without appId:', res.status, await res.text());

  const res2 = await fetch(`${CLOUD_RUN_URL}/api/platform/v1/notifications/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': FILEZEN_ID,
      'X-App-Key': FILEZEN_KEY,
    },
    body: JSON.stringify({
      appId: FILEZEN_ID,
      deviceId: testDeviceId,
      fcmToken: 'fcm_smoke_test_token_verification_only',
      platform: 'android',
      appVersion: '2.1.0',
      deviceModel: 'SmokeTestDevice',
      osVersion: 'Android 14',
    }),
  });
  console.log('Status with appId:', res2.status, await res2.text());
}

check();
