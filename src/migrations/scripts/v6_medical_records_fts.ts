import { executeSql } from '../../services/localDB';
import type { Migration } from '../types';

/**
 * v6 — Add FTS5 virtual table for full-text search on medical records.
 */
const migration: Migration = {
  version: 6,
  description: 'Add FTS5 full-text search index for medical records',

  async up() {
    // FTS5 virtual table — mirrors searchable fields from medical_records
    await executeSql(`
      CREATE VIRTUAL TABLE IF NOT EXISTS medical_records_fts
      USING fts5(
        id UNINDEXED,
        pet_id UNINDEXED,
        type,
        notes,
        veterinarian,
        date UNINDEXED,
        content='medical_records',
        content_rowid='rowid'
      )
    `);

    // Populate from existing records
    await executeSql(`
      INSERT INTO medical_records_fts(rowid, id, pet_id, type, notes, veterinarian, date)
      SELECT rowid, id, pet_id, type, notes, veterinarian, date
      FROM medical_records
    `);

    // Keep FTS index in sync via triggers
    await executeSql(`
      CREATE TRIGGER IF NOT EXISTS medical_records_fts_insert
      AFTER INSERT ON medical_records BEGIN
        INSERT INTO medical_records_fts(rowid, id, pet_id, type, notes, veterinarian, date)
        VALUES (new.rowid, new.id, new.pet_id, new.type, new.notes, new.veterinarian, new.date);
      END
    `);

    await executeSql(`
      CREATE TRIGGER IF NOT EXISTS medical_records_fts_delete
      AFTER DELETE ON medical_records BEGIN
        INSERT INTO medical_records_fts(medical_records_fts, rowid, id, pet_id, type, notes, veterinarian, date)
        VALUES ('delete', old.rowid, old.id, old.pet_id, old.type, old.notes, old.veterinarian, old.date);
      END
    `);

    await executeSql(`
      CREATE TRIGGER IF NOT EXISTS medical_records_fts_update
      AFTER UPDATE ON medical_records BEGIN
        INSERT INTO medical_records_fts(medical_records_fts, rowid, id, pet_id, type, notes, veterinarian, date)
        VALUES ('delete', old.rowid, old.id, old.pet_id, old.type, old.notes, old.veterinarian, old.date);
        INSERT INTO medical_records_fts(rowid, id, pet_id, type, notes, veterinarian, date)
        VALUES (new.rowid, new.id, new.pet_id, new.type, new.notes, new.veterinarian, new.date);
      END
    `);
  },

  async down() {
    await executeSql(`DROP TRIGGER IF EXISTS medical_records_fts_update`);
    await executeSql(`DROP TRIGGER IF EXISTS medical_records_fts_delete`);
    await executeSql(`DROP TRIGGER IF EXISTS medical_records_fts_insert`);
    await executeSql(`DROP TABLE IF EXISTS medical_records_fts`);
  },
};

export default migration;
