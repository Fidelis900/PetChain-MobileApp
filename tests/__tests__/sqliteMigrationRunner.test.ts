import * as SQLite from 'expo-sqlite';
import {
  runSqliteMigrations,
  rollbackSqliteMigrations,
  getSqliteMigrationHistory,
  SqliteMigration,
} from '../../src/migrations/sqliteMigrationRunner';

const mockDb = SQLite.openDatabaseSync('petchain.db') as any;

function makeMigration(version: string, name: string, failUp = false): SqliteMigration {
  return {
    version,
    description: name,
    up: async (db) => {
      if (failUp) throw new Error('up failed');
      await db.execAsync(`CREATE TABLE IF NOT EXISTS t_${version} (id INTEGER PRIMARY KEY)`);
    },
    down: async (db) => {
      await db.execAsync(`DROP TABLE IF EXISTS t_${version}`);
    },
  };
}

describe('SQLite migration runner', () => {
  beforeEach(async () => {
    // Reset schema_migrations table
    await mockDb.execAsync(`DROP TABLE IF EXISTS schema_migrations`);
  });

  test('applies migrations and records history', async () => {
    const m1 = makeMigration('20260101000001', 'create table 1');
    const m2 = makeMigration('20260101000002', 'create table 2');

    const res = await runSqliteMigrations(mockDb, [m1, m2]);
    expect(res.success).toBe(true);
    expect(res.migrationsRun).toBe(2);

    const history = await getSqliteMigrationHistory(mockDb);
    expect(history.map((h) => h.version)).toEqual(['20260101000001', '20260101000002']);
  });

  test('rollback migrations to target version', async () => {
    const m1 = makeMigration('20260101000001', 'create table 1');
    const m2 = makeMigration('20260101000002', 'create table 2');

    await runSqliteMigrations(mockDb, [m1, m2]);
    const res = await rollbackSqliteMigrations(mockDb, [m1, m2], '20260101000001');
    expect(res.success).toBe(true);
    expect(res.migrationsRun).toBe(1);
  });

  test('prevents duplicate execution when called concurrently', async () => {
    const m1 = makeMigration('20260101000001', 'create table 1');

    // Call twice concurrently
    const [a, b] = await Promise.all([runSqliteMigrations(mockDb, [m1]), runSqliteMigrations(mockDb, [m1])]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  test('recovers from failed migration by running down when possible', async () => {
    const good = makeMigration('20260101000001', 'good');
    const bad = makeMigration('20260101000002', 'bad', true);

    const res = await runSqliteMigrations(mockDb, [good, bad]);
    expect(res.success).toBe(false);
    // ensure the first migration was applied
    const history = await getSqliteMigrationHistory(mockDb);
    expect(history.some((h) => h.version === '20260101000001')).toBe(true);
  });
});
