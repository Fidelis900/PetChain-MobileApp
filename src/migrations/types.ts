export interface Migration {
  /** Monotonically increasing integer — e.g. 1, 2, 3 */
  version: number;
  /** Human-readable description shown in logs */
  description: string;
  /** Apply the migration. Must be idempotent. */
  up: () => Promise<void>;
  /** Undo the migration. */
  down: () => Promise<void>;
}

export interface MigrationRecord {
  version: number;
  appliedAt: number;
  description: string;
}

export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  currentVersion: number;
  error?: string;
}
