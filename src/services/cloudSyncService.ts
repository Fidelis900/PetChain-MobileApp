import apiClient from './apiClient';
import { getItem, setItem } from './localDB';
import { type SyncEntityType } from './syncService';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type CloudProvider = 'server' | 'icloud' | 'google_drive';

export interface CloudSyncConfig {
  /** Which provider to use (default: server) */
  provider: CloudProvider;
  /** Entity types included in sync (default: all) */
  syncedEntities: SyncEntityType[];
  /** Auto-sync on network reconnect */
  autoSync: boolean;
}

export interface BackupMetadata {
  backupId: string;
  provider: CloudProvider;
  createdAt: string;
  sizeBytes: number;
  entityCounts: Record<SyncEntityType, number>;
}

export interface RestoreResult {
  restoredAt: string;
  entityCounts: Record<SyncEntityType, number>;
  conflicts: number;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CONFIG_KEY = '@cloud_sync_config';
const LAST_BACKUP_KEY = '@cloud_sync_last_backup';

const DEFAULT_CONFIG: CloudSyncConfig = {
  provider: 'server',
  syncedEntities: ['pet', 'appointment', 'medication', 'medicalRecord'],
  autoSync: true,
};

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

export async function getCloudSyncConfig(): Promise<CloudSyncConfig> {
  try {
    const stored = await getItem(CONFIG_KEY);
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function updateCloudSyncConfig(
  updates: Partial<CloudSyncConfig>,
): Promise<CloudSyncConfig> {
  const current = await getCloudSyncConfig();
  const updated = { ...current, ...updates };
  await setItem(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

// ─────────────────────────────────────────────────────────────
// BACKUP
// ─────────────────────────────────────────────────────────────

/**
 * Create a cloud backup.
 *
 * Server provider: calls the app's own REST API.
 * iCloud / Google Drive: stubs for native module integration.
 */
export async function createBackup(
  userId: string,
  config?: CloudSyncConfig,
): Promise<BackupMetadata> {
  const cfg = config ?? (await getCloudSyncConfig());

  if (cfg.provider === 'server') {
    const response = await apiClient.post<BackupMetadata>('/cloud-sync/backup', {
      userId,
      syncedEntities: cfg.syncedEntities,
    });
    await setItem(LAST_BACKUP_KEY, JSON.stringify(response.data));
    return response.data;
  }

  if (cfg.provider === 'icloud') {
    // iCloud integration requires the `react-native-icloud-storage` native module.
    // The backup data is retrieved from the server and stored to the iCloud key-value store.
    throw new Error(
      'iCloud sync requires the react-native-icloud-storage native module. ' +
        'Install and link it, then replace this stub with the native calls.',
    );
  }

  if (cfg.provider === 'google_drive') {
    // Google Drive integration requires `@react-native-google-signin/google-signin`
    // and the Google Drive REST API with an OAuth token.
    throw new Error(
      'Google Drive sync requires @react-native-google-signin/google-signin. ' +
        'Install and configure it, then replace this stub with Drive API calls.',
    );
  }

  throw new Error(`Unknown cloud provider: ${cfg.provider}`);
}

// ─────────────────────────────────────────────────────────────
// RESTORE
// ─────────────────────────────────────────────────────────────

export async function restoreFromBackup(userId: string, backupId: string): Promise<RestoreResult> {
  const response = await apiClient.post<RestoreResult>('/cloud-sync/restore', {
    userId,
    backupId,
  });
  return response.data;
}

// ─────────────────────────────────────────────────────────────
// SELECTIVE SYNC
// ─────────────────────────────────────────────────────────────

/**
 * Toggle sync for a specific entity type without affecting others.
 */
export async function toggleEntitySync(
  entityType: SyncEntityType,
  enabled: boolean,
): Promise<CloudSyncConfig> {
  const config = await getCloudSyncConfig();
  const syncedEntities = enabled
    ? [...new Set([...config.syncedEntities, entityType])]
    : config.syncedEntities.filter((e) => e !== entityType);

  return updateCloudSyncConfig({ syncedEntities });
}

// ─────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────

export async function getLastBackupMetadata(): Promise<BackupMetadata | null> {
  try {
    const stored = await getItem(LAST_BACKUP_KEY);
    return stored ? (JSON.parse(stored) as BackupMetadata) : null;
  } catch {
    return null;
  }
}

export async function listBackups(userId: string): Promise<BackupMetadata[]> {
  const response = await apiClient.get<BackupMetadata[]>(`/cloud-sync/backups/${userId}`);
  return response.data;
}
