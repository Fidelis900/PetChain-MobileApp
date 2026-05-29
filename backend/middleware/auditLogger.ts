import { randomUUID } from 'crypto';

import type { Request } from 'express';

import { query } from '../src/db';
import type { AuditTrailAction, AuditTrailEntityType } from '../models/AuditTrail';

type JsonRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is JsonRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Build a shallow key diff.
 * - For CREATE: before=null, after=full
 * - For DELETE: before=full, after=null
 * - For UPDATE: before/after only contain changed keys
 */
export function buildAuditDiff(
  action: AuditTrailAction,
  before: unknown,
  after: unknown,
): { beforeData: JsonRecord | null; afterData: JsonRecord | null } {
  if (action === 'CREATE') {
    return { beforeData: null, afterData: isPlainObject(after) ? after : { value: after } };
  }
  if (action === 'DELETE') {
    return { beforeData: isPlainObject(before) ? before : { value: before }, afterData: null };
  }

  const b = isPlainObject(before) ? before : {};
  const a = isPlainObject(after) ? after : {};

  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const beforeData: JsonRecord = {};
  const afterData: JsonRecord = {};

  for (const k of keys) {
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      beforeData[k] = bv;
      afterData[k] = av;
    }
  }

  return {
    beforeData: Object.keys(beforeData).length ? beforeData : null,
    afterData: Object.keys(afterData).length ? afterData : null,
  };
}

function actorIdFromReq(req: Request): string | null {
  // `authenticateJWT` attaches `user` but Request typing doesn't know about it
  const u = (req as Request & { user?: { id: string } }).user;
  return u?.id ?? null;
}

/**
 * Append an audit trail row to the DB.
 * This function must never throw (audit should not break the request flow).
 */
export async function logAuditTrail(params: {
  req: Request;
  entityType: AuditTrailEntityType | string;
  entityId: string;
  action: AuditTrailAction;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const { beforeData, afterData } = buildAuditDiff(params.action, params.before, params.after);

    await query(
      `
        INSERT INTO audit_trail (
          id, entity_type, entity_id, action,
          before_data, after_data,
          changed_by, ip_address, user_agent
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        randomUUID(),
        params.entityType,
        params.entityId,
        params.action,
        beforeData,
        afterData,
        actorIdFromReq(params.req),
        params.req.ip ?? null,
        params.req.headers['user-agent'] ?? null,
      ],
    );
  } catch {
    // Swallow errors: audit logging must never break the request flow
  }
}

