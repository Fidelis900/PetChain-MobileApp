/**
 * Pet data model interfaces and types
 */

/**
 * Medical history record for a pet
 */
export interface MedicalHistoryRecord {
  id: string;
  date: string;
  condition: string;
  treatment: string;
  veterinarian?: string;
  notes?: string;
}

/**
 * Vaccination record for a pet
 */
export interface VaccinationRecord {
  id: string;
  name: string;
  date: string;
  nextDueDate?: string;
  veterinarian?: string;
  batchNumber?: string;
}

/**
 * Medication record for a pet
 */
export interface MedicationRecord {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
  notes?: string;
}

/**
 * Pet species type
 */
export type Species = 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';

/**
 * Main Pet interface
 */
export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  dateOfBirth?: string;
  weightKg?: number;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pet with additional details for full profile
 */
export interface PetWithDetails extends Pet {
  age?: number;
  weight?: number;
  weightKg?: number;
  gender?: 'male' | 'female';
  color?: string;
  medicalHistory: MedicalHistoryRecord[];
  vaccinations: VaccinationRecord[];
  medications: MedicationRecord[];
  qrCode?: string;
}
