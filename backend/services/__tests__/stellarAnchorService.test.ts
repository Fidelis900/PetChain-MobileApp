import { StellarAnchorService } from '../stellarAnchorService';

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockToml = `
TRANSFER_SERVER_SEP0024="https://testanchor.stellar.org/sep24"
WEB_AUTH_ENDPOINT="https://testanchor.stellar.org/auth"
`;

const mockChallengeXdr =
  'AAAAAgAAAABSomeBase64EncodedTransactionXDRHere==';

function makeFetchMock(overrides: Record<string, unknown> = {}) {
  return jest.fn().mockImplementation((url: string) => {
    if (url.includes('stellar.toml')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockToml) });
    }
    if (url.includes('/auth') && !url.includes('POST')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ transaction: mockChallengeXdr }),
      });
    }
    if (url.includes('/transactions/deposit/interactive')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'anchor-tx-001',
            url: 'https://testanchor.stellar.org/sep24/interactive?token=abc',
            type: 'interactive_customer_info_needed',
            ...overrides,
          }),
      });
    }
    if (url.includes('/transaction?id=')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            transaction: {
              status: 'completed',
              amount_in: '100.00',
              amount_out: '99.50',
              stellar_transaction_id: 'stellar-tx-hash-abc',
              ...overrides,
            },
          }),
      });
    }
    return Promise.resolve({ ok: false, text: () => Promise.resolve('Not found') });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StellarAnchorService', () => {
  let service: StellarAnchorService;

  beforeEach(() => {
    service = new StellarAnchorService(
      'testanchor.stellar.org',
      'SRT',
      'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initiateDeposit', () => {
    it('returns a depositId and interactiveUrl on success', async () => {
      global.fetch = makeFetchMock() as typeof fetch;

      const result = await service.initiateDeposit(
        'user-1',
        'GABC123',
        'USD',
      );

      expect(result.depositId).toMatch(/^dep_/);
      expect(result.interactiveUrl).toContain('testanchor.stellar.org');
      expect(result.assetCode).toBe('SRT');
      expect(result.currency).toBe('USD');
    });

    it('stores the deposit record internally', async () => {
      global.fetch = makeFetchMock() as typeof fetch;

      const { depositId } = await service.initiateDeposit('user-2', 'GXYZ', 'EUR');
      const deposits = service.getDepositsForUser('user-2');

      expect(deposits).toHaveLength(1);
      expect(deposits[0].id).toBe(depositId);
      expect(deposits[0].status).toBe('pending_user_transfer_start');
    });

    it('throws when the anchor does not support SEP-24', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# no transfer server'),
      }) as typeof fetch;

      await expect(
        service.initiateDeposit('user-3', 'GABC', 'USD'),
      ).rejects.toThrow('does not support SEP-24');
    });

    it('throws when the anchor deposit endpoint returns an error', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('stellar.toml')) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(mockToml) });
        }
        if (url.includes('/auth')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ transaction: mockChallengeXdr }),
          });
        }
        return Promise.resolve({ ok: false, text: () => Promise.resolve('Unauthorized') });
      }) as typeof fetch;

      await expect(
        service.initiateDeposit('user-4', 'GABC', 'USD'),
      ).rejects.toThrow('SEP-24 deposit initiation failed');
    });
  });

  describe('getDepositStatus', () => {
    it('polls the anchor and updates the record status', async () => {
      global.fetch = makeFetchMock() as typeof fetch;

      const { depositId } = await service.initiateDeposit('user-5', 'GABC', 'USD');
      const record = await service.getDepositStatus(depositId);

      expect(record.status).toBe('completed');
      expect(record.amountIn).toBe('100.00');
      expect(record.amountOut).toBe('99.50');
      expect(record.stellarTxId).toBe('stellar-tx-hash-abc');
    });

    it('throws for an unknown depositId', async () => {
      await expect(service.getDepositStatus('nonexistent')).rejects.toThrow('not found');
    });

    it('returns cached state for terminal deposits without re-fetching', async () => {
      global.fetch = makeFetchMock() as typeof fetch;

      const { depositId } = await service.initiateDeposit('user-6', 'GABC', 'USD');
      // First poll → sets status to 'completed'
      await service.getDepositStatus(depositId);

      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Second poll → should return cached, no new fetch
      await service.getDepositStatus(depositId);
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallCount);
    });
  });

  describe('getDepositsForUser', () => {
    it('returns only deposits belonging to the given user', async () => {
      global.fetch = makeFetchMock() as typeof fetch;

      await service.initiateDeposit('alice', 'GABC', 'USD');
      await service.initiateDeposit('alice', 'GABC', 'EUR');
      await service.initiateDeposit('bob', 'GXYZ', 'USD');

      expect(service.getDepositsForUser('alice')).toHaveLength(2);
      expect(service.getDepositsForUser('bob')).toHaveLength(1);
      expect(service.getDepositsForUser('charlie')).toHaveLength(0);
    });
  });
});
