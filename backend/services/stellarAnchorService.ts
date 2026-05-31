/**
 * Stellar SEP-24 Interactive Deposit (Fiat On-Ramp)
 *
 * Flow:
 *  1. Client calls initiateDeposit → backend fetches SEP-24 interactive URL from anchor
 *  2. Client opens the URL in a WebView; user completes KYC / bank transfer
 *  3. Client polls getDepositStatus until status is 'completed' or 'error'
 *
 * Supported anchors (configured via env):
 *   ANCHOR_HOME_DOMAIN  – e.g. "testanchor.stellar.org"
 *   ANCHOR_ASSET_CODE   – e.g. "USDC"
 *   ANCHOR_ASSET_ISSUER – Stellar public key of the asset issuer
 *
 * References:
 *   https://stellar.org/protocol/sep-24
 *   https://stellar.org/protocol/sep-10  (auth)
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK === 'mainnet'
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;

const ANCHOR_HOME_DOMAIN =
  process.env.ANCHOR_HOME_DOMAIN ?? 'testanchor.stellar.org';
const ANCHOR_ASSET_CODE = process.env.ANCHOR_ASSET_CODE ?? 'SRT';
const ANCHOR_ASSET_ISSUER =
  process.env.ANCHOR_ASSET_ISSUER ??
  'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6';

export type DepositStatus =
  | 'pending_user_transfer_start'
  | 'pending_external'
  | 'pending_anchor'
  | 'pending_stellar'
  | 'completed'
  | 'error'
  | 'refunded';

export interface DepositRecord {
  id: string;
  userId: string;
  walletAddress: string;
  assetCode: string;
  currency: string;
  amountIn?: string;
  amountOut?: string;
  interactiveUrl: string;
  status: DepositStatus;
  message?: string;
  stellarTxId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InitiateDepositResult {
  depositId: string;
  interactiveUrl: string;
  assetCode: string;
  currency: string;
}

// ─── SEP-1 / TOML helpers ────────────────────────────────────────────────────

interface StellarToml {
  TRANSFER_SERVER_SEP0024?: string;
  WEB_AUTH_ENDPOINT?: string;
}

async function fetchStellarToml(homeDomain: string): Promise<StellarToml> {
  const url = `https://${homeDomain}/.well-known/stellar.toml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch stellar.toml from ${homeDomain}`);
  const text = await res.text();
  return parseStellarToml(text);
}

function parseStellarToml(toml: string): StellarToml {
  const result: Record<string, string> = {};
  for (const line of toml.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]+)"/);
    if (match) result[match[1]] = match[2];
  }
  return result as StellarToml;
}

// ─── SEP-10 Web Auth ─────────────────────────────────────────────────────────

async function getSep10Token(
  webAuthEndpoint: string,
  keypair: StellarSdk.Keypair,
): Promise<string> {
  // Step 1: GET challenge
  const challengeRes = await fetch(
    `${webAuthEndpoint}?account=${keypair.publicKey()}`,
  );
  if (!challengeRes.ok) throw new Error('SEP-10 challenge request failed');
  const { transaction: challengeXdr } = (await challengeRes.json()) as {
    transaction: string;
  };

  // Step 2: Sign challenge
  const tx = new StellarSdk.Transaction(challengeXdr, NETWORK_PASSPHRASE);
  tx.sign(keypair);

  // Step 3: POST signed challenge
  const tokenRes = await fetch(webAuthEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  if (!tokenRes.ok) throw new Error('SEP-10 token request failed');
  const { token } = (await tokenRes.json()) as { token: string };
  return token;
}

// ─── In-memory deposit store (replace with DB in production) ─────────────────

const deposits = new Map<string, DepositRecord>();

function generateId(): string {
  return `dep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export class StellarAnchorService {
  private readonly homeDomain: string;
  private readonly assetCode: string;
  private readonly assetIssuer: string;

  constructor(
    homeDomain = ANCHOR_HOME_DOMAIN,
    assetCode = ANCHOR_ASSET_CODE,
    assetIssuer = ANCHOR_ASSET_ISSUER,
  ) {
    this.homeDomain = homeDomain;
    this.assetCode = assetCode;
    this.assetIssuer = assetIssuer;
  }

  /**
   * Initiate a SEP-24 interactive deposit.
   *
   * @param userId       Internal user ID (for record-keeping)
   * @param walletAddress  User's Stellar public key
   * @param currency     Fiat currency code, e.g. "USD" or "EUR"
   * @param userSecret   Optional: user's Stellar secret for SEP-10 auth.
   *                     If omitted, a temporary keypair is used (anchor may
   *                     still require the user to authenticate in the WebView).
   */
  async initiateDeposit(
    userId: string,
    walletAddress: string,
    currency: string,
    userSecret?: string,
  ): Promise<InitiateDepositResult> {
    const toml = await fetchStellarToml(this.homeDomain);

    const transferServer = toml.TRANSFER_SERVER_SEP0024;
    if (!transferServer) {
      throw new Error(`Anchor ${this.homeDomain} does not support SEP-24`);
    }

    // SEP-10 auth
    const keypair = userSecret
      ? StellarSdk.Keypair.fromSecret(userSecret)
      : StellarSdk.Keypair.random();

    let jwtToken: string | undefined;
    if (toml.WEB_AUTH_ENDPOINT) {
      jwtToken = await getSep10Token(toml.WEB_AUTH_ENDPOINT, keypair);
    }

    // SEP-24 interactive deposit request
    const body = new URLSearchParams({
      asset_code: this.assetCode,
      asset_issuer: this.assetIssuer,
      account: walletAddress,
      lang: 'en',
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;

    const depositRes = await fetch(`${transferServer}/transactions/deposit/interactive`, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!depositRes.ok) {
      const err = await depositRes.text();
      throw new Error(`SEP-24 deposit initiation failed: ${err}`);
    }

    const { id: anchorId, url: interactiveUrl } = (await depositRes.json()) as {
      id: string;
      url: string;
      type: string;
    };

    const depositId = generateId();
    const record: DepositRecord = {
      id: depositId,
      userId,
      walletAddress,
      assetCode: this.assetCode,
      currency,
      interactiveUrl,
      status: 'pending_user_transfer_start',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store anchor's transaction ID in the message field for polling
    record.message = anchorId;
    deposits.set(depositId, record);

    return { depositId, interactiveUrl, assetCode: this.assetCode, currency };
  }

  /**
   * Poll the anchor for the current deposit status.
   * The anchor transaction ID is stored in record.message.
   */
  async getDepositStatus(depositId: string): Promise<DepositRecord> {
    const record = deposits.get(depositId);
    if (!record) throw new Error(`Deposit ${depositId} not found`);

    // If already terminal, return cached state
    if (record.status === 'completed' || record.status === 'error' || record.status === 'refunded') {
      return record;
    }

    const anchorTxId = record.message;
    if (!anchorTxId) return record;

    try {
      const toml = await fetchStellarToml(this.homeDomain);
      const transferServer = toml.TRANSFER_SERVER_SEP0024;
      if (!transferServer) return record;

      const res = await fetch(
        `${transferServer}/transaction?id=${anchorTxId}`,
      );
      if (!res.ok) return record;

      const { transaction } = (await res.json()) as {
        transaction: {
          status: DepositStatus;
          amount_in?: string;
          amount_out?: string;
          message?: string;
          stellar_transaction_id?: string;
        };
      };

      record.status = transaction.status;
      record.amountIn = transaction.amount_in;
      record.amountOut = transaction.amount_out;
      record.stellarTxId = transaction.stellar_transaction_id;
      if (transaction.message) record.message = transaction.message;
      record.updatedAt = new Date();
      deposits.set(depositId, record);
    } catch {
      // Network error — return last known state
    }

    return record;
  }

  /** List all deposits for a user. */
  getDepositsForUser(userId: string): DepositRecord[] {
    return Array.from(deposits.values()).filter((d) => d.userId === userId);
  }
}

export const stellarAnchorService = new StellarAnchorService();
export default stellarAnchorService;
