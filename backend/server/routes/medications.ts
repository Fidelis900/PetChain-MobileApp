/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';

import { authenticateJWT, authorizeRoles, type AuthenticatedRequest } from '../../middleware/auth';
import { logAuditTrail } from '../../middleware/auditLogger';
import { UserRole } from '../../models/UserRole';
import { ok, sendError } from '../response';
import { store, type StoredMedication } from '../store';

const router = express.Router();

// All medication routes require authentication
router.use(authenticateJWT);

router.get('/', (req: AuthenticatedRequest, res) => {
  const petId = (req.query as Record<string, string | undefined>).petId;

  // Owners must provide petId
  if (req.user!.role === UserRole.OWNER && !petId) {
    return sendError(res, 403, 'FORBIDDEN', 'PetId parameter is required for pet owners');
  }

  if (petId) {
    const pet = store.pets.get(petId);
    if (pet && req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to view these medications',
      );
    }
  }

  let list = [...store.medications.values()];
  if (petId) list = list.filter((m) => m.petId === petId);
  return res.json(ok(list));
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.medications.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medication not found');

  const pet = store.pets.get(row.petId);
  if (pet && req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this medication');
  }

  return res.json(ok(row));
});

// Admin and Vet can create, update, or delete medications
router.post('/', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  const body = req.body as Partial<StoredMedication>;
  if (
    !body.petId?.trim() ||
    !body.name?.trim() ||
    !body.dosage?.trim() ||
    !body.frequency?.trim() ||
    !body.startDate?.trim()
  ) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'petId, name, dosage, frequency, and startDate are required',
    );
  }
  if (!store.pets.get(body.petId.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }
  const id = store.newId();
  const row: StoredMedication = {
    id,
    petId: body.petId.trim(),
    name: body.name.trim(),
    dosage: body.dosage.trim(),
    frequency: body.frequency.trim(),
    startDate: body.startDate.trim(),
    endDate: body.endDate?.trim(),
    active: body.active !== false,
  };
  store.medications.set(id, row);
  void logAuditTrail({
    req,
    entityType: 'medication',
    entityId: id,
    action: 'CREATE',
    before: null,
    after: row,
  });
  return res.status(201).json(ok(row, 'Medication created'));
});

router.put('/:id', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  const row = store.medications.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Medication not found');
  const b = req.body as Partial<StoredMedication>;
  const next: StoredMedication = {
    ...row,
    ...(b.name !== undefined ? { name: String(b.name) } : {}),
    ...(b.dosage !== undefined ? { dosage: String(b.dosage) } : {}),
    ...(b.frequency !== undefined ? { frequency: String(b.frequency) } : {}),
    ...(b.startDate !== undefined ? { startDate: String(b.startDate) } : {}),
    ...(b.endDate !== undefined ? { endDate: b.endDate } : {}),
    ...(b.active !== undefined ? { active: Boolean(b.active) } : {}),
    ...(b.petId !== undefined ? { petId: String(b.petId) } : {}),
  };
  store.medications.set(row.id, next);
  void logAuditTrail({
    req,
    entityType: 'medication',
    entityId: row.id,
    action: 'UPDATE',
    before: row,
    after: next,
  });
  return res.json(ok(next, 'Medication updated'));
});

router.delete('/:id', authorizeRoles(UserRole.ADMIN, UserRole.VET), (req, res) => {
  const existing = store.medications.get(req.params.id);
  if (!existing) {
    return sendError(res, 404, 'NOT_FOUND', 'Medication not found');
  }
  store.medications.delete(req.params.id);
  void logAuditTrail({
    req,
    entityType: 'medication',
    entityId: existing.id,
    action: 'DELETE',
    before: existing,
    after: null,
  });
  return res.json(ok(null, 'Medication deleted'));
});

export default router;
