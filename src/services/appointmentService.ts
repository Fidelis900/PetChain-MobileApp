import { type AxiosResponse } from 'axios';

import apiClient from './apiClient';
import { AppointmentStatus } from '../models/Appointment';
import type { Appointment } from '../models/Appointment';

const BASE_URL = '/appointments';

export async function getUpcomingAppointments(petId: string): Promise<Appointment[]> {
  try {
    const response: AxiosResponse<{ data: Appointment[] }> = await apiClient.get(
      `${BASE_URL}?petId=${petId}`,
    );

    // Sort by date ascending and filter out past dates
    const now = new Date();
    const upcoming = response.data.data
      .filter((a) => new Date(`${a.date}T${a.time}`) >= now)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      );

    return upcoming;
  } catch (error) {
    console.error('Failed to fetch appointments:', error);
    return [];
  }
}

export type { Appointment } from '../models/Appointment';
export { AppointmentStatus } from '../models/Appointment';

export async function getAppointments(petId?: string): Promise<Appointment[]> {
  if (petId) return getUpcomingAppointments(petId);
  // Return all from local storage if no petId
  return [];
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

export async function saveAppointment(
  appointment: Omit<Appointment, 'id'> & { id?: string },
): Promise<Appointment> {
  if (appointment.id) {
    const response = await apiClient.put<{ data: Appointment }>(
      `${BASE_URL}/${appointment.id}`,
      appointment,
    );
    return response.data.data;
  }
  const response = await apiClient.post<{ data: Appointment }>(BASE_URL, appointment);
  return response.data.data;
}

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
