import type { NextFunction, Request, Response } from 'express';

/**
 * Attaches RFC 8594 Deprecation + Sunset headers to every v1 response.
 * Sunset date = 6 months after v2 launch (2026-06-01).
 */
export function deprecationHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Mon, 01 Dec 2026 00:00:00 GMT');
  res.setHeader(
    'Link',
    '</api/v2>; rel="successor-version", </api/docs/migration-v1-to-v2.md>; rel="deprecation"',
  );
  next();
}
