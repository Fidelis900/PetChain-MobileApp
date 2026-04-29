import cors from 'cors';
import express, { type Express } from 'express';

import { errBody } from './response';
import { sanitizeInputs } from '../middleware/sanitize';
import analyticsRouter from './routes/analytics';
import appointmentsRouter from './routes/appointments';
import auditLogsRouter from './routes/auditLogs';
import backupsRouter from './routes/backups';
import communityRouter from './routes/community';
import importRouter from './routes/import';
import medicalRecordsRouter from './routes/medicalRecords';
import medicationsRouter from './routes/medications';
import paymentsRouter from './routes/payments';
import petsRouter from './routes/pets';
import usersRouter from './routes/users';
import importRouter from './routes/import';
import paymentsRouter from './routes/payments';
import docsRouter from './routes/docs';
import { attachAudit } from '../middleware/auditLog';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(sanitizeInputs);
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

  app.use('/api', api);

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Unhandled Error:', err);
    res.status(500).json(errBody('INTERNAL_ERROR', err.message || 'An unexpected error occurred'));
  });

  app.use((_req, res) => {
    res.status(404).json(errBody('NOT_FOUND', 'Route not found'));
  });

  return app;
}
