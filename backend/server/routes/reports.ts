import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { generateHealthReport } from '../../services/reportService';
import { sendError } from '../response';
import { store } from '../store';

const router = express.Router();

router.use(authenticateJWT);

/**
 * GET /api/reports/pets/:petId/health
 * Generate and download a PDF health report for a pet.
 * Query params: dateFrom, dateTo (ISO date strings, optional)
 */
router.get('/pets/:petId/health', async (req: AuthenticatedRequest, res) => {
  const { petId } = req.params as { petId: string };
  const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };

  const pet = store.pets.get(petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');

  if (pet.ownerId !== req.user?.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the pet owner may generate reports');
  }

  const owner = store.users.get(pet.ownerId);
  if (!owner) return sendError(res, 404, 'NOT_FOUND', 'Owner not found');

  const records = [...store.medicalRecords.values()].filter((r) => r.petId === petId);
  const medications = [...store.medications.values()].filter((m) => m.petId === petId);

  try {
    const result = await generateHealthReport({
      pet,
      owner,
      records,
      medications,
      generatedBy: req.user?.id ?? 'unknown',
      dateFrom,
      dateTo,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Record-Count', String(result.recordCount));
    res.send(result.buffer);
  } catch (err) {
    console.error('[reports] PDF generation failed:', err);
    return sendError(res, 500, 'REPORT_FAILED', 'Failed to generate health report');
  }
});

export default router;
