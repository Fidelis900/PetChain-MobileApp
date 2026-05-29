import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { errBody } from './response';
import { createRedisSessionMiddleware } from '../middleware/redisSession';
import { sanitizeInputs } from '../middleware/sanitize';
import { applySecurityHeaders } from '../middleware/securityHeaders';
import analyticsRouter from './routes/analytics';
import appointmentsRouter from './routes/appointments';
import auditLogsRouter from './routes/auditLogs';
import auditTrailRouter from './routes/auditTrail';
import backupsRouter from './routes/backups';
import breedsRouter from './routes/breeds';
import communityRouter from './routes/community';
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
import searchRouter from './routes/search';
import syncRouter from './routes/sync';
import travelCertificatesRouter from './routes/travelCertificates';
import telemedicineRouter from './routes/telemedicine';
import usersRouter from './routes/users';
import vaccinationsRouter from './routes/vaccinations';
import vetsRouter from './routes/vets';
import vitalsRouter from './routes/vitals';
import { attachAudit } from '../middleware/auditLog';

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
  app.use(sanitizeInputs);
  app.use(createRedisSessionMiddleware());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(attachAudit as any);

  const api = express.Router();

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
  api.use('/analytics', analyticsRouter);
  api.use('/backups', backupsRouter);
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
  api.use('/photos', photosRouter);
  api.use('/breeds', breedsRouter);
  api.use('/sync', syncRouter);
  api.use('/travel-certificates', travelCertificatesRouter);
  api.use('/vets', vetsRouter);
  api.use('/privacy', privacyRouter);
  api.use('/insurance', insuranceRouter);
  api.use('/search', searchRouter);
  api.use('/vitals', vitalsRouter);

  app.use('/api', api);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json(errBody('INTERNAL_ERROR', err.message || 'An unexpected error occurred'));
  });

  app.use((_req, res) => {
    res.status(404).json(errBody('NOT_FOUND', 'Route not found'));
  });

  return app;
}
