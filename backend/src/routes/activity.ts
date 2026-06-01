import express from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok, sendError } from '../response';
import wearableService from '../../services/wearableService';

const router = express.Router();
router.use(authenticateJWT);

// Link a wearable provider to a pet (OAuth callback handler or direct token exchange)
router.post('/connect', async (req: AuthenticatedRequest, res) => {
  const { petId, providerKey, accessToken, refreshToken, expiresAt } = req.body as Record<string, string>;
  if (!petId || !providerKey || !accessToken) return sendError(res, 400, 'VALIDATION_ERROR', 'petId, providerKey and accessToken are required');
  try {
    await wearableService.connectProviderOAuth(petId, providerKey, accessToken, refreshToken, expiresAt, {});
    return res.status(201).json(ok(null, 'Connected'));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Trigger on-demand sync for a pet+provider
router.post('/sync', async (req: AuthenticatedRequest, res) => {
  const { petId, providerKey } = req.body as Record<string, string>;
  if (!petId || !providerKey) return sendError(res, 400, 'VALIDATION_ERROR', 'petId and providerKey required');
  try {
    const result = await wearableService.syncProviderForPet(providerKey, petId);
    return res.json(ok(result));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Summary
router.get('/summary/:petId', async (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId;
  if (!petId) return sendError(res, 400, 'VALIDATION_ERROR', 'petId required');
  try {
    const summary = await wearableService.getActivitySummary(petId);
    return res.json(ok(summary));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Historical data
router.get('/historical/:petId', async (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId;
  const metricType = String(req.query.metricType ?? 'steps');
  const from = String(req.query.from ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString());
  const to = String(req.query.to ?? new Date().toISOString());
  try {
    const rows = await wearableService.getHistoricalActivity(petId, metricType, from, to);
    return res.json(ok(rows));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

export default router;
