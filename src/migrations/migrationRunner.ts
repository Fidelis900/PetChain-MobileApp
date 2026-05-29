import v1 from './scripts/v1_baseline';
import v2 from './scripts/v2_medication_fields';
import v3 from './scripts/v3_resilient_init';
import v4 from './scripts/v4_health_metrics';
import v5 from './scripts/v5_sync_queue';
import type { Migration, MigrationRecord, MigrationResult } from './types';
import { getItem, setItem } from '../services/localDB';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new migrations here in ascending version order.
const ALL_MIGRATIONS: Migration[] = [v1, v2, v3, v4, v5];

const MIGRATION_LOG_KEY = '@migration_log';
const SCHEMA_VERSION_KEY = '@schema_version';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getLog(): Promise<MigrationRecord[]> {
  const raw = await getItem(MIGRATION_LOG_KEY);
  return raw ? (JSON.parse(raw) as MigrationRecord[]) : [];
}

async function saveLog(log: MigrationRecord[]): Promise<void> {
  await setItem(MIGRATION_LOG_KEY, JSON.stringify(log));
}

async function getCurrentVersion(): Promise<number> {
  const raw = await getItem(SCHEMA_VERSION_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

async function saveVersion(version: number): Promise<void> {
  await setItem(SCHEMA_VERSION_KEY, String(version));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pending migrations in ascending version order.
 * Safe to call on every app start — already-applied migrations are skipped.
 */
export async function runMigrations(): Promise<MigrationResult> {
  const currentVersion = await getCurrentVersion();
  const log = await getLog();
  const appliedVersions = new Set(log.map((r) => r.version));

  const pending = ALL_MIGRATIONS.filter(
    (m) => m.version > currentVersion || !appliedVersions.has(m.version),
  ).sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    return { success: true, migrationsRun: 0, currentVersion };
  }

  let lastApplied = currentVersion;

  for (const migration of pending) {
    try {
      await migration.up();

      log.push({
        version: migration.version,
        appliedAt: Date.now(),
        description: migration.description,
      });

      lastApplied = migration.version;
      await saveVersion(lastApplied);
      await saveLog(log);
    } catch (err) {
      // Attempt rollback of the failed migration only
      try {
        await migration.down();
      } catch {
        // Rollback failure is logged but does not mask the original error
      }

      return {
        success: false,
        migrationsRun: pending.indexOf(migration),
        currentVersion: lastApplied,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: true,
    migrationsRun: pending.length,
    currentVersion: lastApplied,
  };
}

/**
 * Roll back to a specific target version by running `down()` in reverse order.
 * Useful for emergency recovery or testing.
 */
export async function rollbackTo(targetVersion: number): Promise<MigrationResult> {
  const currentVersion = await getCurrentVersion();

  if (targetVersion >= currentVersion) {
    return { success: true, migrationsRun: 0, currentVersion };
  }

  const toRollback = ALL_MIGRATIONS.filter(
    (m) => m.version > targetVersion && m.version <= currentVersion,
  ).sort((a, b) => b.version - a.version); // descending

  let lastVersion = currentVersion;

  for (const migration of toRollback) {
    try {
      await migration.down();

      const log = await getLog();
      await saveLog(log.filter((r) => r.version !== migration.version));

      lastVersion = migration.version - 1;
      await saveVersion(lastVersion);
    } catch (err) {
      return {
        success: false,
        migrationsRun: toRollback.indexOf(migration),
        currentVersion: lastVersion,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: true,
    migrationsRun: toRollback.length,
    currentVersion: lastVersion,
  };
}

/**
 * Returns the full migration history log.
 */
export async function getMigrationLog(): Promise<MigrationRecord[]> {
  return getLog();
}

/**
 * Returns the current schema version number.
 */
export { getCurrentVersion };
