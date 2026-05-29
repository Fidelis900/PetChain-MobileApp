/**
 * Analytics Routes — /monitoring
 *
 * Handles session lifecycle events, crash reports, and crash-free rate analytics.
 * Designed to be mounted at /api/monitoring in the Express app.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import { AppError } from '../../middleware/errorHandler';
import type { ApiResponse, ApiError } from '../../types/api';
import {
  sessionStore,
  crashStore,
  analyticsEngine,
  alertService,
} from '../services/analyticsService';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceMetadata {
  model: string;
  os: string;
  osVersion: string;
  appVersion: string;
  platform: string;
}

interface StartSessionBody {
  sessionId: string;
  startedAt: string;
  device: DeviceMetadata;
  appVersion: string;
}

interface EndSessionBody {
  sessionId: string;
  endedAt: string;
  status: 'ended' | 'abnormal';
  durationMs: number;
  flowPath: string[];
  errorCount: number;
  hasCrash: boolean;
  recoveredFromInterruption?: boolean;
}

interface CrashReportBody {
  sessionId: string;
  error: string;
  stack?: string;
  timestamp: number;
  appVersion: string;
  device: DeviceMetadata;
  activeFlow: string;
  flowPath: string[];
}

interface SessionEventBody {
  id: string;
  sessionId: string;
  type: string;
  flow: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface BatchEventsBody {
  events: SessionEventBody[];
}

interface AlertBody {
  type: string;
  appVersion: string;
  currentRate: number;
  threshold: number;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function success<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  res.status(statusCode).json(body);
}

function validateRequired(
  fields: Record<string, unknown>,
  required: string[],
): string | null {
  for (const field of required) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      return field;
    }
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /monitoring/sessions/start
 * Record a new session start event with device and OS metadata.
 */
router.post(
  '/sessions/start',
  async (req: Request<object, object, StartSessionBody>, res: Response, next: NextFunction) => {
    try {
      const { sessionId, startedAt, device, appVersion } = req.body;

      const missing = validateRequired(req.body, ['sessionId', 'startedAt', 'device', 'appVersion']);
      if (missing) {
        throw new AppError(`Missing required field: ${missing}`, 400, 'MISSING_FIELD');
      }

      if (!device?.model || !device?.os || !device?.osVersion || !device?.platform) {
        throw new AppError('device must include model, os, osVersion, and platform', 400, 'INVALID_DEVICE_METADATA');
      }

      const session = await sessionStore.create({
        id: sessionId,
        startedAt: new Date(startedAt).getTime(),
        status: 'active',
        device,
        appVersion,
        flowPath: [],
        hasCrash: false,
        errorCount: 0,
      });

      success(res, { sessionId: session.id, recorded: true }, 201);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /monitoring/sessions/end
 * Record session end with final status, duration, and flow path.
 */
router.post(
  '/sessions/end',
  async (req: Request<object, object, EndSessionBody>, res: Response, next: NextFunction) => {
    try {
      const {
        sessionId,
        endedAt,
        status,
        durationMs,
        flowPath,
        errorCount,
        hasCrash,
        recoveredFromInterruption,
      } = req.body;

      const missing = validateRequired(req.body, ['sessionId', 'endedAt', 'status']);
      if (missing) {
        throw new AppError(`Missing required field: ${missing}`, 400, 'MISSING_FIELD');
      }

      if (!['ended', 'abnormal'].includes(status)) {
        throw new AppError('status must be "ended" or "abnormal"', 400, 'INVALID_STATUS');
      }

      await sessionStore.update(sessionId, {
        endedAt: new Date(endedAt).getTime(),
        status,
        durationMs,
        flowPath: flowPath ?? [],
        errorCount: errorCount ?? 0,
        hasCrash: hasCrash ?? false,
        recoveredFromInterruption: recoveredFromInterruption ?? false,
      });

      success(res, { sessionId, recorded: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /monitoring/crashes
 * Ingest a crash report and associate it with the session.
 */
router.post(
  '/crashes',
  async (req: Request<object, object, CrashReportBody>, res: Response, next: NextFunction) => {
    try {
      const { sessionId, error, stack, timestamp, appVersion, device, activeFlow, flowPath } =
        req.body;

      const missing = validateRequired(req.body, [
        'sessionId',
        'error',
        'timestamp',
        'appVersion',
        'device',
        'activeFlow',
      ]);
      if (missing) {
        throw new AppError(`Missing required field: ${missing}`, 400, 'MISSING_FIELD');
      }

      const report = await crashStore.create({
        sessionId,
        error,
        stack,
        timestamp,
        appVersion,
        device,
        activeFlow,
        flowPath: flowPath ?? [],
        recordedAt: Date.now(),
      });

      // Mark the session as crashed
      await sessionStore.update(sessionId, { status: 'crashed', hasCrash: true }).catch(() => {
        // Session may not exist if crash happened outside a tracked session
      });

      success(res, { crashId: report.id, recorded: true }, 201);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /monitoring/events
 * Batch-ingest session events (navigation, errors, user actions).
 */
router.post(
  '/events',
  async (req: Request<object, object, BatchEventsBody>, res: Response, next: NextFunction) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        throw new AppError('events must be a non-empty array', 400, 'INVALID_EVENTS');
      }

      if (events.length > 200) {
        throw new AppError('Maximum 200 events per batch', 400, 'BATCH_TOO_LARGE');
      }

      const results = await Promise.allSettled(
        events.map((event) =>
          sessionStore.addEvent({
            id: event.id,
            sessionId: event.sessionId,
            type: event.type,
            flow: event.flow,
            timestamp: event.timestamp,
            data: event.data ?? {},
          }),
        ),
      );

      const accepted = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.length - accepted;

      success(res, { accepted, rejected, total: events.length });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /monitoring/analytics/crash-free
 * Calculate crash-free session rate per app version.
 * Query params: appVersion (optional)
 */
router.get(
  '/analytics/crash-free',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appVersion = req.query.appVersion as string | undefined;

      const stats = await analyticsEngine.getCrashFreeStats(appVersion);

      success(res, stats);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /monitoring/analytics/crash-flows
 * Return the top 5 crash-prone user flows.
 * Query params: appVersion (optional), limit (default 5)
 */
router.get(
  '/analytics/crash-flows',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appVersion = req.query.appVersion as string | undefined;
      const limit = Math.min(Number(req.query.limit ?? 5), 20);

      const flows = await analyticsEngine.getTopCrashFlows(appVersion, limit);

      success(res, { flows, appVersion: appVersion ?? 'all' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /monitoring/analytics/device-breakdown
 * Correlate crashes with specific device models and OS versions.
 */
router.get(
  '/analytics/device-breakdown',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appVersion = req.query.appVersion as string | undefined;

      const breakdown = await analyticsEngine.getDeviceBreakdown(appVersion);

      success(res, breakdown);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /monitoring/alerts
 * Receive and persist crash-free rate alert notifications.
 */
router.post(
  '/alerts',
  async (req: Request<object, object, AlertBody>, res: Response, next: NextFunction) => {
    try {
      const { type, appVersion, currentRate, threshold, timestamp } = req.body;

      const missing = validateRequired(req.body, ['type', 'appVersion', 'currentRate', 'threshold']);
      if (missing) {
        throw new AppError(`Missing required field: ${missing}`, 400, 'MISSING_FIELD');
      }

      await alertService.record({
        type,
        appVersion,
        currentRate,
        threshold,
        timestamp: timestamp ?? new Date().toISOString(),
      });

      success(res, { recorded: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /monitoring/alerts
 * List recent crash-free rate alerts.
 * Query params: appVersion (optional), limit (default 20)
 */
router.get(
  '/alerts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appVersion = req.query.appVersion as string | undefined;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);

      const alerts = await alertService.list(appVersion, limit);

      success(res, { alerts, total: alerts.length });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
