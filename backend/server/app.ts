import path from 'path';

import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { errBody } from './response';
import { getRedisClient } from '../config/redis';
import { createRedisSessionMiddleware } from '../middleware/redisSession';
import { sanitizeInputs } from '../middleware/sanitize';
import { applySecurityHeaders } from '../middleware/securityHeaders';
import authRouter from './routes/auth';
import { requestLogger } from '../middleware/requestLogger';
import logger from '../utils/logger';
import { getCacheMetrics, warmCache } from '../services/cacheService';
import anchorRouter from '../src/routes/anchor';
import analyticsRouter from './routes/analytics';
import performanceLogger from '../middleware/performanceLogger';
import appointmentsRouter from './routes/appointments';
import auditLogsRouter from './routes/auditLogs';
import auditTrailRouter from './routes/auditTrail';
import backupsRouter from './routes/backups';
import breedsRouter from './routes/breeds';
import communityRouter from './routes/community';
import forumRouter from './routes/forum';
import docsRouter from './routes/docs';
import emergencyRouter from './routes/emergency';
import importRouter from './routes/import';
import insuranceRouter from './routes/insurance';
import medicalRecordsRouter from './routes/medicalRecords';
import medicationsRouter from './routes/medications';
import paymentsRouter from './routes/payments';
import petsRouter from './routes/pets';
import photosRouter from './routes/photos';
import privacyRouter from './routes/privacy';
import reportsRouter from './routes/reports';
import searchRouter from './routes/search';
import syncRouter from './routes/sync';
import travelCertificatesRouter from './routes/travelCertificates';
import telemedicineRouter from './routes/telemedicine';
import reconciliationRouter from './routes/reconciliation';
import usersRouter from './routes/users';
import vaccinationsRouter from './routes/vaccinations';
import vetsRouter from './routes/vets';
import vitalsRouter from './routes/vitals';
import { attachAudit } from '../middleware/auditLog';
import federationRouter from '../src/routes/federation';

// Readiness probe state — set to false while the process is draining
let isReady = true;
export function setReadiness(ready: boolean): void {
  isReady = ready;
}

export function createApp(): Express {
  const app = express();

  // Security headers (Helmet + CSP + HSTS) — applied before any routes
  applySecurityHeaders(app);

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(sanitizeInputs);
  // performance logging middleware (Sentry)
  app.use(performanceLogger);
  app.use(createRedisSessionMiddleware());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(attachAudit as any);

  // Serve stellar.toml for federation discovery
  app.use(
    '/.well-known',
    express.static(path.join(__dirname, '../.well-known'), { dotfiles: 'allow' }),
  );

  const api = express.Router();

  // --- Cache metrics (unauthenticated) ----------------------------------------
  api.get('/cache/metrics', (_req, res) => {
    res.json(getCacheMetrics());
  });

  // --- Health & readiness probes (unauthenticated) -----------------------
  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'petchain-api', timestamp: new Date().toISOString() });
  });

  api.get('/ready', (_req, res) => {
    if (!isReady) {
      res.status(503).json({
        ok: false,
        service: 'petchain-api',
        reason: 'Shutting down — draining connections',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ ok: true, service: 'petchain-api', timestamp: new Date().toISOString() });
  });

  // --- Application routes ------------------------------------------------
  api.use('/auth', authRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/anchor', anchorRouter);
  api.use('/backups', backupsRouter);
  api.use('/federation', federationRouter);
  api.use('/users', usersRouter);
  api.use('/pets', petsRouter);
  api.use('/medical-records', medicalRecordsRouter);
  api.use('/appointments', appointmentsRouter);
  api.use('/telemedicine', telemedicineRouter);
  api.use('/medications', medicationsRouter);
  api.use('/vaccinations', vaccinationsRouter);
  api.use('/import', importRouter);
  api.use('/payments', paymentsRouter);
  api.use('/audit-logs', auditLogsRouter);
  api.use('/audit-trail', auditTrailRouter);
  api.use('/docs', docsRouter);
  api.use('/emergency', emergencyRouter);
  api.use('/community', communityRouter);
  api.use('/forum', forumRouter);
  api.use('/photos', photosRouter);
  api.use('/breeds', breedsRouter);
  api.use('/reports', reportsRouter);
  api.use('/sync', syncRouter);
  api.use('/travel-certificates', travelCertificatesRouter);
  api.use('/reconciliation', reconciliationRouter);
  api.use('/vets', vetsRouter);
  api.use('/privacy', privacyRouter);
  api.use('/insurance', insuranceRouter);
  api.use('/search', searchRouter);
  api.use('/vitals', vitalsRouter);

  app.use('/api', api);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json(errBody('INTERNAL_ERROR', err.message || 'An unexpected error occurred'));
  });

  app.use((_req, res) => {
    res.status(404).json(errBody('NOT_FOUND', 'Route not found'));
  });

  // Initiate Redis connection and warm the cache safely
  getRedisClient()
    .connect()
    .catch(() => {});
  warmCache().catch((err: any) => console.error('[app] warmCache failed:', err.message));

  return app;
}
