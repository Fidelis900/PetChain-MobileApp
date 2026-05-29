import { Asset, Keypair, Memo, Networks, Operation, Server, TransactionBuilder } from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const RECEIVING_SECRET = process.env.STELLAR_RECEIVING_SECRET || '';
const PREMIUM_PRICE_XLM = parseFloat(process.env.PREMIUM_PRICE_XLM || '10');
const OVERPAYMENT_TOLERANCE = 0.001;

const server = new Server(HORIZON_URL);

export interface PaymentIntent {
  transactionId: string;
  destination: string;
  amountXlm: number;
  memo: string;
  expiresAt: Date;
}

export type PaymentStatus = 'confirmed' | 'partial' | 'overpaid' | 'expired';

export interface PaymentResult {
  status: PaymentStatus;
  amountReceived: number;
  txHash: string;
}

function receivingKeypair(): Keypair {
  if (!RECEIVING_SECRET) {
    throw new Error('STELLAR_RECEIVING_SECRET is required');
  }

  return Keypair.fromSecret(RECEIVING_SECRET);
}

export function createPaymentIntent(userId: string): PaymentIntent {
  const transactionId = `PET-${userId}-${Date.now()}`;
  const destination = receivingKeypair().publicKey();

  return {
    transactionId,
    destination,
    amountXlm: PREMIUM_PRICE_XLM,
    memo: transactionId.slice(0, 28),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
}

export function streamPayment(
  intent: PaymentIntent,
  onResult: (result: PaymentResult) => void,
  onError?: (error: Error) => void,
): () => void {
  const destination = receivingKeypair().publicKey();

  const close = server
    .payments()
    .forAccount(destination)
    .cursor('now')
    .stream({
      onmessage: async (payment: any) => {
        try {
          if (payment.type !== 'payment') return;
          if (payment.asset_type !== 'native') return;
          if (payment.to !== destination) return;

          const transaction = await payment.transaction();
          if (transaction.memo !== intent.memo) return;

          const received = parseFloat(payment.amount);
          const expected = intent.amountXlm;
          const status =
            received > expected + OVERPAYMENT_TOLERANCE
              ? 'overpaid'
              : received >= expected - OVERPAYMENT_TOLERANCE
                ? 'confirmed'
                : 'partial';

          onResult({ status, amountReceived: received, txHash: payment.transaction_hash });
          close();
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Failed to process Stellar payment'));
        }
      },
      onerror: (error: Error) => {
        onError?.(error);
      },
    });

  return close;
}

export async function processRefund(
  destinationPublicKey: string,
  amountXlm: string,
): Promise<string> {
  const sourceKeypair = receivingKeypair();
  const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: Asset.native(),
        amount: amountXlm,
      }),
    )
    .addMemo(Memo.text('PetChain refund'))
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
