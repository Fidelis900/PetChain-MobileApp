import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import { SyncService } from '../syncService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('SyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    syncService = new SyncService();
  });

  describe('enqueue', () => {
    it('should add item to queue', async () => {
      (getItem as jest.Mock).mockResolvedValue('[]');

      await syncService.enqueue('pet', 'create', { id: 'pet-1', name: 'Buddy' });

      expect(setItem).toHaveBeenCalledWith('@sync_queue', expect.stringContaining('"type":"pet"'));
    });

    it('should deduplicate existing items', async () => {
      const existingItem = {
        id: 'q1',
        type: 'pet',
        action: 'update',
        data: { id: 'p1', name: 'Old' },
      };
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingItem]));

      await syncService.enqueue('pet', 'update', { id: 'p1', name: 'New' });

      const setCall = (setItem as jest.Mock).mock.calls[0];
      const savedQueue = JSON.parse(setCall[1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].data.name).toBe('New');
    });
  });

  describe('pull', () => {
    it('should fetch items from server', async () => {
      mockedApiClient.get.mockResolvedValue({ data: [{ id: 'p1', name: 'Server Pet' }] });
      (getItem as jest.Mock).mockResolvedValue('[]');

      await syncService.pull(['pet']);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/pets');
      // Should save to local storage (e.g., @pets) - based on implementation details
      expect(setItem).toHaveBeenCalled();
    });
  });

  describe('status management', () => {
    it('should notify listeners on status change', async () => {
      const listener = jest.fn();
      syncService.subscribe(listener);

      (getItem as jest.Mock).mockResolvedValue('[]');
      await syncService.enqueue('pet', 'create', { id: '1' });

      expect(listener).toHaveBeenCalled();
      const status = listener.mock.calls[0][0];
      expect(status.pendingCount).toBe(1);
    });
  });
});
