import http from 'http';

import { createApp } from './app';
import { checkDatabaseConnection, runMigrations } from '../config/database';

const PORT = Number(process.env.PORT) || 3000;

// ---- Graceful shutdown ---------------------------------------------------

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals, server: http.Server): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.warn(`[server] Received ${signal} — starting graceful shutdown`);

  server.close((err) => {
    if (err) {
      console.error('[server] Error while closing server:', err);
      process.exit(1);
    }
    console.warn('[server] All connections drained — exiting cleanly');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[server] Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 9_000).unref();
}

// ---- Startup -------------------------------------------------------------

async function start(): Promise<void> {
  // Verify DB connectivity before running migrations
  await checkDatabaseConnection();
  console.warn('[server] Database connection verified.');

  // Run pending migrations (idempotent, advisory-locked by node-pg-migrate)
  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);

  process.on('SIGTERM', () => shutdown('SIGTERM', server));
  process.on('SIGINT', () => shutdown('SIGINT', server));

  server.listen(PORT, () => {
    console.warn(`PetChain REST API listening on http://localhost:${PORT}/api`);
    console.warn(`Health:  http://localhost:${PORT}/api/health`);
    console.warn(`Ready:   http://localhost:${PORT}/api/ready`);
    if (process.send) process.send('ready');
  });
}

start().catch((err) => {
  console.error('[server] Startup failed:', err);
  process.exit(1);
});
