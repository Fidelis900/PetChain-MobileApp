import http from 'http';

import { createApp } from './app';
import logger from '../utils/logger';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const server = http.createServer(app);

// ---- Graceful shutdown ---------------------------------------------------
//
// When PM2 (or any supervisor) sends SIGINT / SIGTERM it expects in-flight
// requests to finish within `kill_timeout` before the process is hard-killed.
// We stop accepting new connections immediately, then wait for the existing
// ones to drain before exiting.

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal} — starting graceful shutdown`);

  server.close((err) => {
    if (err) {
      logger.error('Error while closing server', { error: err.message });
      process.exit(1);
    }
    logger.info('All connections drained — exiting cleanly');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 9_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ---- Startup -------------------------------------------------------------

server.listen(PORT, () => {
  logger.info(`PetChain REST API listening on http://localhost:${PORT}/api`);
  logger.info(`Health:  http://localhost:${PORT}/api/health`);
  logger.info(`Ready:   http://localhost:${PORT}/api/ready`);

  if (process.send) process.send('ready');
});
