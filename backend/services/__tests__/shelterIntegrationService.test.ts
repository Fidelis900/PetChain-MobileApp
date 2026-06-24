import { UserRole } from '../../models/UserRole';
import { store } from '../../server/store';
import shelterIntegrationService from '../shelterIntegrationService';

const mockAnchorRecord = jest.fn();

jest.mock('../stellarService', () => ({
  __esModule: true,
  default: {
    anchorRecord: (...args: unknown[]) => mockAnchorRecord(...args),
  },
}));

describe('shelterIntegrationService', () => {
  beforeEach(() => {
    mockAnchorRecord.mockReset();
    mockAnchorRecord.mockResolvedValue({
      recordId: 'record-1',
      recordHash: 'hash-1',
      transactionId: 'tx-1',
      status: 'submitted',
    });

    store.users.clear();
    store.pets.clear();
    store.medicalRecords.clear();
    store.users.set('user-1', {
      id: 'user-1',
      email: 'adopter@test.com',
      name: 'Adopter',
      role: UserRole.OWNER,
      pets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
      twoFactorEnabled: false,
    });
  });

  it('filters adoptable pets by provider, species, location, and age', async () => {
    const pets = await shelterIntegrationService.browseAdoptablePets({
      provider: 'petfinder',
      species: 'dog',
      location: 'Austin',
      ageMaxMonths: 24,
    });

    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Bella');
  });

  it('creates a pet profile and transfers shelter records onto the new profile', async () => {
    const result = await shelterIntegrationService.adoptPet({
      provider: 'adopt-a-pet',
      shelterPetId: 'apa-ginger-002',
      adopterUserId: 'user-1',
    });

    expect(result.pet.name).toBe('Ginger');
    expect(result.pet.ownerId).toBe('user-1');
    expect(store.pets.get(result.pet.id)).toMatchObject({
      name: 'Ginger',
      ownerId: 'user-1',
      microchipId: '981020300000123',
    });

    expect(store.users.get('user-1')?.pets).toEqual([{ id: result.pet.id, name: 'Ginger' }]);
    expect(result.transferredRecords).toHaveLength(3);
    expect(mockAnchorRecord).toHaveBeenCalledTimes(3);

    const anchoredRecord = store.medicalRecords.get(result.transferredRecords[0].id);
    expect(anchoredRecord?.blockchainTxHash).toBe('tx-1');
    expect(anchoredRecord?.blockchainHash).toBe('hash-1');
    expect(anchoredRecord?.isBlockchainVerified).toBe(true);
  });
});
