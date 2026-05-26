import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { errBody } from './response';
import { sanitizeInputs } from '../middleware/sanitize';
import analyticsRouter from './routes/analytics';
import appointmentsRouter from './routes/appointments';
import auditLogsRouter from './routes/auditLogs';
import backupsRouter from './routes/backups';
import communityRouter from './routes/community';
import docsRouter from './routes/docs';
import emergencyRouter from './routes/emergency';
import importRouter from './routes/import';
import medicalRecordsRouter from './routes/medicalRecords';
import medicationsRouter from './routes/medications';
import paymentsRouter from './routes/payments';
import petsRouter from './routes/pets';
import syncRouter from './routes/sync';
import usersRouter from './routes/users';
import { attachAudit } from '../middleware/auditLog';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(sanitizeInputs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(attachAudit as any);

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'petchain-api', timestamp: new Date().toISOString() });
  });

  api.use('/analytics', analyticsRouter);
  api.use('/backups', backupsRouter);
  api.use('/users', usersRouter);
  api.use('/pets', petsRouter);
  api.use('/medical-records', medicalRecordsRouter);
  api.use('/appointments', appointmentsRouter);
  api.use('/medications', medicationsRouter);
  api.use('/import', importRouter);
  api.use('/payments', paymentsRouter);
  api.use('/audit-logs', auditLogsRouter);
  api.use('/docs', docsRouter);
  api.use('/emergency', emergencyRouter);
  api.use('/community', communityRouter);
  api.use('/sync', syncRouter);

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
