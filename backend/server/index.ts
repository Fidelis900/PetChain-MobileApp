import http from 'http';

import { createApp } from './app';
import { initWebsocket } from './websocket';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const server = http.createServer(app);

initWebsocket(server);

server.listen(PORT, () => {
  console.warn(`PetChain REST API listening on http://localhost:${PORT}/api`);
  console.warn(`Health check: http://localhost:${PORT}/api/health`);
  console.warn(`WebSocket endpoint: ws://localhost:${PORT}/ (upgrade with Authorization header)`);
});
