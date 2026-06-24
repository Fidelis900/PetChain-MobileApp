# Real-Time Blockchain Event Streaming

This implementation provides real-time monitoring of Stellar Horizon API transactions related to PetChain accounts, with automatic record verification status updates delivered to the React Native app via WebSocket.

## Architecture Overview

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Stellar Horizon   │    │   Backend Service    │    │  React Native App  │
│       API           │    │                      │    │                     │
│                     │    │  ┌─────────────────┐ │    │ ┌─────────────────┐ │
│  • Transaction      │───▶│  │ HorizonStream   │ │    │ │ BlockchainEvent │ │
│    Streaming        │    │  │ Service         │ │    │ │ Service         │ │
│  • Server-Sent      │    │  └─────────────────┘ │    │ └─────────────────┘ │
│    Events           │    │           │          │    │          │          │
│  • Cursor-based     │    │           ▼          │    │          │          │
│    Resumption       │    │  ┌─────────────────┐ │    │ ┌─────────────────┐ │
│                     │    │  │   WebSocket     │ │◀───┤ │ Integration     │ │
└─────────────────────┘    │  │   Broadcasting  │ │    │ │ Service         │ │
                           │  └─────────────────┘ │    │ └─────────────────┘ │
                           └──────────────────────┘    └─────────────────────┘
```

## Key Components

### Backend Services

#### 1. HorizonStreamService (`backend/services/horizonStreamService.ts`)

**Purpose**: Streams transactions from Stellar Horizon API and filters for PetChain-related accounts.

**Key Features**:
- **Real-time streaming** using Stellar SDK's streaming API
- **Cursor-based resumption** for reliable event delivery
- **Automatic reconnection** with exponential backoff
- **WebSocket broadcasting** to connected React Native clients
- **Transaction filtering** by PetChain account addresses
- **Operation fetching** for detailed transaction analysis

**Configuration**:
```typescript
const config = {
  horizonUrl: 'https://horizon-testnet.stellar.org', // or mainnet
  networkPassphrase: 'Test SDF Network ; September 2015',
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
  cursorStorage: new InMemoryCursorStorage(), // or persistent storage
};
```

**Usage**:
```typescript
import { horizonStreamService } from './horizonStreamService';

// Start streaming for PetChain accounts
await horizonStreamService.startTransactionStream([
  'GACCOUNT1PETCHAIN...',
  'GACCOUNT2PETCHAIN...',
]);

// Add WebSocket client for real-time updates
horizonStreamService.addWebSocketClient(websocket);

// Listen for events
horizonStreamService.on('transaction', (event) => {
  console.log('New transaction:', event.data);
});
```

### Frontend Services

#### 2. BlockchainEventService (`src/services/blockchainEventService.ts`)

**Purpose**: Connects React Native app to backend WebSocket for real-time blockchain events.

**Key Features**:
- **WebSocket connection management** with auto-reconnection
- **Network monitoring** integration with NetInfo
- **Event type handling** (transactions, verifications, connection status)
- **Heartbeat mechanism** for connection health
- **Graceful error handling** and recovery

**Usage**:
```typescript
import blockchainEventService from './blockchainEventService';

// Connect to blockchain events
await blockchainEventService.connect(['GACCOUNT1...', 'GACCOUNT2...']);

// Listen for transaction events
blockchainEventService.on('transaction', (event) => {
  const transaction = event.data as TransactionEvent;
  console.log('Transaction received:', transaction.transactionHash);
});

// Listen for verification updates
blockchainEventService.on('verificationUpdate', (event) => {
  const update = event.data as VerificationUpdateEvent;
  console.log('Verification update:', update.recordId, update.verified);
});
```

#### 3. BlockchainIntegrationService (`src/services/blockchainIntegration.ts`)

**Purpose**: High-level integration service that manages record verification status and app state updates.

**Key Features**:
- **Record verification tracking** with persistent storage
- **Automatic verification polling** for pending records
- **Real-time status updates** via blockchain events
- **Cache invalidation** for verified records
- **Event aggregation** and state management

**Usage**:
```typescript
import blockchainIntegration from './blockchainIntegration';

// Initialize with PetChain accounts
await blockchainIntegration.initialize(['GACCOUNT1...']);

// Add record for verification monitoring
await blockchainIntegration.addRecordForVerification(
  'medical-record-123',
  'expected-hash-abc',
  'transaction-hash-def'
);

// Check verification status
const status = blockchainIntegration.getRecordVerificationStatus('medical-record-123');
console.log('Verified:', status?.verified);

// Listen for updates
blockchainIntegration.on('verificationUpdated', (update) => {
  console.log('Record verified:', update.recordId);
});
```

## Event Types

### Transaction Events
```typescript
interface TransactionEvent {
  transactionHash: string;
  sourceAccount: string;
  successful: boolean;
  ledger: number;
  operationCount: number;
  memo?: string;
  operations: Array<{
    type: string;
    sourceAccount?: string;
    destination?: string;
    asset?: string;
    amount?: string;
    data?: string;
  }>;
  recordIds?: string[]; // PetChain record IDs affected
}
```

### Verification Update Events
```typescript
interface VerificationUpdateEvent {
  recordId: string;
  verified: boolean;
  transactionHash?: string;
  ledger?: number;
  timestamp: string;
}
```

### Connection Status Events
```typescript
interface ConnectionStatusEvent {
  connected: boolean;
  error?: string;
  reconnectAttempts?: number;
}
```

## React Native Integration

### Example Component (`src/examples/BlockchainEventExample.tsx`)

The example component demonstrates:
- **Real-time event display** with live updates
- **Verification status monitoring** for medical records
- **Manual verification checks** with immediate feedback
- **Connection status indicators** and error handling
- **Event logging** for debugging and monitoring

**Key Features**:
- Pull-to-refresh for manual updates
- Add sample records for testing
- Real-time event log with color-coded event types
- Verification status badges and manual check buttons
- Connection status indicators

## Testing

### Unit Tests

**Backend Tests** (`backend/services/__tests__/horizonStreamService.test.ts`):
- Stream startup and configuration
- Transaction processing and filtering
- Error handling and reconnection logic
- WebSocket client management
- Cursor management and resumption

**Frontend Tests** (`src/services/__tests__/blockchainEventService.test.ts`):
- WebSocket connection management
- Message handling for different event types
- Reconnection logic and network monitoring
- Error handling and graceful degradation

**Integration Tests** (`src/services/__tests__/blockchainIntegration.test.ts`):
- Service initialization and configuration
- Record verification tracking
- Event handling and state updates
- Data persistence and recovery

### Running Tests

```bash
# Run all blockchain-related tests
npm test -- --testPathPattern="blockchain"

# Run specific test file
npm test src/services/__tests__/blockchainEventService.test.ts

# Run with coverage
npm run test:ci
```

## Configuration

### Environment Variables

```bash
# Backend Configuration
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
WEBSOCKET_PORT=3001

# Frontend Configuration
WEBSOCKET_URL=ws://localhost:3001/blockchain-events
RECONNECT_DELAY=3000
MAX_RECONNECT_ATTEMPTS=10
```

### Production Considerations

1. **Horizon URL**: Use mainnet Horizon for production
2. **WebSocket Security**: Implement authentication and rate limiting
3. **Cursor Persistence**: Use database storage instead of in-memory
4. **Error Monitoring**: Integrate with error tracking services
5. **Performance**: Monitor WebSocket connection counts and memory usage

## Deployment

### Backend Setup

1. **Install Dependencies**:
   ```bash
   npm install @stellar/stellar-sdk ws
   npm install --save-dev @types/ws
   ```

2. **Start Horizon Stream Service**:
   ```typescript
   import { horizonStreamService } from './services/horizonStreamService';
   
   // Configure PetChain accounts
   const petChainAccounts = [
     'GACCOUNT1PETCHAIN...',
     'GACCOUNT2PETCHAIN...',
   ];
   
   // Start streaming
   await horizonStreamService.startTransactionStream(petChainAccounts);
   ```

3. **WebSocket Server Setup**:
   ```typescript
   import { WebSocketServer } from 'ws';
   import { horizonStreamService } from './services/horizonStreamService';
   
   const wss = new WebSocketServer({ port: 3001 });
   
   wss.on('connection', (ws) => {
     horizonStreamService.addWebSocketClient(ws);
   });
   ```

### Frontend Setup

1. **Initialize Integration**:
   ```typescript
   import blockchainIntegration from './services/blockchainIntegration';
   
   // In your app initialization
   await blockchainIntegration.initialize(petChainAccounts);
   ```

2. **Add to Medical Record Creation**:
   ```typescript
   // When creating a medical record
   const record = await createMedicalRecord(recordData);
   const recordHash = computeRecordHash(record);
   
   // Add for verification monitoring
   await blockchainIntegration.addRecordForVerification(
     record.id,
     recordHash
   );
   ```

## Monitoring and Debugging

### Logging

Both services include comprehensive logging:

```typescript
import { loggerService } from './services/loggerService';

// View recent logs
const logs = loggerService.getRecentLogs(100);

// Export logs for debugging
const exportedLogs = await loggerService.exportLogs();
```

### Health Checks

Monitor service health:

```typescript
// Check integration status
const status = blockchainIntegration.getStatus();
console.log('Connected:', status.connected);
console.log('Pending verifications:', status.pendingVerifications);

// Check event service status
const eventStatus = blockchainEventService.getStatus();
console.log('Last event:', new Date(eventStatus.lastEventTime));
```

## Security Considerations

1. **WebSocket Authentication**: Implement token-based authentication
2. **Rate Limiting**: Prevent abuse of verification endpoints
3. **Input Validation**: Validate all account addresses and record IDs
4. **Error Information**: Avoid exposing sensitive information in error messages
5. **Network Security**: Use WSS (WebSocket Secure) in production

## Performance Optimization

1. **Connection Pooling**: Reuse WebSocket connections
2. **Event Batching**: Batch multiple events for efficiency
3. **Cache Management**: Implement TTL for verification cache
4. **Memory Management**: Monitor and limit event log sizes
5. **Database Indexing**: Index verification status queries

## Troubleshooting

### Common Issues

1. **Connection Failures**: Check network connectivity and Horizon URL
2. **Missing Events**: Verify account addresses and cursor resumption
3. **High Memory Usage**: Monitor event log sizes and clear periodically
4. **Slow Verification**: Check API rate limits and batch requests

### Debug Mode

Enable debug logging:

```typescript
import { loggerService } from './services/loggerService';

loggerService.updateConfig({ level: 'debug' });
```

This implementation provides a robust, scalable solution for real-time blockchain event monitoring in the PetChain mobile application, ensuring users receive immediate updates when their medical records are verified on the Stellar blockchain.