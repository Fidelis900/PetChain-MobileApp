/**
 * Audit log service — records and queries important system actions.
 * Uses in-memory store (mirrors existing pattern); swap for DB repository when going live.
 */

import { randomUUID } from 'crypto';

import type { AuditAction, AuditLog, AuditLogQuery, AuditResourceType } from '../models/AuditLog';

const logs: AuditLog[] = [];

export interface LogParams {
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record an audit event. Fire-and-forget — never throws.
 */
function log(params: LogParams): void {
  try {
    logs.push({
      id: randomUUID(),
      ...params,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Audit logging must never break the main request flow
  }
}

/**
 * Query audit logs with optional filters and pagination.
 */
function query(q: AuditLogQuery = {}): {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(200, Math.max(1, q.limit ?? 50));

  let result = [...logs];

  if (q.actorId) result = result.filter((l) => l.actorId === q.actorId);
  if (q.action) result = result.filter((l) => l.action === q.action);
  if (q.resourceType) result = result.filter((l) => l.resourceType === q.resourceType);
  if (q.resourceId) result = result.filter((l) => l.resourceId === q.resourceId);
  if (q.startDate) {
    const s = q.startDate;
    result = result.filter((l) => l.createdAt >= s);
  }
  if (q.endDate) {
    const e = q.endDate;
    result = result.filter((l) => l.createdAt <= e);
  }

  // Newest first
  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = result.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const data = result.slice((page - 1) * limit, page * limit);

  return { data, total, page, limit, totalPages };
}

export default { log, query };
