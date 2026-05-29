/**
 * Request logger middleware
 * Issue #99 — Comprehensive Logging Infrastructure
 *
 * - Generates a UUID correlation ID per request (or reads X-Correlation-ID header)
 * - Propagates the correlation ID through AsyncLocalStorage for the full request lifecycle
 * - Attaches correlation ID to the response as X-Correlation-ID
 * - Logs structured HTTP access entries (method, path, status, duration, user)
 * - Calls trackError() on 5xx responses for rate-spike alerting
 */

import { randomUUID } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

import logger, { runWithContext, trackError } from '../utils/logger';

export const CORRELATION_HEADER = 'x-correlation-id';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const correlationId =
    (req.headers[CORRELATION_HEADER] as string | undefined) ?? randomUUID();

  // Expose on the request object so downstream handlers can read it
  (req as Request & { correlationId: string }).correlationId = correlationId;

  // Set on response immediately so it's present even on early errors
  res.setHeader(CORRELATION_HEADER, correlationId);

  const startMs = Date.now();

  // Run the rest of the request inside the correlation context
  runWithContext({ correlationId, userId: (req as Request & { user?: { id: string } }).user?.id }, () => {
    logger.http('incoming request', {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length ? req.query : undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.on('finish', () => {
      const durationMs = Date.now() - startMs;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

      logger.log(level, 'request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
        correlationId,
      });

      if (res.statusCode >= 500) {
        trackError();
      }
    });

    next();
  });
}
