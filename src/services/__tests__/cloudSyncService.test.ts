import { getCloudSyncConfig, updateCloudSyncConfig, toggleEntitySync } from '../cloudSyncService';

// Mock localDB
jest.mock('../localDB', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

const { getItem, setItem } = jest.requireMock('../localDB') as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

describe('CloudSyncService config', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns default config when nothing stored', async () => {
    getItem.mockResolvedValue(null);
    const config = await getCloudSyncConfig();
    expect(config.provider).toBe('server');
    expect(config.autoSync).toBe(true);
    expect(config.syncedEntities).toHaveLength(4);
  });

  it('merges stored config with defaults', async () => {
    getItem.mockResolvedValue(JSON.stringify({ autoSync: false }));
    const config = await getCloudSyncConfig();
    expect(config.autoSync).toBe(false);
    expect(config.provider).toBe('server');
  });

  it('updates and persists config', async () => {
    getItem.mockResolvedValue(null);
    await updateCloudSyncConfig({ autoSync: false });
    expect(setItem).toHaveBeenCalledWith(
      '@cloud_sync_config',
      expect.stringContaining('"autoSync":false'),
    );
  });
});

describe('toggleEntitySync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds entity type when enabled', async () => {
    getItem.mockResolvedValue(JSON.stringify({ syncedEntities: ['pet', 'appointment'] }));
    const updated = await toggleEntitySync('medication', true);
    expect(updated.syncedEntities).toContain('medication');
  });

  it('removes entity type when disabled', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({ syncedEntities: ['pet', 'appointment', 'medication'] }),
    );
    const updated = await toggleEntitySync('medication', false);
    expect(updated.syncedEntities).not.toContain('medication');
    expect(updated.syncedEntities).toContain('pet');
  });

  it('does not duplicate entity types when enabling already-enabled entity', async () => {
    getItem.mockResolvedValue(JSON.stringify({ syncedEntities: ['pet'] }));
    const updated = await toggleEntitySync('pet', true);
    expect(updated.syncedEntities.filter((e) => e === 'pet')).toHaveLength(1);
  });
});
