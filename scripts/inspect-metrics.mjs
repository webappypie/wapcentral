import { GoogleAuth } from 'google-auth-library';

async function test() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const queries = [
    'metric.type = "run.googleapis.com/container/cpu/utilizations" AND resource.type = "cloud_run_revision"',
    'metric.type = "run.googleapis.com/container/memory/utilizations" AND resource.type = "cloud_run_revision"',
    'metric.type = "run.googleapis.com/request_count" AND resource.type = "cloud_run_revision"',
  ];

  for (const filter of queries) {
    const params = new URLSearchParams({
      filter,
      'interval.startTime': oneHourAgo.toISOString(),
      'interval.endTime': now.toISOString(),
    });
    const url = `https://monitoring.googleapis.com/v3/projects/wapcentral-prod/timeSeries?${params.toString()}`;
    const res = await client.request({ url });
    console.log(`\n--- Metric: ${filter.split(' ')[2]} ---`);
    console.log(`Series count: ${res.data.timeSeries?.length || 0}`);
    if (res.data.timeSeries && res.data.timeSeries.length > 0) {
      const ts = res.data.timeSeries[0];
      console.log('Sample labels:', ts.metric.labels);
      console.log('Points count:', ts.points?.length);
      if (ts.points?.length > 0) {
        console.log('Latest point value:', JSON.stringify(ts.points[0].value, null, 2));
      }
    }
  }
}

test().catch(console.error);
