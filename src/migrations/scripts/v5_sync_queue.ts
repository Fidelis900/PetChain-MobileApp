import { executeSql } from '../../services/localDB';
import type { Migration } from '../types';

/**
 * v5 — Add sync_queue table for offline-first mutation tracking.
 */
const migration: Migration = {
  version: 5,
  description: 'Add sync_queue table for offline mutations',

  async up() {
    await executeSql(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id           TEXT PRIMARY KEY,
        entity_type  TEXT NOT NULL,
        entity_id    TEXT NOT NULL,
        operation    TEXT NOT NULL CHECK (operation IN ('create','update','delete')),
        payload      TEXT,
        status       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','completed','failed')),
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_error   TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await executeSql(`CREATE INDEX IF NOT EXISTS idx_sq_status ON sync_queue(status)`);
  },

  async down() {
    await executeSql(`DROP TABLE IF EXISTS sync_queue`);
  },
};

export default migration;
