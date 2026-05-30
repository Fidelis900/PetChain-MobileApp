import { type AxiosResponse } from 'axios';

import apiClient from './apiClient';
import {
  getAllLocalAppointments,
  getAllAppointmentsByPetId,
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
} from './localDB';
import { AppointmentStatus } from '../models/Appointment';
import type { Appointment } from '../models/Appointment';
import type { Medication } from '../models/Medication';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { Appointment } from '../models/Appointment';
export { AppointmentStatus } from '../models/Appointment';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = '/appointments';

/** Buffer window (ms) around each appointment that counts as a conflict */
export const CONFLICT_BUFFER_MS = 60 * 60 * 1000; // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

/** A detected conflict between a proposed appointment and an existing one */
export interface AppointmentConflict {
  type: 'appointment' | 'medication';
  /** Human-readable description */
  description: string;
  /** The conflicting appointment (if type === 'appointment') */
  conflictingAppointment?: Appointment;
  /** The conflicting medication name (if type === 'medication') */
  medicationName?: string;
  /** The scheduled medication time (if type === 'medication') */
  medicationTime?: Date;
}

/** Result returned by `detectConflicts` */
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: AppointmentConflict[];
  /** Next available conflict-free slot (1-hour increments from proposed time) */
  suggestedTime?: Date;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

/**
 * Detect scheduling conflicts for a proposed appointment time.
 *
 * Checks:
 * 1. Existing (non-cancelled) appointments for the same pet within ±1 hour.
 * 2. Vet-supervised medication doses for the same pet within ±1 hour.
 *
 * @param petId           The pet's ID
 * @param proposedTime    The proposed appointment datetime
 * @param medications     Active medications for the pet (pass [] to skip med check)
 * @param excludeId       Appointment ID to exclude (used when rescheduling)
 */
export async function detectConflicts(
  petId: string,
  proposedTime: Date,
  medications: Medication[] = [],
  excludeId?: string,
): Promise<ConflictDetectionResult> {
  const conflicts: AppointmentConflict[] = [];

  const windowStart = new Date(proposedTime.getTime() - CONFLICT_BUFFER_MS).toISOString();
  const windowEnd = new Date(proposedTime.getTime() + CONFLICT_BUFFER_MS).toISOString();

  // ── 1. Check existing appointments ────────────────────────────────────────
  const nearby = await getAppointmentsInWindow<Appointment>(petId, windowStart, windowEnd);
  for (const appt of nearby) {
    if (excludeId && appt.id === excludeId) continue;
    const apptTime = new Date(appt.date);
    const diffMs = Math.abs(apptTime.getTime() - proposedTime.getTime());
    if (diffMs <= CONFLICT_BUFFER_MS) {
      conflicts.push({
        type: 'appointment',
        description: `"${appt.title ?? 'Appointment'}" is scheduled ${_formatTimeDiff(diffMs)} from the proposed time.`,
        conflictingAppointment: appt,
      });
    }
  }

  // ── 2. Check vet-supervised medication times ───────────────────────────────
  const { getScheduleForRange } = await import('./medicationService');
  const windowStartDate = new Date(proposedTime.getTime() - CONFLICT_BUFFER_MS);
  const windowEndDate = new Date(proposedTime.getTime() + CONFLICT_BUFFER_MS);

  for (const med of medications) {
    if (!isVetSupervised(med)) continue;
    const doseTimes = getScheduleForRange(med, windowStartDate, windowEndDate);
    for (const doseTime of doseTimes) {
      const diffMs = Math.abs(doseTime.getTime() - proposedTime.getTime());
      if (diffMs <= CONFLICT_BUFFER_MS) {
        conflicts.push({
          type: 'medication',
          description: `"${med.name}" requires vet supervision at ${_formatTime(doseTime)} (within ${_formatTimeDiff(diffMs)} of the proposed time).`,
          medicationName: med.name,
          medicationTime: doseTime,
        });
      }
    }
  }

  const hasConflicts = conflicts.length > 0;
  const suggestedTime = hasConflicts
    ? await findNextAvailableSlot(petId, proposedTime, medications)
    : undefined;

  return { hasConflicts, conflicts, suggestedTime };
}

/**
 * Returns true if a medication is flagged as requiring vet supervision.
 * Heuristic: any medication whose instructions mention "vet", "supervised",
 * or "injection" is treated as vet-supervised.
 */
export function isVetSupervised(med: Medication): boolean {
  const haystack = [med.instructions ?? '', med.notes ?? ''].join(' ').toLowerCase();
  return (
    haystack.includes('vet') ||
    haystack.includes('supervis') ||
    haystack.includes('injection') ||
    haystack.includes('infusion') ||
    haystack.includes('administered by')
  );
}

/**
 * Finds the next 1-hour-increment slot (up to 14 days out) that has no conflicts.
 */
export async function findNextAvailableSlot(
  petId: string,
  from: Date,
  medications: Medication[] = [],
): Promise<Date | undefined> {
  const SLOT_INCREMENT_MS = 60 * 60 * 1000; // 1 hour
  const MAX_ITERATIONS = 14 * 24; // 14 days

  let candidate = new Date(from.getTime() + SLOT_INCREMENT_MS);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await detectConflicts(petId, candidate, medications);
    if (!result.hasConflicts) return candidate;
    candidate = new Date(candidate.getTime() + SLOT_INCREMENT_MS);
  }

  return undefined;
}

// ─── Local CRUD ───────────────────────────────────────────────────────────────

/**
 * Fetch all locally-stored appointments (no petId filter).
 * Also attempts a remote fetch; local data is the source of truth when offline.
 */
export async function getAppointments(petId?: string): Promise<Appointment[]> {
  if (petId) return getUpcomingAppointments(petId);

  // Try remote first, fall back to local SQLite
  try {
    const response: AxiosResponse<{ data: Appointment[] }> = await apiClient.get(BASE_URL);
    const remoteAppts = response.data.data;
    // Persist to local DB for offline use
    await Promise.all(remoteAppts.map((a) => upsertAppointment(a)));
    return remoteAppts;
  } catch {
    return getAllLocalAppointments<Appointment>();
  }
}

export async function getUpcomingAppointments(petId: string): Promise<Appointment[]> {
  try {
    const response: AxiosResponse<{ data: Appointment[] }> = await apiClient.get(
      `${BASE_URL}?petId=${petId}`,
    );
    const now = new Date();
    const upcoming = response.data.data
      .filter((a) => new Date(`${a.date}T${a.time}`) >= now)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      );
    // Persist locally
    await Promise.all(upcoming.map((a) => upsertAppointment(a)));
    return upcoming;
  } catch {
    // Offline fallback
    const local = await getAllAppointmentsByPetId<Appointment>(petId);
    const now = new Date();
    return local
      .filter((a) => new Date(a.date) >= now && a.status !== AppointmentStatus.CANCELLED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

/** Sync filter: returns upcoming appointments from a list */
export function getUpcoming(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => {
      const d = new Date(a.date);
      return (
        d >= now && a.status !== AppointmentStatus.CANCELLED && (a.status as string) !== 'cancelled'
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Sync filter: returns past appointments from a list */
export function getPast(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => {
      const d = new Date(a.date);
      return (
        d < now || a.status === AppointmentStatus.CANCELLED || (a.status as string) === 'cancelled'
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Persist an appointment — tries remote API first, always writes to local SQLite.
 * If `conflictResolutionNote` is provided it is appended to `appointment.notes`.
 */
export async function saveAppointment(
  appointment: Omit<Appointment, 'id'> & { id?: string },
  conflictResolutionNote?: string,
): Promise<Appointment> {
  const appt = { ...appointment } as Appointment;
  if (conflictResolutionNote) {
    appt.notes = appt.notes
      ? `${appt.notes}\n\n[Conflict resolution]: ${conflictResolutionNote}`
      : `[Conflict resolution]: ${conflictResolutionNote}`;
  }

  // Always write to local SQLite
  if (appt.id) {
    await upsertAppointment(appt);
  }

  // Attempt remote sync
  try {
    if (appt.id) {
      const response = await apiClient.put<{ data: Appointment }>(`${BASE_URL}/${appt.id}`, appt);
      const saved = response.data.data;
      await upsertAppointment(saved);
      return saved;
    }
    const response = await apiClient.post<{ data: Appointment }>(BASE_URL, appt);
    const saved = response.data.data;
    await upsertAppointment(saved);
    return saved;
  } catch {
    // Return the locally-saved version when offline
    return appt;
  }
}

/** Delete an appointment from both local DB and remote. */
export async function deleteAppointment(id: string): Promise<void> {
  await deleteAppointmentById(id);
  try {
    await apiClient.delete(`${BASE_URL}/${id}`);
  } catch {
    // Offline: deletion already happened locally
  }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function scheduleAppointmentReminder(appointment: Appointment): Promise<string> {
  const { scheduleAppointmentNotification } = await import('./notificationService');
  return scheduleAppointmentNotification({
    id: appointment.id,
    title: appointment.title ?? appointment.notes ?? 'Vet Appointment',
    date: appointment.date,
    location: appointment.location,
  });
}

export async function cancelAppointmentReminder(appointmentId: string): Promise<void> {
  const { cancelEntityNotification } = await import('./notificationService');
  return cancelEntityNotification(appointmentId);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _formatTimeDiff(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(ms / 3_600_000);
  return `${hrs} hr`;
}

function _formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
