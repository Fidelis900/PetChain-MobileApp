import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 10;
const RECOVERY_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

authenticator.options = { window: 1 }; // ±30 s clock-drift tolerance

// ── Secret & QR ───────────────────────────────────────────────────────────

export function generateSecret(): string {
  return authenticator.generateSecret(20);
}

export async function generateQRCodeDataURL(
  secret: string,
  email: string,
  issuer = 'PetChain',
): Promise<string> {
  const otpauth = authenticator.keyuri(email, issuer, secret);
  return QRCode.toDataURL(otpauth);
}

// ── TOTP verification ──────────────────────────────────────────────────────

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

// ── Backup codes ───────────────────────────────────────────────────────────

function randomCode(): string {
  return randomBytes(8).toString('hex').toUpperCase().slice(0, 10);
}

export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = randomCode();
    plain.push(code);
    hashed.push(await bcrypt.hash(code, BCRYPT_ROUNDS));
  }
  return { plain, hashed };
}

/** Returns the index of the matched hash (for single-use removal), or -1. */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<number> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code.toUpperCase(), hashedCodes[i])) return i;
  }
  return -1;
}

// ── Recovery tokens ────────────────────────────────────────────────────────

export interface RecoveryToken {
  token: string;
  hashedToken: string;
  expiresAt: number; // epoch ms
}

export async function generateRecoveryToken(): Promise<RecoveryToken> {
  const token = randomBytes(32).toString('hex');
  const hashedToken = await bcrypt.hash(token, BCRYPT_ROUNDS);
  return { token, hashedToken, expiresAt: Date.now() + RECOVERY_TOKEN_TTL_MS };
}

export async function verifyRecoveryToken(
  token: string,
  hashedToken: string,
  expiresAt: number,
): Promise<boolean> {
  if (Date.now() > expiresAt) return false;
  return bcrypt.compare(token, hashedToken);
}
