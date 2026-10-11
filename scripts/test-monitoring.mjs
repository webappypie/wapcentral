import { GoogleAuth } from 'google-auth-library';

async function test() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const filter = 'metric.type = "run.googleapis.com/request_count" AND resource.type = "cloud_run_revision"';
    const params = new URLSearchParams({
      filter: filter,
      'interval.startTime': oneHourAgo.toISOString(),
      'interval.endTime': now.toISOString(),
    });
    const url = `https://monitoring.googleapis.com/v3/projects/wapcentral-prod/timeSeries?${params.toString()}`;
    const res = await client.request({ url });
    console.log('Monitoring timeSeries items:', res.data.timeSeries?.length || 0);
  } catch (e) {
    console.log('Monitoring query error:', e.message);
  }
}

test().catch(console.error);
