# Backup & Disaster Recovery

## Architecture

```
Daily (02:00 UTC)
  pg_dump → gzip → SHA-256 → S3 (backups/db/<timestamp>.dump.gz)
                            → S3 (backups/db/<timestamp>.manifest.json)
                            → verify checksum from S3
  user files → incremental → S3 (backups/files/<relative-path>)
  retention → delete objects older than BACKUP_RETENTION_DAYS

Weekly (Sunday 04:00 UTC)
  restore-test workflow → backup → restore → verify probe row
```

## Required Secrets (GitHub / environment)

| Secret | Description |
|--------|-------------|
| `BACKUP_DATABASE_URL` | PostgreSQL connection string for the source database |
| `BACKUP_S3_BUCKET` | S3 bucket name |
| `BACKUP_S3_REGION` | AWS region (default: `us-east-1`) |
| `BACKUP_AWS_ACCESS_KEY_ID` | AWS access key with S3 read/write on the backup bucket |
| `BACKUP_AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty Events API v2 routing key for failure alerts |
| `BACKUP_FILES_DIR` | (optional) Local path to user-uploaded files for incremental backup |

## Environment Variables (runtime)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/petchain` | Source DB |
| `BACKUP_S3_BUCKET` | — | S3 bucket (required) |
| `BACKUP_S3_PREFIX` | `backups` | Key prefix inside the bucket |
| `BACKUP_S3_REGION` | `us-east-1` | AWS region |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep backups |
| `BACKUP_FILES_DIR` | — | Directory of user files to back up incrementally |
| `BACKUP_TEMP_DIR` | `/tmp` | Temp directory for dump files |
| `PAGERDUTY_ROUTING_KEY` | — | PagerDuty routing key |

## Running Manually

```bash
# Install AWS SDK (not bundled — install as needed)
npm install --no-save @aws-sdk/client-s3@3.600.0

# Run backup
npx ts-node backend/scripts/backup.ts

# Restore latest backup
npx ts-node backend/scripts/restore.ts

# Restore specific backup
npx ts-node backend/scripts/restore.ts --key backups/db/2026-05-31T02-00-00.dump.gz

# Point-in-time recovery (requires WAL archiving — see below)
RESTORE_TARGET_TIME=2026-05-31T10:30:00Z npx ts-node backend/scripts/restore.ts --pitr
```

## Retention

Backups older than `BACKUP_RETENTION_DAYS` (default 30) are automatically deleted from S3 after each successful backup run. Manifests are retained alongside their corresponding dump files.

## Verification

After every upload, the script downloads the backup from S3 and compares its SHA-256 checksum against the locally computed value. If they differ, the backup job fails and a PagerDuty alert is triggered.

## Incremental File Backup

User-uploaded files (documents, photos) are backed up incrementally. Before uploading, the script computes a SHA-256 of each local file and compares it against the `sha256` metadata stored on the existing S3 object. Files that have not changed are skipped.

## Point-in-Time Recovery (PITR)

Full PITR requires PostgreSQL WAL archiving to be configured:

1. Set `archive_mode = on` in `postgresql.conf`
2. Set `archive_command` to copy WAL segments to S3:
   ```
   archive_command = 'aws s3 cp %p s3://<BUCKET>/backups/wal/%f'
   ```
3. Take a base backup with `pg_basebackup` and store it in S3
4. To recover to a specific time:
   ```bash
   RESTORE_TARGET_TIME=2026-05-31T10:30:00Z \
   PGDATA=/var/lib/postgresql/data \
   npx ts-node backend/scripts/restore.ts --pitr
   ```
   This writes `postgresql.auto.conf` and `recovery.signal` to `PGDATA`. Restart PostgreSQL to begin WAL replay.

Without WAL archiving, `--pitr` falls back to restoring the nearest pg_dump taken before the target time.

## Alerting

Failures in backup, checksum verification, and restore tests trigger a PagerDuty critical alert via the Events API v2. Set `PAGERDUTY_ROUTING_KEY` to enable. If the key is absent, failures are logged but no external alert is sent.

## Restore Testing

The `restore-test.yml` workflow runs weekly and:
1. Seeds a probe row into a fresh test database
2. Runs a full backup
3. Drops and restores the database
4. Verifies the probe row is present
5. Runs the backup unit test suite

## Runbook: Emergency Restore

1. Identify the backup to restore from S3 (`backups/db/` prefix)
2. Set `DATABASE_URL` to the target database
3. Run: `npx ts-node backend/scripts/restore.ts --key <s3-key>`
4. Verify application health after restore
5. If PITR is needed, follow the WAL archiving steps above

## S3 Bucket Policy (recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::<ACCOUNT>:role/petchain-backup" },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::<BUCKET>",
        "arn:aws:s3:::<BUCKET>/backups/*"
      ]
    }
  ]
}
```

Enable S3 versioning and server-side encryption (SSE-S3 or SSE-KMS) on the bucket for additional protection.
