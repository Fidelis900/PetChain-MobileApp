import path from 'path';

import { runner } from 'node-pg-migrate';
import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/petchain';

// ── Connection pool ────────────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

// ── Migration runner ───────────────────────────────────────────────────────────

export interface PostgresMigrationOptions {
  migrationsDir?: string;
  databaseUrl?: string;
}

/**
 * Run all pending UP migrations using node-pg-migrate.
 * Safe to call on every server startup — already-applied migrations are skipped.
 * Uses an advisory lock internally so concurrent startups don't race.
 */
let _pgMigrationsInFlight: Promise<void> | null = null;

export async function runMigrations({
  migrationsDir,
  databaseUrl,
}: PostgresMigrationOptions = {}): Promise<void> {
  if (_pgMigrationsInFlight) return _pgMigrationsInFlight;

  const dir = migrationsDir || path.resolve(__dirname, '..', 'migrations');
  const dbUrl = databaseUrl || process.env.DATABASE_URL || DATABASE_URL;

  console.warn('[db] Running pending PostgreSQL migrations…');

  _pgMigrationsInFlight = (async () => {
    try {
      await runner({
        databaseUrl: dbUrl,
        dir,
        direction: 'up',
        migrationsTable: 'schema_migrations',
        log: (msg: string) => console.warn('[db:migrate]', msg),
      });

      console.warn('[db] Migrations complete.');
    } finally {
      _pgMigrationsInFlight = null;
    }
  })();

  return _pgMigrationsInFlight;
}

/**
 * Roll back the last N migrations (default 1).
 */
export async function rollbackMigrations(
  count = 1,
  { migrationsDir, databaseUrl }: PostgresMigrationOptions = {},
): Promise<void> {
  const dir = migrationsDir || path.resolve(__dirname, '..', 'migrations');
  const dbUrl = databaseUrl || process.env.DATABASE_URL || DATABASE_URL;

  console.warn(`[db] Rolling back ${count} migration(s)…`);

  await runner({
    databaseUrl: dbUrl,
    dir,
    direction: 'down',
    count,
    migrationsTable: 'schema_migrations',
    log: (msg: string) => console.warn('[db:rollback]', msg),
  });

  console.warn('[db] Rollback complete.');
}

/**
 * Verify the database connection is healthy.
 */
export async function checkDatabaseConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}
