import { Server, Horizon } from '@stellar/stellar-sdk';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

import config from '../config';
import { loggerService } from './loggerService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HorizonStreamConfig {
  horizonUrl: string;
  networkPassphrase: string;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  cursorStorage: CursorStorage;
}

export interface CursorStorage {
  getCursor(streamId: string): Promise<string | null>;
  setCursor(streamId: string, cursor: string): Promise<void>;
}

export interface PetChainTransaction {
  id: string;
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  successful: boolean;
  operationCount: number;
  memo?: string;
  feeCharged: string;
  operations: Array<{
    type: string;
    sourceAccount?: string;
    destination?: string;
    asset?: string;
    amount?: string;
    data?: string;
  }>;
}

export interface StreamEvent {
  type: 'transaction' | 'ledger' | 'operation' | 'payment';
  data: PetChainTransaction | Horizon.ServerApi.LedgerRecord | Horizon.ServerApi.OperationRecord | Horizon.ServerApi.PaymentOperationRecord;
  cursor: string;
  timestamp: string;
}

export interface StreamStatus {
  isConnected: boolean;
  lastEventTime: number | null;
  reconnectAttempts: number;
  currentCursor: string | null;
  subscribedAccounts: Set<string>;
  error: string | null;
}

// ─── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: HorizonStreamConfig = {
  horizonUrl: config.isDev ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org',
  networkPassphrase: config.isDev 
    ? 'Test SDF Network ; September 2015' 
    : 'Public Global Stellar Network ; September 2015',
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
  cursorStorage: new InMemoryCursorStorage(),
};

// ─── In-Memory Cursor Storage ─────────────────────────────────────────────────

class InMemoryCursorStorage implements CursorStorage {
  private cursors = new Map<string, string>();

  async getCursor(streamId: string): Promise<string | null> {
    return this.cursors.get(streamId) || null;
  }

  async setCursor(streamId: string, cursor: string): Promise<void> {
    this.cursors.set(streamId, cursor);
  }
}

// ─── Horizon Stream Service ───────────────────────────────────────────────────

export class HorizonStreamService extends EventEmitter {
  private server: Server;
  private config: HorizonStreamConfig;
  private status: StreamStatus;
  private activeStreams = new Map<string, () => void>();
  private webSocketClients = new Set<WebSocket>();
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(customConfig?: Partial<HorizonStreamConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.server = new Server(this.config.horizonUrl);
    
    this.status = {
      isConnected: false,
      lastEventTime: null,
      reconnectAttempts: 0,
      currentCursor: null,
      subscribedAccounts: new Set(),
      error: null,
    };

    this.setupErrorHandling();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Start streaming transactions for PetChain accounts
   */
  async startTransactionStream(accounts: string[]): Promise<void> {
    const streamId = 'petchain-transactions';
    
    try {
      // Get last cursor for resumption
      const lastCursor = await this.config.cursorStorage.getCursor(streamId);
      
      loggerService.info('Starting transaction stream', { 
        accounts, 
        lastCursor,
        horizonUrl: this.config.horizonUrl 
      });

      // Update status
      this.status.subscribedAccounts = new Set(accounts);
      this.status.error = null;

      // Start streaming
      await this.createTransactionStream(streamId, accounts, lastCursor);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.status.error = errorMessage;
      loggerService.error('Failed to start transaction stream', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop all active streams
   */
  stopAllStreams(): void {
    loggerService.info('Stopping all streams');
    
    // Close all active streams
    for (const [streamId, closeFunction] of this.activeStreams) {
      try {
        closeFunction();
        loggerService.debug('Closed stream', { streamId });
      } catch (error) {
        loggerService.warn('Error closing stream', { streamId, error });
      }
    }
    
    this.activeStreams.clear();
    
    // Clear reconnect timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();
    
    // Update status
    this.status.isConnected = false;
    this.status.reconnectAttempts = 0;
    this.status.subscribedAccounts.clear();
  }

  /**
   * Add WebSocket client for real-time updates
   */
  addWebSocketClient(ws: WebSocket): void {
    this.webSocketClients.add(ws);
    
    // Send current status
    this.sendToWebSocket(ws, {
      type: 'status',
      data: this.getStatus(),
      cursor: this.status.currentCursor || '',
      timestamp: new Date().toISOString(),
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.webSocketClients.delete(ws);
      loggerService.debug('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      this.webSocketClients.delete(ws);
      loggerService.warn('WebSocket client error', { error: error.message });
    });

    loggerService.debug('WebSocket client connected', { 
      totalClients: this.webSocketClients.size 
    });
  }

  /**
   * Get current stream status
   */
  getStatus(): StreamStatus {
    return { ...this.status };
  }

  /**
   * Manually set cursor for stream resumption
   */
  async setCursor(streamId: string, cursor: string): Promise<void> {
    await this.config.cursorStorage.setCursor(streamId, cursor);
    this.status.currentCursor = cursor;
    loggerService.debug('Cursor updated', { streamId, cursor });
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private async createTransactionStream(
    streamId: string, 
    accounts: string[], 
    cursor?: string | null
  ): Promise<void> {
    try {
      // Build stream query
      let streamBuilder = this.server.transactions();
      
      if (cursor) {
        streamBuilder = streamBuilder.cursor(cursor);
      }

      // Start streaming
      const closeFunction = streamBuilder.stream({
        onmessage: (transaction) => this.handleTransaction(streamId, transaction, accounts),
        onerror: (error) => this.handleStreamError(streamId, error, accounts, cursor),
        reconnectTimeout: this.config.reconnectDelay,
      });

      this.activeStreams.set(streamId, closeFunction);
      this.status.isConnected = true;
      this.status.reconnectAttempts = 0;
      
      loggerService.info('Transaction stream started', { streamId, accounts });
      
    } catch (error) {
      loggerService.error('Failed to create transaction stream', { 
        streamId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  private async handleTransaction(
    streamId: string,
    transaction: Horizon.ServerApi.TransactionRecord,
    accounts: string[]
  ): Promise<void> {
    try {
      // Check if transaction involves any of our accounts
      const isRelevant = this.isTransactionRelevant(transaction, accounts);
      
      if (!isRelevant) {
        // Still update cursor for non-relevant transactions
        await this.updateCursor(streamId, transaction.paging_token);
        return;
      }

      // Transform to our format
      const petChainTransaction = await this.transformTransaction(transaction);
      
      // Create stream event
      const streamEvent: StreamEvent = {
        type: 'transaction',
        data: petChainTransaction,
        cursor: transaction.paging_token,
        timestamp: new Date().toISOString(),
      };

      // Update status
      this.status.lastEventTime = Date.now();
      this.status.currentCursor = transaction.paging_token;

      // Store cursor
      await this.updateCursor(streamId, transaction.paging_token);

      // Emit event
      this.emit('transaction', streamEvent);

      // Send to WebSocket clients
      this.broadcastToWebSockets(streamEvent);

      loggerService.debug('Transaction processed', {
        hash: transaction.hash,
        sourceAccount: transaction.source_account,
        successful: transaction.successful,
      });

    } catch (error) {
      loggerService.error('Error handling transaction', {
        transactionHash: transaction.hash,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleStreamError(
    streamId: string,
    error: any,
    accounts: string[],
    lastCursor?: string | null
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Stream error';
    
    loggerService.error('Stream error occurred', { 
      streamId, 
      error: errorMessage,
      reconnectAttempts: this.status.reconnectAttempts 
    });

    this.status.error = errorMessage;
    this.status.isConnected = false;

    // Attempt reconnection if under limit
    if (this.status.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.status.reconnectAttempts++;
      
      const delay = this.config.reconnectDelay * Math.pow(2, this.status.reconnectAttempts - 1);
      
      loggerService.info('Scheduling reconnection', { 
        streamId, 
        attempt: this.status.reconnectAttempts,
        delay 
      });

      const timeout = setTimeout(async () => {
        this.reconnectTimeouts.delete(streamId);
        try {
          await this.createTransactionStream(streamId, accounts, lastCursor);
        } catch (reconnectError) {
          loggerService.error('Reconnection failed', { 
            streamId, 
            error: reconnectError instanceof Error ? reconnectError.message : 'Unknown error' 
          });
        }
      }, delay);

      this.reconnectTimeouts.set(streamId, timeout);
    } else {
      loggerService.error('Max reconnection attempts reached', { streamId });
      this.emit('maxReconnectAttemptsReached', { streamId, error: errorMessage });
    }
  }

  private isTransactionRelevant(
    transaction: Horizon.ServerApi.TransactionRecord,
    accounts: string[]
  ): boolean {
    // Check source account
    if (accounts.includes(transaction.source_account)) {
      return true;
    }

    // Check if any operations involve our accounts
    // Note: This is a simplified check. In production, you might want to
    // fetch operation details for more thorough filtering
    return false;
  }

  private async transformTransaction(
    transaction: Horizon.ServerApi.TransactionRecord
  ): Promise<PetChainTransaction> {
    // Fetch operations for this transaction
    const operations = await this.fetchTransactionOperations(transaction.hash);

    return {
      id: transaction.id,
      hash: transaction.hash,
      ledger: transaction.ledger,
      createdAt: transaction.created_at,
      sourceAccount: transaction.source_account,
      successful: transaction.successful,
      operationCount: transaction.operation_count,
      memo: transaction.memo,
      feeCharged: transaction.fee_charged,
      operations,
    };
  }

  private async fetchTransactionOperations(transactionHash: string): Promise<Array<{
    type: string;
    sourceAccount?: string;
    destination?: string;
    asset?: string;
    amount?: string;
    data?: string;
  }>> {
    try {
      const operationsPage = await this.server.operations()
        .forTransaction(transactionHash)
        .call();

      return operationsPage.records.map(op => ({
        type: op.type,
        sourceAccount: op.source_account,
        // Add more operation-specific fields as needed
        ...(op.type === 'payment' && {
          destination: (op as any).to,
          asset: (op as any).asset_type,
          amount: (op as any).amount,
        }),
        ...(op.type === 'manage_data' && {
          data: (op as any).value,
        }),
      }));
    } catch (error) {
      loggerService.warn('Failed to fetch transaction operations', {
        transactionHash,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async updateCursor(streamId: string, cursor: string): Promise<void> {
    try {
      await this.config.cursorStorage.setCursor(streamId, cursor);
      this.status.currentCursor = cursor;
    } catch (error) {
      loggerService.warn('Failed to update cursor', {
        streamId,
        cursor,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private broadcastToWebSockets(event: StreamEvent): void {
    const message = JSON.stringify(event);
    const deadClients: WebSocket[] = [];

    for (const client of this.webSocketClients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          deadClients.push(client);
        }
      } catch (error) {
        loggerService.warn('Failed to send to WebSocket client', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        deadClients.push(client);
      }
    }

    // Clean up dead clients
    for (const client of deadClients) {
      this.webSocketClients.delete(client);
    }
  }

  private sendToWebSocket(ws: WebSocket, event: StreamEvent): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    } catch (error) {
      loggerService.warn('Failed to send to specific WebSocket client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      loggerService.error('HorizonStreamService error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    });

    // Handle process termination
    process.on('SIGINT', () => {
      loggerService.info('Received SIGINT, stopping streams');
      this.stopAllStreams();
    });

    process.on('SIGTERM', () => {
      loggerService.info('Received SIGTERM, stopping streams');
      this.stopAllStreams();
    });
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const horizonStreamService = new HorizonStreamService();

export default horizonStreamService;