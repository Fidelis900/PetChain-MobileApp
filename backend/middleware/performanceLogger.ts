import type { NextFunction, Request, Response } from 'express';

type SentryLib = any;
let sentryLib: SentryLib | null | undefined;

function getSentry(): SentryLib | null {
  if (sentryLib !== undefined) return sentryLib;
  try {
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

  res.on('finish', () => {
    const duration = Date.now() - start;
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.path}`,
      data: { duration, status: res.statusCode },
    });

    if (duration > 1000) {
      Sentry.captureMessage(`Slow request ${req.method} ${req.path} ${duration}ms`, {
        level: 'warning',
        extra: { duration, path: req.path, method: req.method, status: res.statusCode },
      });
    }
  });

  next();
}

export default performanceLogger;
