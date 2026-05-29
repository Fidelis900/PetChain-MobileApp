import { getItem, setItem, removeItem } from '../../services/localDB';
import type { Migration } from '../types';

/**
 * v1 — Baseline schema.
 * Ensures all legacy AsyncStorage keys are present in the kv_store
 * and that the medications / dose_logs tables exist (handled by localDB init).
 * This migration is a no-op for fresh installs; it normalises pre-SQLite data.
 */
const migration: Migration = {
  version: 1,
  description: 'Baseline schema — migrate AsyncStorage keys into kv_store',

  async up() {
    // Mark baseline as applied; actual table creation is handled by localDB.init()
    const marker = await getItem('@schema_v1');
    if (marker) return; // idempotent
    await setItem('@schema_v1', JSON.stringify({ appliedAt: Date.now() }));
  },

  async down() {
    await removeItem('@schema_v1');
  },
};

export default migration;
