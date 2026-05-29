import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import config from '../config';
import { UserRole } from '../models/UserRole';
import { sendError } from '../server/response';
import { store } from '../server/store';

/**
 * Extended Request interface to include authenticated user information
 */
export interface AuthenticatedRequest<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
  Locals extends Record<string, unknown> = Record<string, unknown>,
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Middleware to verify JWT token from Authorization header
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(
      res,
      401,
      'UNAUTHORIZED',
      'Authentication required. Please provide a Bearer token.',
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication token missing.');
  }

  try {
    // Handle mock tokens for development/testing
    if (config.isDev && token.startsWith('mock-')) {
      const userId = token.slice('mock-'.length);
      const user = store.users.get(userId);

      if (!user) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid mock token: User not found.');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      return next();
    }

    const payload = jwt.verify(token, config.app.jwtSecret) as {
      sub: string;
      email: string;
      role: UserRole;
    };

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return sendError(res, 401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
    }
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or malformed authentication token.');
  }
};

/**
 * Middleware to authorize specific roles
 * @param roles Array of allowed roles
 */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        `Access denied. Requires one of the following roles: ${roles.join(', ')}`,
      );
    }

    next();
  };
};

/**
 * Middleware that enforces 2FA completion for admin accounts.
 * Attach after authenticateJWT on any admin-only route.
 */
export const requireTwoFactor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');

  const user = store.users.get(req.user.id);
  if (user?.role === UserRole.ADMIN && !user.twoFactorEnabled) {
    return sendError(
      res,
      403,
      'TWO_FACTOR_REQUIRED',
      'Admin accounts must have 2FA enabled. Please set up 2FA before proceeding.',
    );
  }

  next();
};
