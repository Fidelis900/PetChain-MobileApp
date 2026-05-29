import apiClient from './apiClient';
import { executeSql } from './localDB';
import { networkMonitor } from '../utils/networkMonitor';

export type SyncEntityType = 'pet' | 'appointment' | 'medication' | 'medicalRecord';
export type SyncAction = 'create' | 'update' | 'delete';
export type ConflictResolutionStrategy = 'last-write-wins' | 'server-wins' | 'client-wins';
export type SyncEventType = 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'conflict';

export interface DirtyRecord {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  updatedAt: string;
  syncVersion: number;
  attempts: number;
}

export interface SyncProgressEvent {
  type: SyncEventType;
  total: number;
  completed: number;
  failed: number;
  message?: string;
  record?: DirtyRecord;
}

export interface SyncEngineOptions {
  batchSize?: number;
  maxRetries?: number;
  strategy?: ConflictResolutionStrategy;
}

type SyncListener = (event: SyncProgressEvent) => void;

const DEFAULT_OPTIONS: Required<SyncEngineOptions> = {
  batchSize: 25,
  maxRetries: 5,
  strategy: 'last-write-wins',
};

export class SyncEngine {
  private listeners = new Set<SyncListener>();
  private isRunning = false;
  private readonly options: Required<SyncEngineOptions>;

  constructor(options: SyncEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async initialize(): Promise<void> {
    await executeSql(
      `CREATE TABLE IF NOT EXISTS dirty_records (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_version INTEGER NOT NULL DEFAULT 1,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      )`,
    );
    await executeSql(
      `CREATE INDEX IF NOT EXISTS idx_dirty_records_updated_at ON dirty_records(updated_at ASC)`,
    );
  }

  onProgress(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async markDirty(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<DirtyRecord> {
    await this.initialize();
    const updatedAt = new Date().toISOString();
    const id = `${entityType}:${entityId}`;
    const existing = await this.getDirtyRecord(id);
    const record: DirtyRecord = {
      id,
      entityType,
      entityId,
      action,
      payload: { ...payload, id: entityId, updated_at: updatedAt, updatedAt },
      updatedAt,
      syncVersion: (existing?.syncVersion ?? 0) + 1,
      attempts: existing?.attempts ?? 0,
    };

    await executeSql(
      `INSERT OR REPLACE INTO dirty_records
        (id, entity_type, entity_id, action, payload, updated_at, sync_version, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.entityType,
        record.entityId,
        record.action,
        JSON.stringify(record.payload),
        record.updatedAt,
        record.syncVersion,
        record.attempts,
      ],
    );
    this.emit({ type: 'queued', total: 1, completed: 0, failed: 0, record });
    return record;
  }

  async syncNow(): Promise<SyncProgressEvent> {
    await this.initialize();
    if (this.isRunning) return { type: 'started', total: 0, completed: 0, failed: 0 };
    if (!(await networkMonitor.isOnline())) {
      return { type: 'failed', total: 0, completed: 0, failed: 0, message: 'Device is offline' };
    }

    this.isRunning = true;
    const batch = await this.getBatch();
    const total = batch.length;
    let completed = 0;
    let failed = 0;
    this.emit({ type: 'started', total, completed, failed });

    for (const record of batch) {
      try {
        await this.pushRecord(record);
        await this.clearRecord(record.id);
        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync failure';
        await this.recordFailure(record, message);
        failed += 1;
      }
      this.emit({ type: 'progress', total, completed, failed, record });
    }

    this.isRunning = false;
    const event: SyncProgressEvent = {
      type: failed > 0 ? 'failed' : 'completed',
      total,
      completed,
      failed,
    };
    this.emit(event);
    return event;
  }

  resolveConflict(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    strategy: ConflictResolutionStrategy = this.options.strategy,
  ): Record<string, unknown> {
    if (strategy === 'server-wins') return serverData;
    if (strategy === 'client-wins') return localData;

    const localUpdatedAt = Date.parse(String(localData.updated_at ?? localData.updatedAt ?? 0));
    const serverUpdatedAt = Date.parse(String(serverData.updated_at ?? serverData.updatedAt ?? 0));
    const base = serverUpdatedAt >= localUpdatedAt ? serverData : localData;
    const merged: Record<string, unknown> = { ...base };
    const keys = new Set([...Object.keys(localData), ...Object.keys(serverData)]);

    for (const key of keys) {
      const localValue = localData[key];
      const serverValue = serverData[key];
      if (localValue === undefined) merged[key] = serverValue;
      else if (serverValue === undefined) merged[key] = localValue;
      else merged[key] = serverUpdatedAt >= localUpdatedAt ? serverValue : localValue;
    }

    return merged;
  }

  private async getDirtyRecord(id: string): Promise<DirtyRecord | null> {
    const db = await import('expo-sqlite');
    const conn = db.openDatabaseSync('petchain.db');
    const row = (await conn.getFirstAsync(`SELECT * FROM dirty_records WHERE id = ? LIMIT 1`, [
      id,
    ])) as {
      id: string;
      entity_type: SyncEntityType;
      entity_id: string;
      action: SyncAction;
      payload: string;
      updated_at: string;
      sync_version: number;
      attempts: number;
    } | null;

    if (!row) return null;
    return this.fromRow(row);
  }

  private async getBatch(): Promise<DirtyRecord[]> {
    const db = await import('expo-sqlite');
    const conn = db.openDatabaseSync('petchain.db');
    const rows = (await conn.getAllAsync(
      `SELECT * FROM dirty_records WHERE attempts < ? ORDER BY updated_at ASC LIMIT ?`,
      [this.options.maxRetries, this.options.batchSize],
    )) as Array<{
      id: string;
      entity_type: SyncEntityType;
      entity_id: string;
      action: SyncAction;
      payload: string;
      updated_at: string;
      sync_version: number;
      attempts: number;
    }>;
    return rows.map((row) => this.fromRow(row));
  }

  private async pushRecord(record: DirtyRecord): Promise<void> {
    const response = await apiClient.post('/sync/push', {
      records: [record],
      strategy: this.options.strategy,
    });
    const result = response.data as {
      results?: Array<{ status: string; serverRecord?: Record<string, unknown> }>;
    };
    const first = result.results?.[0];
    if (!first || first.status === 'failed') throw new Error('Server rejected sync record');
    if (first.status === 'conflict' && first.serverRecord) {
      this.emit({ type: 'conflict', total: 1, completed: 0, failed: 0, record });
    }
  }

  private async clearRecord(id: string): Promise<void> {
    await executeSql(`DELETE FROM dirty_records WHERE id = ?`, [id]);
  }

  private async recordFailure(record: DirtyRecord, message: string): Promise<void> {
    await executeSql(
      `UPDATE dirty_records SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
      [message, record.id],
    );
  }

  private fromRow(row: {
    id: string;
    entity_type: SyncEntityType;
    entity_id: string;
    action: SyncAction;
    payload: string;
    updated_at: string;
    sync_version: number;
    attempts: number;
  }): DirtyRecord {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      updatedAt: row.updated_at,
      syncVersion: row.sync_version,
      attempts: row.attempts,
    };
  }

  private emit(event: SyncProgressEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
