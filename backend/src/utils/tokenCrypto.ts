import crypto from 'crypto';
import { config } from '@/config';

/**
 * Isolated AES-256-GCM token encryption utility for Gmail OAuth tokens.
 *
 * - No other part of the codebase had encryption support (verified 2026-09-27),
 *   so this is intentionally small and Gmail-scoped.
 * - Refresh tokens are always encrypted; access tokens encrypted if stored.
 * - Format: base64url(iv) + "." + base64url(authTag) + "." + base64url(ciphertext)
 * - Never log plaintext tokens — callers must only log lengths/presence.
 */

const IV_BYTES = 12;

function resolveKey(): Buffer | null {
  const raw = (config as unknown as { gmailTokenEncryptionKey?: string }).gmailTokenEncryptionKey
    || process.env.GMAIL_TOKEN_ENCRYPTION_KEY
    || '';
  if (!raw) return null;
  const trimmed = raw.trim();
  // Accept 64-char hex (32 bytes) or base64 (~44 chars) or raw passphrase.
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32 && trimmed.length >= 40) return b64;
  } catch {
    // fall through to passphrase derivation
  }
  // Dev convenience: derive 32 bytes via SHA-256. Production should use a
  // random 32-byte hex value (see .env.example).
  return crypto.createHash('sha256').update(trimmed, 'utf-8').digest();
}

export function isTokenCryptoConfigured(): boolean {
  return resolveKey() !== null;
}

export function encryptToken(plaintext: string): string {
  const key = resolveKey();
  if (!key) {
    throw new Error(
      'GMAIL_TOKEN_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -hex 32',
    );
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64url = (b: Buffer) => b.toString('base64url');
  return `${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

export function decryptToken(payload: string): string {
  const key = resolveKey();
  if (!key) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY is not configured.');
  }
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format.');
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ctB64, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

/** Detect legacy plaintext vs new encrypted payload (encrypted has 2 dots). */
export function looksEncrypted(value: string): boolean {
  return typeof value === 'string' && value.split('.').length === 3 && value.length > 40;
}
