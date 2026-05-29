/* eslint-disable no-console */
import { randomUUID } from 'crypto';

import { AppointmentStatus, AppointmentType } from '../models/Appointment';
import { MedicationFrequency, MedicationStatus } from '../models/Medication';
import { UserRole } from '../models/UserRole';
import { query } from '../src/db';

interface SeedConfig {
  numOwners?: number;
  numVets?: number;
  petsPerOwner?: number;
  recordsPerPet?: number;
  appointmentsPerPet?: number;
  medicationsPerPet?: number;
}

const DEFAULT_CONFIG: Required<SeedConfig> = {
  numOwners: 5,
  numVets: 3,
  petsPerOwner: 2,
  recordsPerPet: 3,
  appointmentsPerPet: 2,
  medicationsPerPet: 1,
};

// Sample data generators
const FIRST_NAMES = ['John', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'James', 'Anna'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const PET_NAMES = [
  'Buddy',
  'Max',
  'Luna',
  'Charlie',
  'Bella',
  'Rocky',
  'Daisy',
  'Cooper',
  'Lucy',
  'Milo',
];
const SPECIES = ['dog', 'cat', 'rabbit', 'bird'];
const BREEDS: Record<string, string[]> = {
  dog: ['Labrador', 'Golden Retriever', 'German Shepherd', 'Bulldog', 'Poodle', 'Beagle'],
  cat: ['Persian', 'Siamese', 'Maine Coon', 'Bengal', 'Ragdoll'],
  rabbit: ['Holland Lop', 'Flemish Giant', 'Angora'],
  bird: ['Parrot', 'Canary', 'Cockatiel'],
};

const MEDICAL_TYPES = ['checkup', 'vaccination', 'surgery', 'treatment', 'other'];
const DIAGNOSES = [
  'Annual wellness exam',
  'Ear infection',
  'Dental cleaning',
  'Skin allergy',
  'Routine vaccination',
  'Post-surgery follow-up',
];
const TREATMENTS = [
  'Prescribed antibiotics',
  'Recommended diet change',
  'Scheduled surgery',
  'Applied topical treatment',
  'Administered vaccine',
  'Prescribed pain medication',
];

const APPOINTMENT_TYPES = [
  AppointmentType.ROUTINE_CHECKUP,
  AppointmentType.VACCINATION,
  AppointmentType.DENTAL,
  AppointmentType.FOLLOW_UP,
];

const MEDICATION_NAMES = [
  'Amoxicillin',
  'Prednisone',
  'Gabapentin',
  'Apoquel',
  'Cerenia',
  'Metacam',
];

const MEDICATION_FREQUENCIES = [
  MedicationFrequency.ONCE_DAILY,
  MedicationFrequency.TWICE_DAILY,
  MedicationFrequency.EVERY_OTHER_DAY,
  MedicationFrequency.AS_NEEDED,
];

// Utility functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmail(firstName: string, lastName: string, domain: string = 'example.com'): string {
  const suffix = randomInt(100, 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${domain}`;
}

function randomPhone(): string {
  return `+1${randomInt(2000000000, 9999999999)}`;
}

function randomDate(daysAgo: number = 365): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date.toISOString().split('T')[0];
}

function futureDate(daysFromNow: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + randomInt(1, daysFromNow));
  return date.toISOString().split('T')[0];
}

function randomTime(): string {
  const hour = randomInt(8, 17);
  const minute = randomInt(0, 5) * 15;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Seed functions
async function seedUsers(config: Required<SeedConfig>): Promise<Map<string, string>> {
  console.log(`\n📝 Seeding ${config.numOwners} owners and ${config.numVets} vets...`);

  const userIds = new Map<string, string>();
  const ownerIds: string[] = [];
  const vetIds: string[] = [];

  // Create owners
  for (let i = 0; i < config.numOwners; i++) {
    const id = randomUUID();
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const email = randomEmail(firstName, lastName);

    await query(
      `INSERT INTO users (id, email, name, phone, role, is_email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id, email, `${firstName} ${lastName}`, randomPhone(), UserRole.OWNER, true],
    );

    ownerIds.push(id);
    userIds.set(`owner-${i}`, id);
    console.log(`  ✓ Owner: ${email}`);
  }

  // Create vets
  for (let i = 0; i < config.numVets; i++) {
    const id = randomUUID();
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const email = randomEmail(firstName, lastName, 'vetclinic.com');

    await query(
      `INSERT INTO users (id, email, name, phone, role, is_email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id, email, `Dr. ${firstName} ${lastName}`, randomPhone(), UserRole.VET, true],
    );

    vetIds.push(id);
    userIds.set(`vet-${i}`, id);
    console.log(`  ✓ Vet: ${email}`);
  }

  return userIds;
}

async function seedPets(
  config: Required<SeedConfig>,
  userIds: Map<string, string>,
): Promise<Map<string, string>> {
  console.log(`\n🐾 Seeding pets...`);

  const petIds = new Map<string, string>();
  let petCount = 0;

  for (let ownerIdx = 0; ownerIdx < config.numOwners; ownerIdx++) {
    const ownerId = userIds.get(`owner-${ownerIdx}`);
    if (!ownerId) continue;

    for (let petIdx = 0; petIdx < config.petsPerOwner; petIdx++) {
      const id = randomUUID();
      const name = randomElement(PET_NAMES);
      const species = randomElement(SPECIES);
      const breed = randomElement(BREEDS[species]);
      const dateOfBirth = randomDate(365 * 10);
      const microchipId = `CHIP-${randomInt(100000, 999999)}`;

      await query(
        `INSERT INTO pets (id, name, species, breed, date_of_birth, microchip_id, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [id, name, species, breed, dateOfBirth, microchipId, ownerId],
      );

      petIds.set(`pet-${petCount}`, id);
      console.log(`  ✓ Pet: ${name} (${species}, ${breed}) - Owner: ${ownerId.slice(0, 8)}`);
      petCount++;
    }
  }

  return petIds;
}

async function seedMedicalRecords(
  config: Required<SeedConfig>,
  userIds: Map<string, string>,
  petIds: Map<string, string>,
): Promise<void> {
  console.log(`\n📋 Seeding medical records...`);

  let recordCount = 0;
  const vetIds = Array.from(userIds.entries())
    .filter(([key]) => key.startsWith('vet-'))
    .map(([, id]) => id);

  for (let petIdx = 0; petIdx < petIds.size; petIdx++) {
    const petId = petIds.get(`pet-${petIdx}`);
    if (!petId) continue;

    for (let recordIdx = 0; recordIdx < config.recordsPerPet; recordIdx++) {
      const id = randomUUID();
      const vetId = randomElement(vetIds);
      const type = randomElement(MEDICAL_TYPES);
      const diagnosis = randomElement(DIAGNOSES);
      const treatment = randomElement(TREATMENTS);
      const visitDate = randomDate(180);
      const nextVisitDate = new Date(new Date(visitDate).getTime() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      await query(
        `INSERT INTO medical_records (id, pet_id, vet_id, type, diagnosis, treatment, visit_date, next_visit_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, petId, vetId, type, diagnosis, treatment, visitDate, nextVisitDate],
      );

      recordCount++;
      console.log(`  ✓ Record: ${type} - ${diagnosis}`);
    }
  }

  console.log(`  Total records created: ${recordCount}`);
}

async function seedAppointments(
  config: Required<SeedConfig>,
  userIds: Map<string, string>,
  petIds: Map<string, string>,
): Promise<void> {
  console.log(`\n📅 Seeding appointments...`);

  let appointmentCount = 0;
  const vetIds = Array.from(userIds.entries())
    .filter(([key]) => key.startsWith('vet-'))
    .map(([, id]) => id);

  for (let petIdx = 0; petIdx < petIds.size; petIdx++) {
    const petId = petIds.get(`pet-${petIdx}`);
    if (!petId) continue;

    for (let apptIdx = 0; apptIdx < config.appointmentsPerPet; apptIdx++) {
      const id = randomUUID();
      const vetId = randomElement(vetIds);
      const date = futureDate(60);
      const time = randomTime();
      const type = randomElement(APPOINTMENT_TYPES);
      const status = randomElement([
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.COMPLETED,
      ]);

      await query(
        `INSERT INTO appointments (id, pet_id, vet_id, date, time, duration_minutes, type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, petId, vetId, date, time, 30, type, status],
      );

      appointmentCount++;
      console.log(`  ✓ Appointment: ${type} on ${date} at ${time}`);
    }
  }

  console.log(`  Total appointments created: ${appointmentCount}`);
}

async function seedMedications(
  config: Required<SeedConfig>,
  petIds: Map<string, string>,
): Promise<void> {
  console.log(`\n💊 Seeding medications...`);

  let medicationCount = 0;

  for (let petIdx = 0; petIdx < petIds.size; petIdx++) {
    const petId = petIds.get(`pet-${petIdx}`);
    if (!petId) continue;

    for (let medIdx = 0; medIdx < config.medicationsPerPet; medIdx++) {
      const id = randomUUID();
      const name = randomElement(MEDICATION_NAMES);
      const dosage = `${randomInt(5, 500)}mg`;
      const frequency = randomElement(MEDICATION_FREQUENCIES);
      const startDate = randomDate(90);
      const durationDays = randomInt(7, 90);
      const endDate = new Date(new Date(startDate).getTime() + durationDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const status = randomElement([MedicationStatus.ACTIVE, MedicationStatus.COMPLETED]);

      await query(
        `INSERT INTO medications (id, pet_id, name, dosage, frequency, start_date, end_date, status, duration_days, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [id, petId, name, dosage, frequency, startDate, endDate, status, durationDays],
      );

      medicationCount++;
      console.log(`  ✓ Medication: ${name} (${dosage}, ${frequency})`);
    }
  }

  console.log(`  Total medications created: ${medicationCount}`);
}

async function _clearExistingData(): Promise<void> {
  console.log('\n🗑️  Clearing existing seed data...');

  const tables = ['medications', 'appointments', 'medical_records', 'pets', 'users'];

  for (const table of tables) {
    await query(`DELETE FROM ${table} WHERE created_at > NOW() - INTERVAL '1 day'`);
    console.log(`  ✓ Cleared ${table}`);
  }
}

export async function seed(config: Partial<SeedConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('\n🌱 Starting PetChain database seeding...');
  console.log(`Configuration:`, finalConfig);

  try {
    // Optional: Clear previous seed data (comment out to preserve)
    // await clearExistingData();

    const userIds = await seedUsers(finalConfig);
    const petIds = await seedPets(finalConfig, userIds);
    await seedMedicalRecords(finalConfig, userIds, petIds);
    await seedAppointments(finalConfig, userIds, petIds);
    await seedMedications(finalConfig, petIds);

    console.log('\n✅ Seeding completed successfully!');
    console.log(`\nSummary:`);
    console.log(`  • Users: ${finalConfig.numOwners} owners + ${finalConfig.numVets} vets`);
    console.log(`  • Pets: ${finalConfig.numOwners * finalConfig.petsPerOwner}`);
    console.log(
      `  • Medical Records: ${finalConfig.numOwners * finalConfig.petsPerOwner * finalConfig.recordsPerPet}`,
    );
    console.log(
      `  • Appointments: ${finalConfig.numOwners * finalConfig.petsPerOwner * finalConfig.appointmentsPerPet}`,
    );
    console.log(
      `  • Medications: ${finalConfig.numOwners * finalConfig.petsPerOwner * finalConfig.medicationsPerPet}`,
    );
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}
