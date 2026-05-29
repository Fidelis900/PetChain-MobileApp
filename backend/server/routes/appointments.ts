/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { logAuditTrail } from '../../middleware/auditLogger';
import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { UserRole } from '../../models/UserRole';
import { ok, sendError } from '../response';
import { store, type StoredAppointment } from '../store';

const router = express.Router();

function toResponse(a: StoredAppointment) {
  return {
    success: true as const,
    data: a,
    timestamp: new Date().toISOString(),
  };
}

// All appointment routes require authentication
router.use(authenticateJWT);

router.get('/', (req: AuthenticatedRequest, res) => {
  const petId = (req.query as Record<string, string | undefined>).petId;
  const vetId = (req.query as Record<string, string | undefined>).vetId;

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
        'You do not have permission to view these appointments',
      );
    }
  }

  // Vets should see their own appointments if not specified otherwise
  if (req.user!.role === UserRole.VET && !vetId && !petId) {
    // default to showing vet's appointments
  }

  let list = [...store.appointments.values()];
  if (petId) list = list.filter((a) => a.petId === petId);
  if (vetId) list = list.filter((a) => a.vetId === vetId);

  if (req.user!.role === UserRole.VET && !petId && !vetId) {
    list = list.filter((a) => a.vetId === req.user!.id);
  }

  list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return res.json({
    success: true,
    data: list,
    total: list.length,
    timestamp: new Date().toISOString(),
  });
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  // Authorization check
  const pet = store.pets.get(row.petId);
  if (req.user!.role === UserRole.OWNER && pet?.ownerId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this appointment');
  }
  if (req.user!.role === UserRole.VET && row.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this appointment');
  }

  return res.json(toResponse(row));
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const body = req.body as Partial<StoredAppointment>;
  if (!body.petId?.trim() || !body.vetId?.trim() || !body.date?.trim() || !body.time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, date, and time are required');
  }

  const pet = store.pets.get(body.petId.trim());
  if (!pet) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }

  // Authorization: Only owner (for their pet) or vet or admin can create appointments
  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only create appointments for your own pets');
  }

  const t = new Date().toISOString();
  const id = store.newId();
  const row: StoredAppointment = {
    id,
    petId: body.petId.trim(),
    vetId: body.vetId.trim(),
    date: body.date.trim(),
    time: body.time.trim(),
    durationMinutes: body.durationMinutes ?? 30,
    type: (body.type as AppointmentType) ?? AppointmentType.ROUTINE_CHECKUP,
    status: (body.status as AppointmentStatus) ?? AppointmentStatus.PENDING,
    notes: body.notes?.trim(),
    createdAt: t,
    updatedAt: t,
  };
  store.appointments.set(id, row);
  void logAuditTrail({
    req,
    entityType: 'appointment',
    entityId: id,
    action: 'CREATE',
    before: null,
    after: row,
  });
  return res.status(201).json(toResponse(row));
});

router.put('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(row.petId);
  // Authorization: Only owner (for their pet), vet (if assigned), or admin can update
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAssignedVet = req.user!.role === UserRole.VET && row.vetId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAssignedVet && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to update this appointment',
    );
  }

  const b = req.body as Partial<StoredAppointment>;
  const t = new Date().toISOString();
  const next: StoredAppointment = {
    ...row,
    ...(b.date !== undefined ? { date: String(b.date) } : {}),
    ...(b.time !== undefined ? { time: String(b.time) } : {}),
    ...(b.durationMinutes !== undefined ? { durationMinutes: b.durationMinutes } : {}),
    ...(b.type !== undefined ? { type: b.type as AppointmentType } : {}),
    ...(b.status !== undefined ? { status: b.status as AppointmentStatus } : {}),
    ...(b.notes !== undefined ? { notes: b.notes } : {}),
    ...(b.vetId !== undefined && (isAdmin || isAssignedVet) ? { vetId: String(b.vetId) } : {}),
    ...(b.petId !== undefined && (isAdmin || isOwner) ? { petId: String(b.petId) } : {}),
    updatedAt: t,
    ...(b.status === AppointmentStatus.CANCELLED
      ? { cancelledAt: t, cancellationReason: b.cancellationReason ?? row.cancellationReason }
      : {}),
  };
  store.appointments.set(row.id, next);
  void logAuditTrail({
    req,
    entityType: 'appointment',
    entityId: row.id,
    action: 'UPDATE',
    before: row,
    after: next,
  });
  return res.json(toResponse(next));
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(row.petId);
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to delete this appointment',
    );
  }

  store.appointments.delete(req.params.id);
  void logAuditTrail({
    req,
    entityType: 'appointment',
    entityId: row.id,
    action: 'DELETE',
    before: row,
    after: null,
  });
  return res.json(ok(null, 'Appointment deleted'));
});

export default router;
