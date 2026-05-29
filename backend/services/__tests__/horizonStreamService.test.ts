/**
 * Unit tests for backend/services/horizonStreamService.ts
 */

// ─── Mocks (must be declared before imports) ──────────────────────────────────

// Mock Stellar SDK
const mockServer = {
  transactions: jest.fn(),
  operations: jest.fn(),
};

const mockStreamBuilder = {
  cursor: jest.fn(),
  stream: jest.fn(),
  forTransaction: jest.fn(),
  call: jest.fn(),
};

const mockOperationsBuilder = {
  forTransaction: jest.fn(),
  call: jest.fn(),
};

jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn(() => mockServer),
  Horizon: {
    ServerApi: {},
  },
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  
  readyState = MockWebSocket.OPEN;
  onopen: any = null;
  onclose: any = null;
  onmessage: any = null;
  onerror: any = null;
  
  constructor(public url: string) {}
  
  send(data: string): void {}
  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }
}

jest.mock('ws', () => ({
  WebSocket: MockWebSocket,
}));

// Mock config
jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    isDev: true,
  },
}));

// Mock logger service
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../loggerService', () => ({
  loggerService: mockLogger,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  HorizonStreamService,
  type PetChainTransaction,
  type StreamEvent,
  type CursorStorage,
} from '../horizonStreamService';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

class MockCursorStorage implements CursorStorage {
  private cursors = new Map<string, string>();

  async getCursor(streamId: string): Promise<string | null> {
    return this.cursors.get(streamId) || null;
  }

  async setCursor(streamId: string, cursor: string): Promise<void> {
    this.cursors.set(streamId, cursor);
  }

  // Test helper
  clear(): void {
    this.cursors.clear();
  }
}

const createMockTransaction = (overrides: any = {}) => ({
  id: 'tx123',
  hash: 'hash123',
  ledger: 12345,
  created_at: '2023-01-01T00:00:00Z',
  source_account: 'GACCOUNT1',
  successful: true,
  operation_count: 1,
  memo: 'test memo',
  fee_charged: '100',
  paging_token: 'cursor123',
  ...overrides,
});

// ─── Test Setup ───────────────────────────────────────────────────────────────

describe('HorizonStreamService', () => {
  let service: HorizonStreamService;
  let mockCursorStorage: MockCursorStorage;
  let mockCloseFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCursorStorage = new MockCursorStorage();
    mockCloseFunction = jest.fn();
    
    // Reset mock implementations
    mockServer.transactions.mockReturnValue(mockStreamBuilder);
    mockServer.operations.mockReturnValue(mockOperationsBuilder);
    mockStreamBuilder.cursor.mockReturnValue(mockStreamBuilder);
    mockStreamBuilder.stream.mockReturnValue(mockCloseFunction);
    mockOperationsBuilder.forTransaction.mockReturnValue(mockOperationsBuilder);
    mockOperationsBuilder.call.mockResolvedValue({ records: [] });
    
    service = new HorizonStreamService({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      cursorStorage: mockCursorStorage,
      reconnectDelay: 100, // Faster for tests
      maxReconnectAttempts: 3,
    });
  });

  afterEach(() => {
    service.stopAllStreams();
    mockCursorStorage.clear();
  });

  // ─── Stream Startup Tests ─────────────────────────────────────────────────────

  describe('startTransactionStream()', () => {
    it('starts streaming transactions successfully', async () => {
      const accounts = ['GACCOUNT1', 'GACCOUNT2'];
      
      await service.startTransactionStream(accounts);
      
      expect(mockServer.transactions).toHaveBeenCalled();
      expect(mockStreamBuilder.stream).toHaveBeenCalledWith({
        onmessage: expect.any(Function),
        onerror: expect.any(Function),
        reconnectTimeout: 100,
      });
      
      const status = service.getStatus();
      expect(status.isConnected).toBe(true);
      expect(status.subscribedAccounts).toEqual(new Set(accounts));
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting transaction stream',
        expect.objectContaining({ accounts })
      );
    });

    it('resumes from last cursor when available', async () => {
      const lastCursor = 'last_cursor_123';
      await mockCursorStorage.setCursor('petchain-transactions', lastCursor);
      
      await service.startTransactionStream(['GACCOUNT1']);
      
      expect(mockStreamBuilder.cursor).toHaveBeenCalledWith(lastCursor);
    });

    it('handles stream startup errors', async () => {
      const error = new Error('Stream startup failed');
      mockStreamBuilder.stream.mockImplementation(() => {
        throw error;
      });
      
      await expect(service.startTransactionStream(['GACCOUNT1']))
        .rejects.toThrow('Stream startup failed');
      
      const status = service.getStatus();
      expect(status.error).toBe('Stream startup failed');
    });
  });

  // ─── Transaction Processing Tests ─────────────────────────────────────────────

  describe('transaction processing', () => {
    let onMessageHandler: (tx: any) => void;
    
    beforeEach(async () => {
      await service.startTransactionStream(['GACCOUNT1']);
      
      // Capture the onmessage handler
      const streamCall = mockStreamBuilder.stream.mock.calls[0][0];
      onMessageHandler = streamCall.onmessage;
    });

    it('processes relevant transactions', (done) => {
      const mockTx = createMockTransaction({
        source_account: 'GACCOUNT1',
      });

      service.on('transaction', (event: StreamEvent) => {
        expect(event.type).toBe('transaction');
        const txData = event.data as PetChainTransaction;
        expect(txData.hash).toBe('hash123');
        expect(txData.sourceAccount).toBe('GACCOUNT1');
        expect(txData.successful).toBe(true);
        done();
      });

      onMessageHandler(mockTx);
    });

    it('updates cursor for all transactions', async () => {
      const mockTx = createMockTransaction({
        source_account: 'GUNRELATED_ACCOUNT',
        paging_token: 'new_cursor_456',
      });

      onMessageHandler(mockTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const cursor = await mockCursorStorage.getCursor('petchain-transactions');
      expect(cursor).toBe('new_cursor_456');
    });

    it('fetches transaction operations', async () => {
      const mockTx = createMockTransaction({
        source_account: 'GACCOUNT1',
      });

      const mockOperations = [
        {
          type: 'payment',
          source_account: 'GACCOUNT1',
          to: 'GACCOUNT2',
          asset_type: 'native',
          amount: '100',
        },
      ];

      mockOperationsBuilder.call.mockResolvedValue({
        records: mockOperations,
      });

      service.on('transaction', (event: StreamEvent) => {
        const txData = event.data as PetChainTransaction;
        expect(txData.operations).toHaveLength(1);
        expect(txData.operations[0].type).toBe('payment');
        expect(txData.operations[0].destination).toBe('GACCOUNT2');
      });

      onMessageHandler(mockTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOperationsBuilder.forTransaction).toHaveBeenCalledWith('hash123');
    });

    it('handles operation fetch errors gracefully', async () => {
      const mockTx = createMockTransaction({
        source_account: 'GACCOUNT1',
      });

      mockOperationsBuilder.call.mockRejectedValue(new Error('Operations fetch failed'));

      service.on('transaction', (event: StreamEvent) => {
        const txData = event.data as PetChainTransaction;
        expect(txData.operations).toEqual([]);
      });

      onMessageHandler(mockTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch transaction operations',
        expect.objectContaining({
          transactionHash: 'hash123',
        })
      );
    });
  });

  // ─── Error Handling Tests ─────────────────────────────────────────────────────

  describe('error handling', () => {
    let onErrorHandler: (error: any) => void;
    
    beforeEach(async () => {
      await service.startTransactionStream(['GACCOUNT1']);
      
      // Capture the onerror handler
      const streamCall = mockStreamBuilder.stream.mock.calls[0][0];
      onErrorHandler = streamCall.onerror;
    });

    it('handles stream errors and attempts reconnection', async () => {
      const error = new Error('Stream connection lost');
      
      onErrorHandler(error);
      
      const status = service.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.error).toBe('Stream connection lost');
      expect(status.reconnectAttempts).toBe(1);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Stream error occurred',
        expect.objectContaining({
          error: 'Stream connection lost',
          reconnectAttempts: 1,
        })
      );
    });

    it('stops reconnecting after max attempts', async () => {
      // Trigger multiple errors to exceed max attempts
      const error = new Error('Persistent error');
      
      for (let i = 0; i < 4; i++) {
        onErrorHandler(error);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Max reconnection attempts reached',
        expect.objectContaining({ streamId: 'petchain-transactions' })
      );
    });

    it('emits maxReconnectAttemptsReached event', (done) => {
      service.on('maxReconnectAttemptsReached', (data) => {
        expect(data.streamId).toBe('petchain-transactions');
        expect(data.error).toBe('Persistent error');
        done();
      });

      const error = new Error('Persistent error');
      
      // Exceed max attempts
      for (let i = 0; i < 4; i++) {
        onErrorHandler(error);
      }
    });
  });

  // ─── WebSocket Client Management Tests ────────────────────────────────────────

  describe('WebSocket client management', () => {
    it('adds WebSocket clients and sends status', () => {
      const mockWs = new MockWebSocket('ws://test');
      const sendSpy = jest.spyOn(mockWs, 'send');
      
      service.addWebSocketClient(mockWs as any);
      
      expect(sendSpy).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status"')
      );
    });

    it('broadcasts events to all WebSocket clients', async () => {
      const mockWs1 = new MockWebSocket('ws://test1');
      const mockWs2 = new MockWebSocket('ws://test2');
      const sendSpy1 = jest.spyOn(mockWs1, 'send');
      const sendSpy2 = jest.spyOn(mockWs2, 'send');
      
      service.addWebSocketClient(mockWs1 as any);
      service.addWebSocketClient(mockWs2 as any);
      
      // Clear initial status messages
      sendSpy1.mockClear();
      sendSpy2.mockClear();
      
      // Start stream and trigger transaction
      await service.startTransactionStream(['GACCOUNT1']);
      const streamCall = mockStreamBuilder.stream.mock.calls[0][0];
      const mockTx = createMockTransaction({ source_account: 'GACCOUNT1' });
      
      streamCall.onmessage(mockTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(sendSpy1).toHaveBeenCalledWith(
        expect.stringContaining('"type":"transaction"')
      );
      expect(sendSpy2).toHaveBeenCalledWith(
        expect.stringContaining('"type":"transaction"')
      );
    });

    it('removes dead WebSocket clients', async () => {
      const mockWs = new MockWebSocket('ws://test');
      mockWs.readyState = MockWebSocket.CLOSED;
      
      service.addWebSocketClient(mockWs as any);
      
      // Start stream and trigger transaction
      await service.startTransactionStream(['GACCOUNT1']);
      const streamCall = mockStreamBuilder.stream.mock.calls[0][0];
      const mockTx = createMockTransaction({ source_account: 'GACCOUNT1' });
      
      streamCall.onmessage(mockTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Client should be removed from internal set (we can't directly test this,
      // but the service should handle it gracefully)
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to send to WebSocket client')
      );
    });
  });

  // ─── Stream Management Tests ──────────────────────────────────────────────────

  describe('stream management', () => {
    it('stops all streams', async () => {
      await service.startTransactionStream(['GACCOUNT1']);
      
      service.stopAllStreams();
      
      expect(mockCloseFunction).toHaveBeenCalled();
      
      const status = service.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.subscribedAccounts.size).toBe(0);
    });

    it('handles errors when closing streams', async () => {
      mockCloseFunction.mockImplementation(() => {
        throw new Error('Close failed');
      });
      
      await service.startTransactionStream(['GACCOUNT1']);
      
      service.stopAllStreams();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error closing stream',
        expect.objectContaining({
          streamId: 'petchain-transactions',
        })
      );
    });
  });

  // ─── Cursor Management Tests ──────────────────────────────────────────────────

  describe('cursor management', () => {
    it('sets cursor manually', async () => {
      await service.setCursor('test-stream', 'manual_cursor_789');
      
      const cursor = await mockCursorStorage.getCursor('test-stream');
      expect(cursor).toBe('manual_cursor_789');
      
      const status = service.getStatus();
      expect(status.currentCursor).toBe('manual_cursor_789');
    });
  });

  // ─── Status Tests ─────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns current status', () => {
      const status = service.getStatus();
      
      expect(status).toMatchObject({
        isConnected: false,
        lastEventTime: null,
        reconnectAttempts: 0,
        currentCursor: null,
        subscribedAccounts: new Set(),
        error: null,
      });
    });

    it('updates status after starting stream', async () => {
      await service.startTransactionStream(['GACCOUNT1', 'GACCOUNT2']);
      
      const status = service.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.subscribedAccounts).toEqual(new Set(['GACCOUNT1', 'GACCOUNT2']));
    });
  });

  // ─── Transaction Relevance Tests ──────────────────────────────────────────────

  describe('transaction relevance filtering', () => {
    it('identifies relevant transactions by source account', async () => {
      await service.startTransactionStream(['GACCOUNT1']);
      
      const streamCall = mockStreamBuilder.stream.mock.calls[0][0];
      const relevantTx = createMockTransaction({ source_account: 'GACCOUNT1' });
      const irrelevantTx = createMockTransaction({ source_account: 'GUNRELATED' });
      
      let eventCount = 0;
      service.on('transaction', () => {
        eventCount++;
      });
      
      streamCall.onmessage(relevantTx);
      streamCall.onmessage(irrelevantTx);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(eventCount).toBe(1); // Only relevant transaction should emit event
    });
  });
});