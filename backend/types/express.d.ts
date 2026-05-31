import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    db?: unknown;
    user?: unknown;
    /** Correlation ID injected by requestLogger middleware */
    correlationId?: string;
  }
}
