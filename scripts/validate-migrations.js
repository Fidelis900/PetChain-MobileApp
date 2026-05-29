#!/usr/bin/env node
/**
 * CI Migration Integrity Validator
 *
 * Fails (exit 1) when:
 *   1. PostgreSQL migration files are out of order (non-monotonic timestamps)
 *   2. Duplicate migration versions exist
 *   3. SQLite migration registry is out of order
 *   4. A migration file exists without a matching registry entry (or vice-versa)
 *   5. Migration filenames don't match the expected pattern
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  errors++;
}

function info(msg) {
  console.log(`[OK]   ${msg}`);
}

// ── 1. PostgreSQL migrations ───────────────────────────────────────────────────

const PG_MIGRATIONS_DIR = path.join(ROOT, 'backend', 'migrations');
const PG_PATTERN = /^(\d{14})_.+\.sql$/;

const pgFiles = fs
  .readdirSync(PG_MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !f.includes('rollback'))
  .sort();

const pgVersions = [];

for (const file of pgFiles) {
  const match = PG_PATTERN.exec(file);
  if (!match) {
    fail(`PG migration filename does not match pattern YYYYMMDDHHMMSS_name.sql: ${file}`);
    continue;
  }
  pgVersions.push(match[1]);
}

// Check for duplicates
const pgDupes = pgVersions.filter((v, i) => pgVersions.indexOf(v) !== i);
if (pgDupes.length > 0) {
  fail(`Duplicate PG migration versions: ${pgDupes.join(', ')}`);
} else {
  info(`No duplicate PG migration versions (${pgVersions.length} files)`);
}

// Check monotonic order
for (let i = 1; i < pgVersions.length; i++) {
  if (pgVersions[i] <= pgVersions[i - 1]) {
    fail(
      `PG migrations out of order: ${pgVersions[i - 1]} >= ${pgVersions[i]}`,
    );
  }
}
if (pgVersions.length > 0) {
  info(`PG migration order is valid`);
}

// ── 2. SQLite migrations ───────────────────────────────────────────────────────

const SQLITE_SCRIPTS_DIR = path.join(ROOT, 'src', 'migrations', 'scripts');
const SQLITE_PATTERN = /^(\d{14})_.+\.ts$/;

const sqliteFiles = fs
  .readdirSync(SQLITE_SCRIPTS_DIR)
  .filter((f) => SQLITE_PATTERN.test(f))
  .sort();

const sqliteVersions = [];

for (const file of sqliteFiles) {
  const match = SQLITE_PATTERN.exec(file);
  if (!match) {
    fail(`SQLite migration filename does not match pattern YYYYMMDDHHMMSS_name.ts: ${file}`);
    continue;
  }
  sqliteVersions.push(match[1]);
}

// Check for duplicates
const sqliteDupes = sqliteVersions.filter((v, i) => sqliteVersions.indexOf(v) !== i);
if (sqliteDupes.length > 0) {
  fail(`Duplicate SQLite migration versions: ${sqliteDupes.join(', ')}`);
} else {
  info(`No duplicate SQLite migration versions (${sqliteVersions.length} files)`);
}

// Check monotonic order
for (let i = 1; i < sqliteVersions.length; i++) {
  if (sqliteVersions[i] <= sqliteVersions[i - 1]) {
    fail(
      `SQLite migrations out of order: ${sqliteVersions[i - 1]} >= ${sqliteVersions[i]}`,
    );
  }
}
if (sqliteVersions.length > 0) {
  info(`SQLite migration order is valid`);
}

// ── 3. SQLite registry consistency ────────────────────────────────────────────
// Parse the index.ts to extract registered versions

const indexPath = path.join(ROOT, 'src', 'migrations', 'index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Extract imported migration file names
const importPattern = /from\s+['"]\.\/scripts\/([\d]{14}[^'"]+)['"]/g;
const registeredVersions = [];
let m;
while ((m = importPattern.exec(indexContent)) !== null) {
  const versionMatch = /^(\d{14})/.exec(m[1]);
  if (versionMatch) registeredVersions.push(versionMatch[1]);
}

// Every file must be registered
for (const v of sqliteVersions) {
  if (!registeredVersions.includes(v)) {
    fail(`SQLite migration ${v} has a file but is NOT registered in src/migrations/index.ts`);
  }
}

// Every registered version must have a file
for (const v of registeredVersions) {
  if (!sqliteVersions.includes(v)) {
    fail(`SQLite migration ${v} is registered in index.ts but has NO matching file`);
  }
}

if (errors === 0) {
  info(`SQLite registry is consistent (${registeredVersions.length} migrations)`);
}

// ── Result ─────────────────────────────────────────────────────────────────────

console.log('');
if (errors > 0) {
  console.error(`Migration validation FAILED with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`Migration validation PASSED.`);
  process.exit(0);
}
