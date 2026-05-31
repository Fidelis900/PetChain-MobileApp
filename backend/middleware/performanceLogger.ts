import type { NextFunction, Request, Response } from 'express';

type SentryLib = typeof import('@sentry/node');
let sentryLib: SentryLib | null | undefined;

function getSentry(): SentryLib | null {
  if (sentryLib !== undefined) return sentryLib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentryLib = require('@sentry/node') as SentryLib;
  } catch {
    sentryLib = null;
  }
  return sentryLib;
}

export function performanceLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const Sentry = getSentry();
  if (!Sentry) {
    next();
    return;
  }
  // start a Sentry transaction for server-side request
  const transaction = Sentry.startTransaction({ name: `${req.method} ${req.path}` });
  // attach to current scope
  Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));

  res.on('finish', () => {
    const duration = Date.now() - start;
    // set measurement
    try {
      // @ts-ignore
      transaction.setMeasurement?.('server.request_ms', duration);
    } catch (e) {
      // ignore
    }

    transaction.setHttpStatus?.(res.statusCode);
    transaction.finish();

    if (duration > 1000) {
      Sentry.captureMessage(`Slow request ${req.method} ${req.path} ${duration}ms`, {
        level: Sentry.Severity.Warning,
        extra: { duration, path: req.path, method: req.method, status: res.statusCode },
      });
    }
  });

  next();
}

export default performanceLogger;
