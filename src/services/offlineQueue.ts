import { getItem, setItem } from './localDB';
import { sendAlertNotification } from './notificationService';
import syncService, { type SyncAction, type SyncEntityType, type SyncStatus } from './syncService';
import { networkMonitor } from '../utils/networkMonitor';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedMutation {
  id: string;
  type: SyncEntityType;
  action: SyncAction;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export interface OfflineQueueStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSync: number | null;
  failedCount: number;
}

type StatusListener = (status: OfflineQueueStatus) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = '@offline_queue';

// ─── OfflineQueue ─────────────────────────────────────────────────────────────

/**
 * OfflineQueue wraps SyncService to provide:
 *  - Automatic offline detection before mutations
 *  - Persistent queue via AsyncStorage
 *  - Auto-processing when connectivity is restored
 *  - User notifications for sync status changes
 */
class OfflineQueue {
  private statusListeners: StatusListener[] = [];
  private isOnline = false;
  private initialized = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Call once at app startup (e.g. in App.tsx).
   * Starts network monitoring and wires up auto-sync on reconnect.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Seed current online state
    this.isOnline = await networkMonitor.isOnline();

    // Listen for connectivity changes
    networkMonitor.onNetworkChange(async (online) => {
      const wasOffline = !this.isOnline;
      this.isOnline = online;

      if (wasOffline && online) {
        await this.notifyUser('🔄 Back online', 'Syncing your offline changes…');
        await this.processQueue();
      }

      await this.emitStatus();
    });

    // Register sync callback so networkMonitor can also trigger sync
    networkMonitor.setSyncCallback(() => this.processQueue());

    // Start monitoring
    networkMonitor.startNetworkMonitoring();

    // Forward syncService status changes to our listeners
    syncService.onStatusChange((syncStatus: SyncStatus) => {
      this.emitStatusFromSync(syncStatus);
    });
  }

  // ── Enqueue a mutation ────────────────────────────────────────────────────

  /**
   * Queue a create/update/delete mutation.
   * If online, immediately attempts to process the queue.
   * If offline, persists to AsyncStorage for later.
   */
  async enqueue(
    type: SyncEntityType,
    action: SyncAction,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Persist to our own queue key for resilience
    await this.persistToQueue({ type, action, data });

    // Also enqueue in syncService (which manages retries + conflicts)
    await syncService.enqueue(type, action, data);

    if (this.isOnline) {
      await this.processQueue();
    } else {
      await this.notifyUser(
        '📴 Saved offline',
        'Your change has been saved and will sync when you reconnect.',
      );
      await this.emitStatus();
    }
  }

  // ── Process the queue ─────────────────────────────────────────────────────

  /**
   * Flush all pending mutations to the server.
   * Called automatically on reconnect or can be triggered manually.
   */
  async processQueue(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    const pending = await this.getPersistentQueue();
    if (pending.length === 0) return;

    try {
      await syncService.push();

      // Clear our persistent queue after successful push
      await this.clearPersistentQueue();

      const status = await syncService.getStatus();
      if (status.failedCount > 0) {
        await this.notifyUser(
          '⚠️ Sync partially failed',
          `${status.failedCount} change(s) could not be synced and will be retried.`,
        );
      } else {
        await this.notifyUser('✅ Sync complete', 'All offline changes have been synced.');
      }
    } catch {
      await this.notifyUser(
        '❌ Sync failed',
        'Could not sync your changes. Will retry when connection improves.',
      );
    }

    await this.emitStatus();
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(): Promise<OfflineQueueStatus> {
    const syncStatus = await syncService.getStatus();
    const queue = await this.getPersistentQueue();
    return {
      isOnline: this.isOnline,
      pendingCount: Math.max(syncStatus.pendingCount, queue.length),
      isSyncing: syncStatus.isSyncing,
      lastSync: syncStatus.lastSync,
      failedCount: syncStatus.failedCount,
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  // ── Persistent queue helpers ──────────────────────────────────────────────

  private async persistToQueue(
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>,
  ): Promise<void> {
    const queue = await this.getPersistentQueue();
    const item: QueuedMutation = {
      id: `${mutation.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ...mutation,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(item);
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  async getPersistentQueue(): Promise<QueuedMutation[]> {
    const stored = await getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private async clearPersistentQueue(): Promise<void> {
    await setItem(QUEUE_KEY, JSON.stringify([]));
  }

  // ── Notification helper ───────────────────────────────────────────────────

  private async notifyUser(title: string, body: string): Promise<void> {
    try {
      await sendAlertNotification(title, body, { source: 'offlineQueue' });
    } catch {
      // Notifications are best-effort; never block queue operations
    }
  }

  // ── Status emission ───────────────────────────────────────────────────────

  private async emitStatus(): Promise<void> {
    const status = await this.getStatus();
    this.statusListeners.forEach((l) => l(status));
  }

  private emitStatusFromSync(syncStatus: SyncStatus): void {
    const status: OfflineQueueStatus = {
      isOnline: this.isOnline,
      pendingCount: syncStatus.pendingCount,
      isSyncing: syncStatus.isSyncing,
      lastSync: syncStatus.lastSync,
      failedCount: syncStatus.failedCount,
    };
    this.statusListeners.forEach((l) => l(status));
  }
}

export const offlineQueue = new OfflineQueue();
export default offlineQueue;
