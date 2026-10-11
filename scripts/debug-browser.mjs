import { spawn } from 'child_process';
import http from 'http';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9222;

const edgeProcess = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--no-sandbox',
  'https://wapcentral-prod.web.app',
]);

// Wait for debugging port to be ready
async function waitForPort() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Edge debugging port not ready');
}

try {
  const targets = await waitForPort();
  console.log('Targets:', targets);
  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('Connected to DevTools WS');
      // Enable Console, Network, Runtime
      ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Runtime.enable' }));
      resolve();
    };
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Console.messageAdded') {
      console.log('[BROWSER CONSOLE]', msg.params.message.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log(
        '[BROWSER CONSOLE API]',
        msg.params.type,
        msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ')
      );
    }
    if (msg.method === 'Network.responseReceived') {
      const url = msg.params.response.url;
      if (url.includes('firestore') || url.includes('identitytoolkit') || url.includes('token')) {
        console.log('[BROWSER NETWORK RESPONSE]', msg.params.response.status, url);
      }
    }
  };

  // Wait 10 seconds to collect logs
  await new Promise((r) => setTimeout(r, 10000));
} catch (err) {
  console.error(err);
} finally {
  edgeProcess.kill();
  process.exit(0);
}
