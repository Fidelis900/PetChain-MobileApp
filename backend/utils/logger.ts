/**
 * Structured Winston logger
 * Issue #99 — Comprehensive Logging Infrastructure
 *
 * Features:
 * - Structured JSON output with consistent fields
 * - Log levels: error, warn, info, http, debug
 * - Correlation ID propagation via AsyncLocalStorage
 * - Daily log rotation with configurable retention
 * - Transports: console, rotating file, Datadog/Papertrail/ELK (env-driven)
 * - Error rate spike alerting via a sliding-window counter
 */

import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// ─── Correlation ID store ─────────────────────────────────────────────────────

export interface LogContext {
  correlationId?: string;
  userId?: string;
  service?: string;
  [key: string]: unknown;
}

export const correlationStore = new AsyncLocalStorage<LogContext>();

export function getCorrelationId(): string | undefined {
  return correlationStore.getStore()?.correlationId;
}

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return correlationStore.run(ctx, fn);
}

// ─── Log directory ────────────────────────────────────────────────────────────

const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');

// ─── Custom format ────────────────────────────────────────────────────────────

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const ctx = correlationStore.getStore() ?? {};
    const entry: Record<string, unknown> = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: process.env.SERVICE_NAME ?? 'petchain-api',
      env: process.env.APP_ENV ?? 'development',
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      ...(info.stack ? { stack: info.stack } : {}),
    };

    // Merge any extra fields passed as metadata
    const { timestamp: _t, level: _l, message: _m, stack: _s, ...rest } = info;
    Object.assign(entry, rest);

    // Remove undefined keys for clean JSON
    for (const key of Object.keys(entry)) {
      if (entry[key] === undefined) delete entry[key];
    }

    return JSON.stringify(entry);
  }),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const ctx = correlationStore.getStore() ?? {};
    const cid = ctx.correlationId ? ` [${ctx.correlationId.slice(0, 8)}]` : '';
    return `${info.timestamp}${cid} ${info.level}: ${info.message}`;
  }),
);

// ─── Transports ───────────────────────────────────────────────────────────────

function buildTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console — always on; pretty in dev, JSON in prod
  const isDev = (process.env.APP_ENV ?? 'development') === 'development';
  transports.push(
    new winston.transports.Console({
      format: isDev ? consoleFormat : structuredFormat,
      silent: process.env.NODE_ENV === 'test',
    }),
  );

  // Rotating file — combined
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'petchain-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE ?? '20m',
      maxFiles: process.env.LOG_RETENTION_DAYS ? `${process.env.LOG_RETENTION_DAYS}d` : '14d',
      format: structuredFormat,
    }),
  );

  // Rotating file — errors only
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'petchain-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE ?? '20m',
      maxFiles: process.env.LOG_RETENTION_DAYS ? `${process.env.LOG_RETENTION_DAYS}d` : '30d',
      format: structuredFormat,
    }),
  );

  // ── Datadog HTTP transport (opt-in via env) ──────────────────────────────
  if (process.env.DATADOG_API_KEY) {
    const { default: DatadogWinston } = require('datadog-winston') as {
      default: new (opts: Record<string, unknown>) => winston.transport;
    };
    transports.push(
      new DatadogWinston({
        apiKey: process.env.DATADOG_API_KEY,
        hostname: process.env.HOSTNAME ?? 'petchain-api',
        service: process.env.SERVICE_NAME ?? 'petchain-api',
        ddsource: 'nodejs',
        ddtags: `env:${process.env.APP_ENV ?? 'development'}`,
      }),
    );
  }

  // ── Papertrail transport (opt-in via env) ────────────────────────────────
  if (process.env.PAPERTRAIL_HOST && process.env.PAPERTRAIL_PORT) {
    const { Papertrail } = require('winston-papertrail') as {
      Papertrail: new (opts: Record<string, unknown>) => winston.transport;
    };
    transports.push(
      new Papertrail({
        host: process.env.PAPERTRAIL_HOST,
        port: Number(process.env.PAPERTRAIL_PORT),
        program: process.env.SERVICE_NAME ?? 'petchain-api',
        colorize: false,
      }),
    );
  }

  // ── ELK / Logstash HTTP transport (opt-in via env) ───────────────────────
  if (process.env.LOGSTASH_URL) {
    const { default: WinstonLogstash } = require('winston-logstash-transport') as {
      default: new (opts: Record<string, unknown>) => winston.transport;
    };
    transports.push(
      new WinstonLogstash({
        mode: 'http',
        host: process.env.LOGSTASH_URL,
        applicationName: process.env.SERVICE_NAME ?? 'petchain-api',
      }),
    );
  }

  return transports;
}

// ─── Logger instance ──────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (process.env.APP_ENV === 'production' ? 'info' : 'debug'),
  transports: buildTransports(),
  exitOnError: false,
});

export default logger;

// ─── Error rate alerting ──────────────────────────────────────────────────────

const ERROR_WINDOW_MS = Number(process.env.ALERT_WINDOW_MS ?? 60_000);   // 1 min
const ERROR_THRESHOLD = Number(process.env.ALERT_ERROR_THRESHOLD ?? 10); // 10 errors/min

const errorTimestamps: number[] = [];

export function trackError(): void {
  const now = Date.now();
  errorTimestamps.push(now);

  // Evict entries outside the window
  const cutoff = now - ERROR_WINDOW_MS;
  while (errorTimestamps.length > 0 && errorTimestamps[0]! < cutoff) {
    errorTimestamps.shift();
  }

  if (errorTimestamps.length >= ERROR_THRESHOLD) {
    logger.warn('ALERT: error rate spike detected', {
      errorsInWindow: errorTimestamps.length,
      windowMs: ERROR_WINDOW_MS,
      threshold: ERROR_THRESHOLD,
      alert: true,
    });
    // Drain the window so we don't spam the alert every single error
    errorTimestamps.length = 0;
  }
}

/** Expose for testing */
export function _resetErrorWindow(): void {
  errorTimestamps.length = 0;
}
