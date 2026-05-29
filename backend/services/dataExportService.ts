import { store } from '../server/store';

export interface UserDataExport {
  user: unknown;
  pets: unknown[];
  medicalRecords: unknown[];
  appointments: unknown[];
  medications: unknown[];
  exportedAt: string;
}

export function exportUserData(userId: string): UserDataExport {
  const user = store.users.get(userId);
  const pets = [...store.pets.values()].filter((p) => p.ownerId === userId);
  const petIds = new Set(pets.map((p) => p.id));

  const medicalRecords = [...store.medicalRecords.values()].filter((r) =>
    petIds.has(r.petId),
  );
  const appointments = [...store.appointments.values()].filter((a) =>
    petIds.has(a.petId),
  );
  const medications = [...store.medications.values()].filter((m) =>
    petIds.has(m.petId),
  );

  // Strip sensitive fields from user
  const { passwordHash: _pw, ...safeUser } = (user ?? {}) as Record<string, unknown>;

  return {
    user: safeUser,
    pets,
    medicalRecords,
    appointments,
    medications,
    exportedAt: new Date().toISOString(),
  };
}

export function eraseUserData(userId: string): void {
  // Hard-delete all PII
  store.users.delete(userId);

  const petIds: string[] = [];
  store.pets.forEach((p, id) => {
    if (p.ownerId === userId) petIds.push(id);
  });
  petIds.forEach((id) => store.pets.delete(id));

  store.medicalRecords.forEach((r, id) => {
    if (petIds.includes(r.petId)) store.medicalRecords.delete(id);
  });
  store.appointments.forEach((a, id) => {
    if (petIds.includes(a.petId)) store.appointments.delete(id);
  });
  store.medications.forEach((m, id) => {
    if (petIds.includes(m.petId)) store.medications.delete(id);
  });
}

// In-memory consent log (replace with DB in production)
interface ConsentEntry {
  userId: string;
  category: string;
  granted: boolean;
  createdAt: string;
}
const consentLog: ConsentEntry[] = [];

export function logConsent(userId: string, category: string, granted: boolean): void {
  consentLog.push({ userId, category, granted, createdAt: new Date().toISOString() });
}

export function getConsentHistory(userId: string): ConsentEntry[] {
  return consentLog.filter((e) => e.userId === userId);
}
