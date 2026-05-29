import * as SQLite from 'expo-sqlite';

import { encrypt, decrypt } from '../utils/encryption';

const db = SQLite.openDatabaseSync('petchain.db');

/**
 * Helper to safely decrypt data, falling back to original data if decryption fails.
 * This handles transition from unencrypted to encrypted data.
 */
async function safeDecrypt<T = string>(
  data: string,
  purpose: string,
  parseJson: boolean = false,
): Promise<T> {
  try {
    return await decrypt<T>(data, purpose, parseJson);
  } catch {
    // If decryption fails, it might be unencrypted legacy data
    if (parseJson) {
      try {
        return JSON.parse(data) as T;
      } catch {
        // Not JSON either, return as is if T is string
        return data as unknown as T;
      }
    }
    return data as unknown as T;
  }
}

export async function executeSql(
  sql: string,
  params: SQLite.SQLiteBindParams = [],
): Promise<SQLite.SQLiteRunResult> {
  return db.runAsync(sql, params);
}

async function init(): Promise<void> {
  // Key-value store for misc JSON blobs
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT)`,
  );

  // Structured tables for medications and dose logs
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS dose_logs (id TEXT PRIMARY KEY NOT NULL, medication_id TEXT, taken_at TEXT, skipped INTEGER, notes TEXT, data TEXT NOT NULL)`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS health_metrics (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL, recorded_at TEXT NOT NULL, data TEXT NOT NULL)`,
  );
}

// Initialize DB on module import
init().catch(() => {});

// KV helpers (compat with AsyncStorage-like API)
export async function getItem(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
    [key],
  );
  if (!row) return null;
  return await safeDecrypt(row.value, `localdb_kv_${key}`);
}

export async function setItem(key: string, value: string): Promise<void> {
  const encryptedValue = await encrypt(value, `localdb_kv_${key}`);
  await db.runAsync(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [
    key,
    encryptedValue,
  ]);
}

export async function removeItem(key: string): Promise<void> {
  await db.runAsync(`DELETE FROM kv_store WHERE key = ?`, [key]);
}

export async function multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
    keys,
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return await Promise.all(
    keys.map(async (k) => {
      const val = map[k];
      return [k, val ? await safeDecrypt(val, `localdb_kv_${k}`) : null] as [string, string | null];
    }),
  );
}

export async function multiSet(items: Array<[string, string]>): Promise<void> {
  const encryptedItems = await Promise.all(
    items.map(async ([k, v]) => {
      const encryptedValue = await encrypt(v, `localdb_kv_${k}`);
      return [k, encryptedValue] as [string, string];
    }),
  );

  await db.withTransactionAsync(async () => {
    for (const [k, v] of encryptedItems) {
      await db.runAsync(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [k, v]);
    }
  });
}

// Medications CRUD
export async function getAllMedications<T = unknown>(): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM medications`);
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_medications', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

export async function upsertMedication<T extends { id: string }>(med: T): Promise<void> {
  const encryptedData = await encrypt(med, 'localdb_medications');
  await db.runAsync(`INSERT OR REPLACE INTO medications (id, data) VALUES (?, ?)`, [
    med.id,
    encryptedData,
  ]);
}

export async function deleteMedicationById(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM medications WHERE id = ?`, [id]);
}

// Dose logs
export async function getDoseLogs<T = unknown>(): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM dose_logs ORDER BY taken_at ASC`,
  );
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_dose_logs', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function addDoseLog<
  T extends {
    id: string;
    medicationId?: string;
    takenAt?: string;
    skipped?: boolean;
    notes?: string;
  },
>(log: T): Promise<void> {
  const encryptedData = await encrypt(log, 'localdb_dose_logs');
  await db.runAsync(
    `INSERT OR REPLACE INTO dose_logs (id, medication_id, taken_at, skipped, notes, data) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.medicationId ?? null,
      log.takenAt ?? null,
      log.skipped ? 1 : 0,
      log.notes ?? null,
      encryptedData,
    ],
  );
}

export async function clearDoseLogs(): Promise<void> {
  await db.runAsync(`DELETE FROM dose_logs`);
}

export async function getHealthMetricsByPetId(petId: string): Promise<unknown[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM health_metrics WHERE pet_id = ? ORDER BY recorded_at ASC`,
    [petId],
  );
  const out: unknown[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt(row.data, 'localdb_health_metrics', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function upsertHealthMetric(entry: {
  id: string;
  petId: string;
  recordedAt: string;
  [k: string]: unknown;
}): Promise<void> {
  const encryptedData = await encrypt(entry, 'localdb_health_metrics');
  await db.runAsync(
    `INSERT OR REPLACE INTO health_metrics (id, pet_id, recorded_at, data) VALUES (?, ?, ?, ?)`,
    [entry.id, entry.petId, entry.recordedAt, encryptedData],
  );
}

export async function deleteHealthMetricById(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM health_metrics WHERE id = ?`, [id]);
}

export default {
  getItem,
  setItem,
  removeItem,
  multiGet,
  multiSet,
  getAllMedications,
  upsertMedication,
  deleteMedicationById,
  getDoseLogs,
  addDoseLog,
  getHealthMetricsByPetId,
  upsertHealthMetric,
  deleteHealthMetricById,
};
