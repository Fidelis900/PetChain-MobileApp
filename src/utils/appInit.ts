import { startNetworkMonitoring } from './networkMonitor';
import { runMigrations } from '../migrations/migrationRunner';
import { requestPermissions } from '../services/notificationService';

export interface InitResult {
  ready: boolean;
  durationMs: number;
}

/**
 * Run only what is strictly required before the first screen renders.
 * Everything else is deferred to after the UI is interactive.
 */
async function runCriticalInit(): Promise<void> {
  // Network monitor is lightweight — start it synchronously
  startNetworkMonitoring();

  // Run any pending data migrations before the UI renders
  const result = await runMigrations();
  if (!result.success) {
    // Log but do not crash — app can still function on the last good version
    console.warn('[migrations] failed:', result.error);
  }
}

/**
 * Non-critical work deferred until after the app is interactive.
 * Failures here must never crash or block the UI.
 */
async function runDeferredInit(): Promise<void> {
  const tasks: Array<() => Promise<void>> = [
    async () => {
      await requestPermissions();
    },
  ];

  // Fire all deferred tasks in parallel, swallow individual failures
  await Promise.allSettled(tasks.map((t) => t()));
}

/**
 * Call this once at app startup (e.g. in App.tsx before rendering).
 * Returns when critical init is done; deferred work runs in the background.
 */
export async function initApp(): Promise<InitResult> {
  const start = Date.now();

  await runCriticalInit();

  const durationMs = Date.now() - start;

  // Kick off deferred work without awaiting — does not block render
  setTimeout(() => {
    runDeferredInit().catch(() => {
      // Silently swallow — deferred failures must not surface to the user
    });
  }, 0);

  return { ready: true, durationMs };
}
