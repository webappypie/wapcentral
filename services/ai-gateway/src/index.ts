import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[ai-gateway] Server running on port ${config.port} (${config.environment})`);
});

export { app };
