import apiClient from '../apiClient';
import { SyncEngine } from '../syncEngine';
import { networkMonitor } from '../../utils/networkMonitor';

jest.mock('../apiClient');
jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: { isOnline: jest.fn() },
}));

const sqliteState: Record<string, Record<string, unknown>> = {};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn((sql: string, params: unknown[]) => {
      if (sql.includes('INSERT OR REPLACE INTO dirty_records')) {
        sqliteState[String(params[0])] = {
          id: params[0],
          entity_type: params[1],
          entity_id: params[2],
          action: params[3],
          payload: params[4],
          updated_at: params[5],
          sync_version: params[6],
          attempts: params[7],
        };
      }
      if (sql.includes('DELETE FROM dirty_records')) delete sqliteState[String(params[0])];
      return Promise.resolve({ changes: 1 });
    }),
    getFirstAsync: jest.fn((_sql: string, params: unknown[]) => Promise.resolve(sqliteState[String(params[0])] ?? null)),
    getAllAsync: jest.fn(() => Promise.resolve(Object.values(sqliteState))),
  }),
}));

describe('SyncEngine', () => {
  beforeEach(() => {
    Object.keys(sqliteState).forEach((key) => delete sqliteState[key]);
    jest.clearAllMocks();
  });

  it('queues dirty records with versions and emits progress', async () => {
    const engine = new SyncEngine();
    const listener = jest.fn();
    engine.onProgress(listener);

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });

    expect(Object.keys(sqliteState)).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'queued' }));
  });

  it('keeps failed records when network interruption happens mid-sync', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: { results: [{ status: 'updated' }] } });
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'One' });
    await engine.markDirty('pet', 'p2', 'update', { name: 'Two' });
    const result = await engine.syncNow();

    expect(result.failed).toBe(1);
    expect(sqliteState['pet:p1']).toBeUndefined();
    expect(sqliteState['pet:p2']).toBeDefined();
  });

  it('supports configurable conflict strategies', () => {
    const engine = new SyncEngine();
    const client = { name: 'client', updatedAt: '2026-01-02T00:00:00.000Z' };
    const server = { name: 'server', updatedAt: '2026-01-01T00:00:00.000Z' };

    expect(engine.resolveConflict(client, server, 'last-write-wins').name).toBe('client');
    expect(engine.resolveConflict(client, server, 'server-wins').name).toBe('server');
    expect(engine.resolveConflict(client, server, 'client-wins').name).toBe('client');
  });
});
