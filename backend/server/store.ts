import { randomUUID } from 'crypto';

import { AppointmentStatus, AppointmentType } from '../models/Appointment';
import { UserRole } from '../models/UserRole';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  pets: Array<{ id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  passwordHash?: string;
}

export interface StoredPet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMedicalRecord {
  id: string;
  petId: string;
  vetId: string;
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;

  // Blockchain verification fields
  blockchainTxHash?: string; // Stellar transaction hash
  blockchainHash?: string; // Hash stored on-chain
  isBlockchainVerified?: boolean; // Verified flag (backend-computed)
  blockchainVerifiedAt?: string; // When verification was last performed
}

export interface StoredAppointment {
  id: string;
  petId: string;
  vetId: string;
  date: string;
  time: string;
  durationMinutes?: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface StoredBackup {
  userId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface StoredPetQrIdentity {
  petId: string;
  token: string;
  issuedAt: string;
  revokedAt?: string;
}

export interface StoredEmergencySession {
  id: string;
  userId?: string;
  message: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  shareToken: string;
  createdAt: string;
  expiresAt: string;
  cancelledAt?: string;
  contacts: Array<{ name: string; phoneNumber: string; pushToken?: string }>;
  updates: Array<{ latitude: number; longitude: number; accuracy?: number; recordedAt: string }>;
}

/** Matches `backend/services/medicationService` client expectations. */
export interface StoredMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
}

const now = () => new Date().toISOString();

function seed() {
  const userId = 'u-demo-1';
  const petId = 'p-demo-1';
  const vetId = 'v-demo-1';
  const t = now();

  const users = new Map<string, StoredUser>();
  users.set(userId, {
    id: userId,
    email: 'demo@petchain.app',
    name: 'Demo User',
    phone: '+10000000000',
    role: UserRole.OWNER,
    pets: [{ id: petId, name: 'Buddy' }],
    createdAt: t,
    updatedAt: t,
    isEmailVerified: true,
    lastLoginAt: t,
  });

  const pets = new Map<string, StoredPet>();
  pets.set(petId, {
    id: petId,
    name: 'Buddy',
    species: 'dog',
    breed: 'Mixed',
    dateOfBirth: '2020-01-15',
    microchipId: 'CHIP-DEMO-1',
    ownerId: userId,
    createdAt: t,
    updatedAt: t,
  });

  const medicalRecords = new Map<string, StoredMedicalRecord>();
  const mrId = 'mr-demo-1';
  medicalRecords.set(mrId, {
    id: mrId,
    petId,
    vetId,
    type: 'vaccination',
    diagnosis: 'Annual wellness',
    treatment: 'Rabies vaccine',
    notes: 'No adverse reaction',
    visitDate: t.slice(0, 10),
    nextVisitDate: '2027-01-01',
    createdAt: t,
    updatedAt: t,
    // Blockchain fields not set for demo record initially
    blockchainTxHash: undefined,
    blockchainHash: undefined,
    isBlockchainVerified: false,
    blockchainVerifiedAt: undefined,
  });

  const appointments = new Map<string, StoredAppointment>();
  const apId = 'ap-demo-1';
  appointments.set(apId, {
    id: apId,
    petId,
    vetId,
    date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    time: '10:00',
    durationMinutes: 30,
    type: AppointmentType.ROUTINE_CHECKUP,
    status: AppointmentStatus.CONFIRMED,
    notes: 'Demo appointment',
    createdAt: t,
    updatedAt: t,
  });

  const medications = new Map<string, StoredMedication>();
  const medId = 'med-demo-1';
  medications.set(medId, {
    id: medId,
    petId,
    name: 'Demo Med',
    dosage: '5mg',
    frequency: 'once_daily',
    startDate: t.slice(0, 10),
    active: true,
  });

  return { users, pets, medicalRecords, appointments, medications };
}

const state = seed();

const backups = new Map<string, StoredBackup>();
const petQrIdentities = new Map<string, StoredPetQrIdentity>();
const emergencySessions = new Map<string, StoredEmergencySession>();

// ─── Travel Certificates ──────────────────────────────────────────────────────

export interface StoredTravelCertificate {
  id: string;
  petId: string;
  petName: string;
  destinationCountryCode: string;
  destinationCountryName: string;
  travelDate: string;
  generatedAt: string;
  status: 'draft' | 'ready' | 'incomplete' | 'anchored' | 'anchor_failed';
  requirementChecks: Array<{
    requirementType: 'vaccination' | 'health_check' | 'document';
    requirementName: string;
    met: boolean;
    details?: string;
    satisfiedAt?: string;
    actionRequired?: string;
  }>;
  complianceScore: number;
  pdfUrl?: string;
  blockchainTxHash?: string;
  blockchainHash?: string;
  isBlockchainAnchored: boolean;
  blockchainAnchoredAt?: string;
  createdAt: string;
  updatedAt: string;
}

const travelCertificates = new Map<string, StoredTravelCertificate>();

export function newId(): string {
  return randomUUID();
}

export const store = {
  ...state,
  backups,
  petQrIdentities,
  emergencySessions,
  travelCertificates,
  newId,
};
