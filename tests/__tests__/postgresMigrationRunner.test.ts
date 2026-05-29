import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client } from 'pg';
import { runMigrations, rollbackMigrations } from '../../backend/config/database';

const BASE_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

function createMigrationFile(
  migrationsDir: string,
  fileName: string,
  upSql: string,
  downSql: string,
): void {
  fs.writeFileSync(
    path.join(migrationsDir, fileName),
    `-- up migration\n${upSql}\n\n-- down migration\n${downSql}\n`,
    'utf8',
  );
}

async function createDatabase(dbName: string): Promise<void> {
  const client = new Client({ connectionString: BASE_DATABASE_URL });
  client.on('error', () => {});
  await client.connect();
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();
}

async function dropDatabase(dbName: string): Promise<void> {
  const client = new Client({ connectionString: BASE_DATABASE_URL });
  client.on('error', () => {});
  await client.connect();
  const safeName = dbName.replace(/"/g, '""');
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${safeName}' AND pid <> pg_backend_pid()`,
    );
    await client.query(`DROP DATABASE IF EXISTS "${safeName}" WITH (FORCE)`);
  } catch {
    // Ignore cleanup failures when connections are already terminating.
  } finally {
    await client.end().catch(() => {});
  }
}

async function withTestDb<T>(callback: (databaseUrl: string, migrationsDir: string) => Promise<T>): Promise<T> {
  const migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petchain-postgres-migrations-'));
  const dbName = `petchain_migration_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  await createDatabase(dbName);
  const url = new URL(BASE_DATABASE_URL);
  url.pathname = `/${dbName}`;
  const databaseUrl = url.toString();

  try {
    return await callback(databaseUrl, migrationsDir);
  } finally {
    await dropDatabase(dbName);
    fs.rmSync(migrationsDir, { recursive: true, force: true });
  }
}

describe('PostgreSQL migration runner', () => {
  test('applies migrations and records migration history', async () => {
    await withTestDb(async (databaseUrl, migrationsDir) => {
      createMigrationFile(
        migrationsDir,
        '20260101000001000_create_test_table.sql',
        `CREATE TABLE test_migration_table (id SERIAL PRIMARY KEY);`,
        `DROP TABLE IF EXISTS test_migration_table;`,
      );
      createMigrationFile(
        migrationsDir,
        '20260101000002000_add_name_column.sql',
        `ALTER TABLE test_migration_table ADD COLUMN name TEXT;`,
        `ALTER TABLE test_migration_table DROP COLUMN IF EXISTS name;`,
      );

      await runMigrations({ databaseUrl, migrationsDir });

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      const result = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
      await client.end();

      expect(result.rows.map((row) => row.version)).toEqual([
        '20260101000001000',
        '20260101000002000',
      ]);
    });
  });

  test('rolls back the last migration and updates migration history', async () => {
    await withTestDb(async (databaseUrl, migrationsDir) => {
      createMigrationFile(
        migrationsDir,
        '20260101000001000_create_test_table.sql',
        `CREATE TABLE test_migration_table (id SERIAL PRIMARY KEY);`,
        `DROP TABLE IF EXISTS test_migration_table;`,
      );
      createMigrationFile(
        migrationsDir,
        '20260101000002000_add_name_column.sql',
        `ALTER TABLE test_migration_table ADD COLUMN name TEXT;`,
        `ALTER TABLE test_migration_table DROP COLUMN IF EXISTS name;`,
      );

      await runMigrations({ databaseUrl, migrationsDir });
      await rollbackMigrations(1, { databaseUrl, migrationsDir });

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      const history = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
      const columnInfo = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'test_migration_table' AND column_name = 'name';",
      );
      await client.end();

      expect(history.rows.map((row) => row.version)).toEqual(['20260101000001000']);
      expect(columnInfo.rowCount).toBe(0);
    });
  });

  test('prevents duplicate concurrent migration runs', async () => {
    await withTestDb(async (databaseUrl, migrationsDir) => {
      createMigrationFile(
        migrationsDir,
        '20260101000001000_create_test_table.sql',
        `CREATE TABLE test_migration_table (id SERIAL PRIMARY KEY);`,
        `DROP TABLE IF EXISTS test_migration_table;`,
      );
      createMigrationFile(
        migrationsDir,
        '20260101000002000_add_name_column.sql',
        `ALTER TABLE test_migration_table ADD COLUMN name TEXT;`,
        `ALTER TABLE test_migration_table DROP COLUMN IF EXISTS name;`,
      );

      const results = await Promise.all([
        runMigrations({ databaseUrl, migrationsDir }),
        runMigrations({ databaseUrl, migrationsDir }),
      ]);

      expect(results).toEqual([undefined, undefined]);

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      const history = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
      await client.end();

      expect(history.rows.map((row) => row.version)).toEqual([
        '20260101000001000',
        '20260101000002000',
      ]);
    });
  });

  test('fails cleanly on invalid migration and preserves applied history', async () => {
    await withTestDb(async (databaseUrl, migrationsDir) => {
      createMigrationFile(
        migrationsDir,
        '20260101000001000_create_test_table.sql',
        `CREATE TABLE test_migration_table (id SERIAL PRIMARY KEY);`,
        `DROP TABLE IF EXISTS test_migration_table;`,
      );
      createMigrationFile(
        migrationsDir,
        '20260101000002000_invalid_sql.sql',
        `INVALID SQL STATEMENT;`,
        `SELECT 1;`,
      );

      await expect(runMigrations({ databaseUrl, migrationsDir })).rejects.toThrow();

      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      const history = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
      await client.end();

      expect(history.rows.map((row) => row.version)).toEqual(['20260101000001000']);
    });
  });
});
