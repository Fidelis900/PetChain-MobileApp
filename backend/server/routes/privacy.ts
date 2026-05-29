import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok, sendError } from '../response';
import {
  eraseUserData,
  exportUserData,
  getConsentHistory,
  logConsent,
} from '../../services/dataExportService';

const router = express.Router();
router.use(authenticateJWT);

const CONSENT_CATEGORIES = ['necessary', 'functional', 'analytics', 'marketing'] as const;

// GET /api/privacy/export — download all user data as JSON
router.get('/export', (req: AuthenticatedRequest, res) => {
  const data = exportUserData(req.user!.id);
  res.setHeader('Content-Disposition', 'attachment; filename="petchain-data-export.json"');
  res.setHeader('Content-Type', 'application/json');
  return res.json(data);
});

// GET /api/privacy/consent — get current consent state
router.get('/consent', (req: AuthenticatedRequest, res) => {
  const history = getConsentHistory(req.user!.id);
  // Latest entry per category
  const latest: Record<string, boolean> = {};
  for (const entry of history) {
    latest[entry.category] = entry.granted;
  }
  return res.json(ok({ categories: CONSENT_CATEGORIES, consents: latest }));
});

// POST /api/privacy/consent — update consent
router.post('/consent', (req: AuthenticatedRequest, res) => {
  const { consents } = req.body as { consents: Record<string, boolean> };
  if (!consents || typeof consents !== 'object') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'consents object required');
  }
  for (const [category, granted] of Object.entries(consents)) {
    if (!CONSENT_CATEGORIES.includes(category as (typeof CONSENT_CATEGORIES)[number])) {
      return sendError(res, 400, 'VALIDATION_ERROR', `Unknown category: ${category}`);
    }
    logConsent(req.user!.id, category, Boolean(granted));
  }
  return res.json(ok({ updated: Object.keys(consents) }));
});

// GET /api/privacy/consent/history — audit log
router.get('/consent/history', (req: AuthenticatedRequest, res) => {
  return res.json(ok(getConsentHistory(req.user!.id)));
});

// DELETE /api/privacy/erase — right to erasure
router.delete('/erase', (req: AuthenticatedRequest, res) => {
  eraseUserData(req.user!.id);
  return res.json(ok({ erased: true, userId: req.user!.id }));
});

export default router;
