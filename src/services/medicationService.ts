import * as Notifications from 'expo-notifications';

import {
  getAllMedications,
  upsertMedication,
  deleteMedicationById,
  getDoseLogs as dbGetDoseLogs,
  addDoseLog as dbAddDoseLog,
} from './localDB';
import type { Medication } from '../models/Medication';

export type { Medication };

export interface DoseLog {
  id: string;
  medicationId: string;
  takenAt: string; // ISO string
  skipped?: boolean;
  scheduledFor?: string;
  notes?: string;
}

export interface MedicationAdherence {
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  score: number;
}

export async function getMedications(): Promise<Medication[]> {
  return getAllMedications<Medication>();
}

export async function saveMedication(med: Medication): Promise<void> {
  await upsertMedication(med);
}

export async function deleteMedication(id: string): Promise<void> {
  await deleteMedicationById(id);
}

export async function getDoseLogs(): Promise<DoseLog[]> {
  return dbGetDoseLogs<DoseLog>();
}

export async function logDose(log: DoseLog): Promise<void> {
  await dbAddDoseLog(log);
}

export function getDoseStatus(
  medicationId: string,
  scheduledTime: Date,
  logs: DoseLog[],
): 'taken' | 'skipped' | 'missed' | 'pending' {
  const windowMs = 30 * 60 * 1000;
  const match = logs.find((log) => {
    if (log.medicationId !== medicationId) return false;
    if (log.scheduledFor)
      return Math.abs(new Date(log.scheduledFor).getTime() - scheduledTime.getTime()) <= windowMs;
    return Math.abs(new Date(log.takenAt).getTime() - scheduledTime.getTime()) <= windowMs;
  });
  if (match?.skipped) return 'skipped';
  if (match) return 'taken';
  return scheduledTime.getTime() + windowMs < Date.now() ? 'missed' : 'pending';
}

export function calculateAdherence(
  medications: Medication[],
  logs: DoseLog[],
  fromDate: Date,
  toDate: Date,
): MedicationAdherence {
  let scheduled = 0;
  let taken = 0;
  let skipped = 0;
  let missed = 0;
  medications.forEach((med) => {
    getScheduleForRange(med, fromDate, toDate).forEach((doseTime) => {
      scheduled += 1;
      const status = getDoseStatus(med.id, doseTime, logs);
      if (status === 'taken') taken += 1;
      if (status === 'skipped') skipped += 1;
      if (status === 'missed') missed += 1;
    });
  });
  const denominator = Math.max(1, scheduled - skipped);
  return { scheduled, taken, skipped, missed, score: Math.round((taken / denominator) * 100) };
}

export function getLowRefillMedications(medications: Medication[], threshold = 0.2): Medication[] {
  return medications.filter(
    (med) =>
      med.remainingPills !== undefined &&
      med.totalPills !== undefined &&
      med.totalPills > 0 &&
      med.remainingPills <= med.totalPills * threshold,
  );
}

export function getMedicationEndDate(med: Medication): Date | null {
  if (!med.endDate) return null;
  const end = new Date(med.endDate);
  return Number.isNaN(end.getTime()) ? null : end;
}

export function isMedicationActive(med: Medication, date = new Date()): boolean {
  const now = date;
  const start = new Date(med.startDate);
  if (Number.isNaN(start.getTime()) || now < start) return false;
  const end = getMedicationEndDate(med);
  if (end && now > end) return false;
  return med.status !== 'paused' && med.status !== 'discontinued';
}

export function getScheduleForRange(med: Medication, fromDate: Date, toDate: Date): Date[] {
  const times: Date[] = [];
  const start = new Date(med.startDate);
  if (Number.isNaN(start.getTime()) || fromDate > toDate) return times;

  const end = getMedicationEndDate(med);
  if (end && fromDate > end) return times;

  const intervalMs = med.frequency * 60 * 60 * 1000;
  if (intervalMs <= 0) return times;

  if (toDate < start) return times;

  let cursor = new Date(start);
  if (cursor < fromDate) {
    const diff = fromDate.getTime() - cursor.getTime();
    const steps = Math.ceil(diff / intervalMs);
    cursor = new Date(cursor.getTime() + steps * intervalMs);
  }

  const lastDate = end && end < toDate ? end : toDate;
  while (cursor <= lastDate) {
    if (cursor >= fromDate) {
      times.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + intervalMs);
  }

  return times;
}

export function getDaySchedule(med: Medication, date: Date): Date[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return getScheduleForRange(med, dayStart, dayEnd);
}

export function getUpcomingDoseTimes(med: Medication, days = 7, fromDate = new Date()): Date[] {
  const windowEnd = new Date(fromDate);
  windowEnd.setDate(windowEnd.getDate() + days);
  return getScheduleForRange(med, fromDate, windowEnd);
}

export async function scheduleRefillReminder(med: Medication): Promise<void> {
  if (!med.refillDate) return;
  const trigger = new Date(med.refillDate);
  trigger.setHours(9, 0, 0, 0); // 9 AM on refill day
  if (trigger <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Refill Reminder',
      body: `Time to refill ${med.name}`,
      data: { medicationId: med.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}
