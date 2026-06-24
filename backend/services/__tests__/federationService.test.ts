// Mock the Stellar SDK — Keypair.random() doesn't work under babel-jest
// (tweetnacl fails to initialise). Same approach as stellarService.test.ts.
jest.mock('@stellar/stellar-sdk', () => {
  const mockKeypair = (pub: string, sec: string) => ({
    publicKey: () => pub,
    secret: () => sec,
    sign: (data: Buffer) => Buffer.from(`sig:${data.toString('hex')}`),
    verify: (data: Buffer, sig: Buffer) => sig.toString() === `sig:${data.toString('hex')}`,
  });

  return {
    Keypair: {
      random: jest.fn(() => mockKeypair('GPUBKEY123', 'SSECKEY123')),
      fromSecret: jest.fn((sec: string) => mockKeypair('GPUBKEY123', sec)),
      fromPublicKey: jest.fn((pub: string) => mockKeypair(pub, '')),
    },
  };
});

import {
  claimFederatedAddress,
  getSignedRecord,
  getVetFederationRecord,
  lookupFederation,
  revokeVetCredential,
  signMedicalRecord,
  verifyRecordSignature,
} from '../federationService';

const CREDENTIAL_HASH = 'abc123def456';
const RECORD_PAYLOAD = { id: 'mr-1', petId: 'p-1', type: 'vaccination' };

describe('federationService', () => {
  describe('claimFederatedAddress', () => {
    it('creates a federation record with a Stellar keypair', () => {
      const record = claimFederatedAddress('vet-1', 'dr.test', CREDENTIAL_HASH);

      expect(record.federatedAddress).toBe('dr.test*petchain.app');
      expect(record.stellarPublicKey).toBe('GPUBKEY123');
      expect(record.vetId).toBe('vet-1');
      expect(record.revokedAt).toBeUndefined();
    });

    it('throws if the address is already claimed by another vet', () => {
      claimFederatedAddress('other-vet', 'dr.taken', CREDENTIAL_HASH);
      expect(() => claimFederatedAddress('vet-1', 'dr.taken', CREDENTIAL_HASH)).toThrow(
        'already claimed by another vet',
      );
    });

    it('throws if the same vet tries to claim the same active address again', () => {
      claimFederatedAddress('vet-dup', 'dr.dup', CREDENTIAL_HASH);
      expect(() => claimFederatedAddress('vet-dup', 'dr.dup', CREDENTIAL_HASH)).toThrow(
        'already active',
      );
    });
  });

  describe('lookupFederation', () => {
    it('returns the record for a valid federated address', () => {
      claimFederatedAddress('vet-lookup', 'dr.lookup', CREDENTIAL_HASH);
      const result = lookupFederation('dr.lookup*petchain.app', 'name');
      expect(result).not.toBeNull();
      expect(result!.vetId).toBe('vet-lookup');
    });

    it('returns null for unknown address', () => {
      expect(lookupFederation('nobody*petchain.app', 'name')).toBeNull();
    });

    it('returns null for unsupported type', () => {
      expect(lookupFederation('dr.lookup*petchain.app', 'id')).toBeNull();
    });

    it('returns null for a revoked address', () => {
      claimFederatedAddress('vet-revlookup', 'dr.revlookup', CREDENTIAL_HASH);
      revokeVetCredential('vet-revlookup');
      expect(lookupFederation('dr.revlookup*petchain.app', 'name')).toBeNull();
    });
  });

  describe('signMedicalRecord', () => {
    it('signs a record and returns a valid signature', () => {
      claimFederatedAddress('vet-signer', 'dr.signer', CREDENTIAL_HASH);
      const signed = signMedicalRecord('mr-sign-1', RECORD_PAYLOAD, 'vet-signer');

      expect(signed.recordId).toBe('mr-sign-1');
      expect(signed.vetFederatedAddress).toBe('dr.signer*petchain.app');
      expect(signed.vetPublicKey).toBe('GPUBKEY123');
      expect(signed.signature).toBeTruthy();
    });

    it('throws if vet has no federated identity', () => {
      expect(() => signMedicalRecord('mr-x', RECORD_PAYLOAD, 'no-such-vet')).toThrow(
        'no federated identity',
      );
    });
  });

  describe('verifyRecordSignature', () => {
    it('verifies a correctly signed record', () => {
      claimFederatedAddress('vet-verify', 'dr.verify', CREDENTIAL_HASH);
      signMedicalRecord('mr-verify-1', RECORD_PAYLOAD, 'vet-verify');
      expect(verifyRecordSignature('mr-verify-1', RECORD_PAYLOAD)).toBe(true);
    });

    it('returns false for a tampered payload', () => {
      claimFederatedAddress('vet-tamper', 'dr.tamper', CREDENTIAL_HASH);
      signMedicalRecord('mr-tamper-1', RECORD_PAYLOAD, 'vet-tamper');
      expect(verifyRecordSignature('mr-tamper-1', { ...RECORD_PAYLOAD, type: 'surgery' })).toBe(
        false,
      );
    });

    it('returns false for an unsigned record', () => {
      expect(verifyRecordSignature('mr-unsigned', RECORD_PAYLOAD)).toBe(false);
    });
  });

  describe('revokeVetCredential', () => {
    it('marks the credential as revoked', () => {
      claimFederatedAddress('vet-to-revoke', 'dr.torevoke', CREDENTIAL_HASH);
      revokeVetCredential('vet-to-revoke');
      const record = getVetFederationRecord('vet-to-revoke');
      expect(record?.revokedAt).toBeDefined();
    });

    it('throws if vet has no federation record', () => {
      expect(() => revokeVetCredential('ghost-vet')).toThrow('no federated identity');
    });

    it('throws if already revoked', () => {
      claimFederatedAddress('vet-double-revoke', 'dr.doublerevoke', CREDENTIAL_HASH);
      revokeVetCredential('vet-double-revoke');
      expect(() => revokeVetCredential('vet-double-revoke')).toThrow('Already revoked');
    });
  });

  describe('getSignedRecord', () => {
    it('returns null for a record that was never signed', () => {
      expect(getSignedRecord('mr-never-signed')).toBeNull();
    });

    it('returns the signed record after signing', () => {
      claimFederatedAddress('vet-getsigned', 'dr.getsigned', CREDENTIAL_HASH);
      signMedicalRecord('mr-getsigned-1', RECORD_PAYLOAD, 'vet-getsigned');
      const result = getSignedRecord('mr-getsigned-1');
      expect(result).not.toBeNull();
      expect(result!.vetFederatedAddress).toBe('dr.getsigned*petchain.app');
    });
  });
});
