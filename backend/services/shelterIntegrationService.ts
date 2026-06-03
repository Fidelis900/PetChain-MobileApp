import { randomUUID } from 'crypto';

import stellarAnchorService from './stellarService';
import { store, type StoredMedicalRecord, type StoredPet } from '../server/store';

export type ShelterProvider = 'petfinder' | 'adopt-a-pet';
export type ShelterSpecies = 'dog' | 'cat' | 'rabbit' | 'other';

export interface ShelterOAuthConnection {
  provider: ShelterProvider;
  authorizationUrl: string;
  state: string;
  connectedAt?: string;
  accessToken?: string;
}

export interface ShelterPetRecord {
  type: 'vaccination' | 'checkup' | 'treatment' | 'diagnosis';
  title: string;
  notes: string;
  visitDate: string;
  veterinarian: string;
  nextVisitDate?: string;
}

export interface ShelterVaccination {
  vaccineName: string;
  administeredAt: string;
  nextDueDate?: string;
  notes?: string;
}

export interface ShelterPet {
  id: string;
  provider: ShelterProvider;
  name: string;
  species: ShelterSpecies;
  breed?: string;
  ageMonths: number;
  location: string;
  shelterName: string;
  shelterContact?: string;
  description: string;
  photoUrl?: string;
  microchipId?: string;
  vaccinations: ShelterVaccination[];
  medicalHistory: ShelterPetRecord[];
  adoptionFee?: string;
  status: 'available' | 'pending' | 'adopted';
  updatedAt: string;
}

export interface BrowseShelterPetsFilters {
  provider?: ShelterProvider;
  species?: ShelterSpecies | 'all';
  breed?: string;
  location?: string;
  ageMinMonths?: number;
  ageMaxMonths?: number;
}

export interface AdoptShelterPetInput {
  provider: ShelterProvider;
  shelterPetId: string;
  adopterUserId: string;
}

export interface AdoptShelterPetResult {
  pet: StoredPet;
  shelterPet: ShelterPet;
  transferredRecords: Array<{
    id: string;
    type: string;
    blockchainTxHash?: string;
    blockchainHash?: string;
    status: 'anchored' | 'pending' | 'failed';
  }>;
}

export interface ShelterAuthResult {
  provider: ShelterProvider;
  authorizationUrl: string;
  state: string;
  mock: boolean;
}

const MOCK_MODE = (process.env.SHELTER_INTEGRATION_MODE ?? 'mock') !== 'live';

const SHELTER_OAUTH_CONFIG: Record<
  ShelterProvider,
  { clientId: string; authorizeUrl: string; scopes: string[] }
> = {
  petfinder: {
    clientId: process.env.PETFINDER_CLIENT_ID ?? 'mock-petfinder-client',
    authorizeUrl:
      process.env.PETFINDER_AUTHORIZE_URL ?? 'https://www.petfinder.com/oauth2/authorize',
    scopes: ['read:shelters', 'read:animals'],
  },
  'adopt-a-pet': {
    clientId: process.env.ADOPT_A_PET_CLIENT_ID ?? 'mock-adoptapet-client',
    authorizeUrl:
      process.env.ADOPT_A_PET_AUTHORIZE_URL ?? 'https://www.adoptapet.com/oauth/authorize',
    scopes: ['pets:read', 'shelters:read'],
  },
};

const MOCK_PETS: ShelterPet[] = [
  {
    id: 'pf-bella-001',
    provider: 'petfinder',
    name: 'Bella',
    species: 'dog',
    breed: 'Labrador Retriever',
    ageMonths: 18,
    location: 'Austin, TX',
    shelterName: 'Austin Animal Center',
    shelterContact: 'adoptions@austinanimals.org',
    description: 'Friendly young lab mix who loves walks, kids, and squeaky toys.',
    photoUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    microchipId: '982000411234567',
    adoptionFee: '$75',
    status: 'available',
    updatedAt: '2026-05-28T09:00:00.000Z',
    vaccinations: [
      {
        vaccineName: 'Rabies',
        administeredAt: '2026-04-10T00:00:00.000Z',
        nextDueDate: '2027-04-10T00:00:00.000Z',
        notes: 'Shelter-administered rabies vaccine.',
      },
      {
        vaccineName: 'DHPP',
        administeredAt: '2026-04-10T00:00:00.000Z',
        nextDueDate: '2027-04-10T00:00:00.000Z',
      },
    ],
    medicalHistory: [
      {
        type: 'checkup',
        title: 'Intake exam',
        notes: 'Healthy on intake; mild seasonal itching observed.',
        visitDate: '2026-04-10T00:00:00.000Z',
        veterinarian: 'Dr. Harper, Austin Animal Center',
      },
      {
        type: 'treatment',
        title: 'Dermatitis treatment',
        notes: 'Topical treatment completed with good response.',
        visitDate: '2026-05-01T00:00:00.000Z',
        veterinarian: 'Dr. Harper, Austin Animal Center',
      },
    ],
  },
  {
    id: 'apa-ginger-002',
    provider: 'adopt-a-pet',
    name: 'Ginger',
    species: 'cat',
    breed: 'Domestic Shorthair',
    ageMonths: 32,
    location: 'Dallas, TX',
    shelterName: 'Dallas Cat Rescue',
    shelterContact: 'hello@dallascatrescue.org',
    description: 'Calm adult cat with a big purr and excellent litter habits.',
    photoUrl:
      'https://images.unsplash.com/photo-1513245543132-31f507417b26?auto=format&fit=crop&w=800&q=80',
    microchipId: '981020300000123',
    adoptionFee: '$55',
    status: 'available',
    updatedAt: '2026-05-30T12:00:00.000Z',
    vaccinations: [
      {
        vaccineName: 'FVRCP',
        administeredAt: '2026-03-15T00:00:00.000Z',
        nextDueDate: '2027-03-15T00:00:00.000Z',
      },
      {
        vaccineName: 'Rabies',
        administeredAt: '2026-03-15T00:00:00.000Z',
        nextDueDate: '2027-03-15T00:00:00.000Z',
      },
    ],
    medicalHistory: [
      {
        type: 'checkup',
        title: 'Wellness exam',
        notes: 'Dental check clean; heart and lungs normal.',
        visitDate: '2026-03-15T00:00:00.000Z',
        veterinarian: 'Dr. Lee, Dallas Cat Rescue',
      },
    ],
  },
  {
    id: 'pf-hopper-003',
    provider: 'petfinder',
    name: 'Hopper',
    species: 'rabbit',
    breed: 'Mini Lop',
    ageMonths: 12,
    location: 'Houston, TX',
    shelterName: 'Houston Small Friends',
    description: 'Curious, gentle rabbit that enjoys greens and quiet cuddles.',
    photoUrl:
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80',
    adoptionFee: '$40',
    status: 'available',
    updatedAt: '2026-05-21T08:00:00.000Z',
    vaccinations: [
      {
        vaccineName: 'RHDV2',
        administeredAt: '2026-02-21T00:00:00.000Z',
      },
    ],
    medicalHistory: [
      {
        type: 'checkup',
        title: 'Spay/neuter check',
        notes: 'Cleared for adoption, normal appetite and activity.',
        visitDate: '2026-02-22T00:00:00.000Z',
        veterinarian: 'Dr. Nguyen, Houston Small Friends',
      },
    ],
  },
  {
    id: 'apa-mocha-004',
    provider: 'adopt-a-pet',
    name: 'Mocha',
    species: 'dog',
    breed: 'Pug Mix',
    ageMonths: 48,
    location: 'San Antonio, TX',
    shelterName: 'Alamo Rescue Partners',
    description: 'Quiet senior dog who prefers short walks and long naps.',
    photoUrl:
      'https://images.unsplash.com/photo-1551730459-92db2d0ce1f4?auto=format&fit=crop&w=800&q=80',
    microchipId: '982000419999111',
    adoptionFee: '$50',
    status: 'available',
    updatedAt: '2026-05-25T07:30:00.000Z',
    vaccinations: [
      {
        vaccineName: 'Rabies',
        administeredAt: '2026-01-10T00:00:00.000Z',
        nextDueDate: '2027-01-10T00:00:00.000Z',
      },
    ],
    medicalHistory: [
      {
        type: 'diagnosis',
        title: 'Arthritis monitoring',
        notes: 'Managed with lifestyle adjustments; no acute concerns.',
        visitDate: '2026-04-02T00:00:00.000Z',
        veterinarian: 'Dr. Patel, Alamo Rescue Partners',
      },
    ],
  },
];

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function monthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

function shelterPetMatchesFilters(pet: ShelterPet, filters: BrowseShelterPetsFilters): boolean {
  if (filters.provider && pet.provider !== filters.provider) return false;
  if (filters.species && filters.species !== 'all' && pet.species !== filters.species) return false;

  const breed = normalize(filters.breed);
  if (breed && !normalize(pet.breed).includes(breed)) return false;

  const location = normalize(filters.location);
  if (location && !normalize(pet.location).includes(location)) return false;

  if (typeof filters.ageMinMonths === 'number' && pet.ageMonths < filters.ageMinMonths) return false;
  if (typeof filters.ageMaxMonths === 'number' && pet.ageMonths > filters.ageMaxMonths) return false;

  return pet.status === 'available';
}

function buildMockAuthorizationUrl(provider: ShelterProvider, state: string, redirectUri: string) {
  const config = SHELTER_OAUTH_CONFIG[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

function toApiRecord(record: StoredMedicalRecord) {
  return {
    id: record.id,
    petId: record.petId,
    vetId: record.vetId,
    type: record.type,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    notes: record.notes,
    visitDate: record.visitDate,
    nextVisitDate: record.nextVisitDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    blockchainTxHash: record.blockchainTxHash,
    blockchainHash: record.blockchainHash,
    isBlockchainVerified: record.isBlockchainVerified,
    blockchainVerifiedAt: record.blockchainVerifiedAt,
  };
}

function clonePetFromShelter(shelterPet: ShelterPet, adopterUserId: string): StoredPet {
  const now = new Date().toISOString();
  return {
    id: store.newId(),
    name: shelterPet.name,
    species: shelterPet.species,
    breed: shelterPet.breed,
    dateOfBirth: monthsAgo(shelterPet.ageMonths),
    weightKg: undefined,
    microchipId: shelterPet.microchipId,
    photoUrl: shelterPet.photoUrl,
    thumbnailUrl: undefined,
    ownerId: adopterUserId,
    createdAt: now,
    updatedAt: now,
  };
}

function createTransferredRecord(
  shelterPet: ShelterPet,
  pet: StoredPet,
  entry: ShelterPetRecord | ShelterVaccination,
): StoredMedicalRecord {
  const now = new Date().toISOString();
  const id = store.newId();
  const isVaccination = 'vaccineName' in entry;

  const base: StoredMedicalRecord = {
    id,
    petId: pet.id,
    vetId: `shelter-${shelterPet.provider}`,
    type: isVaccination ? 'vaccination' : entry.type,
    diagnosis: isVaccination ? entry.vaccineName : undefined,
    treatment: isVaccination ? entry.vaccineName : entry.title,
    notes: entry.notes,
    visitDate: isVaccination ? entry.administeredAt : entry.visitDate,
    nextVisitDate: isVaccination ? entry.nextDueDate : entry.nextVisitDate,
    createdAt: now,
    updatedAt: now,
  };

  if (isVaccination) {
    base.notes = `${entry.vaccineName}${entry.notes ? `: ${entry.notes}` : ''}`;
    base.treatment = entry.vaccineName;
  }

  return base;
}

export class ShelterIntegrationService {
  async getOAuthAuthorizationUrl(
    provider: ShelterProvider,
    redirectUri = 'petchain://shelter/oauth/callback',
  ): Promise<ShelterAuthResult> {
    const state = randomUUID();
    const authorizationUrl = MOCK_MODE
      ? buildMockAuthorizationUrl(provider, state, redirectUri)
      : buildMockAuthorizationUrl(provider, state, redirectUri);

    return { provider, authorizationUrl, state, mock: MOCK_MODE };
  }

  async browseAdoptablePets(filters: BrowseShelterPetsFilters = {}): Promise<ShelterPet[]> {
    const results = MOCK_PETS.filter((pet) => shelterPetMatchesFilters(pet, filters));
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getShelterPet(provider: ShelterProvider, shelterPetId: string): Promise<ShelterPet> {
    const pet = MOCK_PETS.find((entry) => entry.provider === provider && entry.id === shelterPetId);
    if (!pet) {
      throw new Error('Shelter pet not found');
    }
    return pet;
  }

  async adoptPet(input: AdoptShelterPetInput): Promise<AdoptShelterPetResult> {
    const shelterPet = await this.getShelterPet(input.provider, input.shelterPetId);
    const createdPet = clonePetFromShelter(shelterPet, input.adopterUserId);

    store.pets.set(createdPet.id, createdPet);
    const adopter = store.users.get(input.adopterUserId);
    if (adopter) {
      adopter.pets = [...adopter.pets, { id: createdPet.id, name: createdPet.name }];
      adopter.updatedAt = new Date().toISOString();
      store.users.set(adopter.id, adopter);
    }

    const entries = [
      ...shelterPet.vaccinations.map((vaccination) =>
        createTransferredRecord(shelterPet, createdPet, {
          type: 'vaccination',
          title: vaccination.vaccineName,
          notes: vaccination.notes ?? `Shelter vaccination: ${vaccination.vaccineName}`,
          visitDate: vaccination.administeredAt,
          veterinarian: `Shelter Records (${shelterPet.shelterName})`,
          nextVisitDate: vaccination.nextDueDate,
        }),
      ),
      ...shelterPet.medicalHistory.map((record) =>
        createTransferredRecord(shelterPet, createdPet, record),
      ),
    ];

    const transferredRecords: AdoptShelterPetResult['transferredRecords'] = [];
    for (const record of entries) {
      store.medicalRecords.set(record.id, record);
      try {
        const anchored = await stellarAnchorService.anchorRecord({
          recordId: record.id,
          payload: toApiRecord(record),
          network: 'testnet',
        });
        const updated: StoredMedicalRecord = {
          ...record,
          blockchainTxHash: anchored.transactionId,
          blockchainHash: anchored.recordHash,
          isBlockchainVerified: anchored.status !== 'failed',
          blockchainVerifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.medicalRecords.set(updated.id, updated);
        transferredRecords.push({
          id: updated.id,
          type: updated.type,
          blockchainTxHash: updated.blockchainTxHash,
          blockchainHash: updated.blockchainHash,
          status: anchored.status === 'failed' ? 'failed' : anchored.status === 'pending' ? 'pending' : 'anchored',
        });
      } catch {
        transferredRecords.push({
          id: record.id,
          type: record.type,
          status: 'failed',
        });
      }
    }

    return {
      pet: createdPet,
      shelterPet,
      transferredRecords,
    };
  }
}

export const shelterIntegrationService = new ShelterIntegrationService();
export default shelterIntegrationService;
