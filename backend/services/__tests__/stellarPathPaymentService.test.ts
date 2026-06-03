import * as StellarSdk from '@stellar/stellar-sdk';

import { UserRole } from '../../models/UserRole';
import { store } from '../../server/store';
import stellarPathPaymentService, {
  StellarPathPaymentService,
} from '../stellarPathPaymentService';

function buildServer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    strictReceivePaths: jest.fn(),
    strictSendPaths: jest.fn(),
    loadAccount: jest.fn(),
    fetchBaseFee: jest.fn().mockResolvedValue(100),
    submitTransaction: jest.fn(),
    ...overrides,
  } as unknown as ConstructorParameters<typeof StellarPathPaymentService>[0];
}

describe('stellarPathPaymentService', () => {
  beforeEach(() => {
    store.users.clear();
    store.users.set('user-1', {
      id: 'user-1',
      email: 'buyer@test.com',
      name: 'Buyer',
      role: UserRole.OWNER,
      pets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
      twoFactorEnabled: false,
    });
  });

  it('uses a Stellar path when Horizon returns a conversion route', async () => {
    const sourceKeypair = StellarSdk.Keypair.random();
    const server = buildServer();
    const account = new StellarSdk.Account(sourceKeypair.publicKey(), '123456789');

    (server.strictReceivePaths as jest.Mock).mockReturnValue({
      call: jest.fn().mockResolvedValue({
        records: [
          {
            path: [
              {
                asset_code: 'USDC',
                asset_issuer: 'GDUKMGUGDZQK6YH2C4T3XYA3T7T7EXAMPLE',
                asset_type: 'credit_alphanum4',
              },
            ],
            source_amount: '12.5000000',
            source_asset_type: 'credit_alphanum4',
            source_asset_code: 'USDC',
            source_asset_issuer: 'GDUKMGUGDZQK6YH2C4T3XYA3T7T7EXAMPLE',
            destination_amount: '9.9900000',
            destination_asset_type: 'native',
            destination_asset_code: 'XLM',
            destination_asset_issuer: '',
          },
        ],
      }),
    });
    (server.loadAccount as jest.Mock).mockResolvedValue(account);
    (server.submitTransaction as jest.Mock).mockResolvedValue({
      hash: 'tx-hash-1',
      ledger: 123,
    });

    const service = new StellarPathPaymentService(server);
    const prepared = await service.preparePayment({
      userId: 'user-1',
      plan: 'premium_monthly',
      sourceAsset: {
        code: 'USDC',
        issuer: 'GDUKMGUGDZQK6YH2C4T3XYA3T7T7EXAMPLE',
      },
      sourceAccount: sourceKeypair.publicKey(),
    });

    expect(prepared.quote.mode).toBe('path');
    expect(prepared.quote.pathCount).toBe(1);
    expect(prepared.quote.exchangeRate).toBe('1.2512513');

    const tx = new StellarSdk.Transaction(
      prepared.transactionXdr,
      StellarSdk.Networks.TESTNET,
    );
    tx.sign(sourceKeypair);

    const submitted = await service.submitPayment({
      paymentId: prepared.payment.id,
      signedTransactionXdr: tx.toXDR(),
    });

    expect(submitted.transactionHash).toBe('tx-hash-1');
    expect(submitted.subscription.plan).toBe('premium_monthly');
    expect(submitted.quote.mode).toBe('path');
    expect(server.strictReceivePaths).toHaveBeenCalled();
    expect(server.submitTransaction).toHaveBeenCalled();
  });

  it('falls back to direct XLM payment when no path is found', async () => {
    const sourceKeypair = StellarSdk.Keypair.random();
    const server = buildServer();
    const account = new StellarSdk.Account(sourceKeypair.publicKey(), '987654321');

    (server.strictReceivePaths as jest.Mock).mockReturnValue({
      call: jest.fn().mockResolvedValue({ records: [] }),
    });
    (server.strictSendPaths as jest.Mock).mockReturnValue({
      call: jest.fn().mockResolvedValue({
        records: [
          {
            path: [],
            source_amount: '9.9900000',
            source_asset_type: 'native',
            source_asset_code: 'XLM',
            source_asset_issuer: '',
            destination_amount: '9.9900000',
            destination_asset_type: 'native',
            destination_asset_code: 'XLM',
            destination_asset_issuer: '',
          },
        ],
      }),
    });
    (server.loadAccount as jest.Mock).mockResolvedValue(account);
    (server.submitTransaction as jest.Mock).mockResolvedValue({
      hash: 'tx-hash-2',
      ledger: 456,
    });

    const service = new StellarPathPaymentService(server);
    const prepared = await service.preparePayment({
      userId: 'user-1',
      plan: 'premium_monthly',
      sourceAsset: {
        code: 'USDC',
        issuer: 'GDUKMGUGDZQK6YH2C4T3XYA3T7T7EXAMPLE',
      },
      sourceAccount: sourceKeypair.publicKey(),
    });

    expect(prepared.quote.mode).toBe('direct-xlm');
    expect(prepared.quote.fallbackReason).toContain('No conversion path');

    const tx = new StellarSdk.Transaction(
      prepared.transactionXdr,
      StellarSdk.Networks.TESTNET,
    );
    tx.sign(sourceKeypair);

    const submitted = await service.submitPayment({
      paymentId: prepared.payment.id,
      signedTransactionXdr: tx.toXDR(),
    });

    expect(submitted.transactionHash).toBe('tx-hash-2');
    expect(server.strictSendPaths).toHaveBeenCalled();
  });
});
