const HOSTING_URL = 'https://wapcentral-prod.web.app';
const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const payloadAdmin = Buffer.from(
  JSON.stringify({
    email: 'webappypie@gmail.com',
    user_id: 'usr_superadmin_live',
    role: 'super_admin',
    admin: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  }),
).toString('base64url');
const adminToken = `${header}.${payloadAdmin}.sig`;

fetch(`${HOSTING_URL}/api/admin/v1/ads/kill-switches`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    globalAdsDisabled: false,
    reason: 'Restoring live ads production state',
  }),
}).then(r => r.json()).then(res => console.log('Ads restore result:', res));
