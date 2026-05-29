import { executeSql } from '../../services/localDB';
import type { Migration } from '../types';

/**
 * v4 — Ensure health_metrics index exists.
 * The table itself is created by localDB.init(); this migration adds the index
 * and serves as the formal version checkpoint for the health_metrics schema.
 */
const migration: Migration = {
  version: 4,
  description: 'Add index on health_metrics(pet_id)',

  async up() {
    await executeSql(`CREATE INDEX IF NOT EXISTS idx_hm_pet_id ON health_metrics(pet_id)`);
  },

  async down() {
    await executeSql(`DROP INDEX IF EXISTS idx_hm_pet_id`);
  },
};

export default migration;
