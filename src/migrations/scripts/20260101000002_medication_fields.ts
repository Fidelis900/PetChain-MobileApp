import type { SQLiteDatabase } from 'expo-sqlite';
import type { SqliteMigration } from '../sqliteMigrationRunner';

const migration: SqliteMigration = {
  version: '20260101000002',
  description: 'Add prescriber_info and pharmacy_info columns to medications',

  async up(db: SQLiteDatabase) {
    // SQLite ALTER TABLE only supports ADD COLUMN — use IF NOT EXISTS guard via try/catch
    try {
      await db.execAsync(
        `ALTER TABLE medications ADD COLUMN prescriber_info TEXT`,
      );
    } catch {
      // Column already exists — idempotent
    }
    try {
      await db.execAsync(
        `ALTER TABLE medications ADD COLUMN pharmacy_info TEXT`,
      );
    } catch {
      // Column already exists — idempotent
    }
  },

  async down(db: SQLiteDatabase) {
    // SQLite does not support DROP COLUMN before 3.35.0; recreate table without columns
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS medications_backup AS SELECT id, data FROM medications;
      DROP TABLE medications;
      ALTER TABLE medications_backup RENAME TO medications;
    `);
  },
};

export default migration;
