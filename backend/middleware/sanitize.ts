import type { NextFunction, Request, Response } from 'express';

import { SanitizationError, sanitizeObject } from '../utils/sanitize';

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 * Responds with 400 if SQL injection is detected.
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body) as Record<string, unknown>;
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query) as typeof req.query;
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params) as typeof req.params;
    }
    next();
  } catch (err) {
    if (err instanceof SanitizationError) {
      res.status(400).json({ success: false, error: 'INVALID_INPUT', message: err.message });
      return;
    }
    next(err);
  }
}
