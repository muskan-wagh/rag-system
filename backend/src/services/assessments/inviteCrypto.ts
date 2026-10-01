import crypto from 'crypto';
import { config } from '@/config';

/**
 * Assessment invite tokens (recruiter-side generation only).
 *
 * - Opaque 256-bit random token, base64url-encoded for URLs.
 * - Only the SHA-256 hash is used for verification/lookup (UNIQUE).
 * - An AES-256-GCM encrypted copy is stored alongside so a Resend can reuse
 *   the SAME token/link. The key is derived (HKDF) from the server's
 *   SUPABASE_SERVICE_ROLE_KEY — always present (required env), no new env
 *   vars, no changes to Gmail/Resend infrastructure. Anyone holding the
 *   service_role key already has full DB access, so this adds no privilege.
 * - Candidate verification (hash comparison on the take-link) belongs to the
 *   future candidate phase and is intentionally NOT implemented here.
 */

const INFO = 'assessment-invite-v1';
const IV_BYTES = 12;

function inviteKey(): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', config.supabase.serviceRoleKey, INFO, '', 32) as ArrayBuffer);
}

/** 256-bit opaque token safe to embed in a URL path segment. */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest — the stored verification credential. */
export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf-8').digest('hex');
}

function b64url(b: Buffer): string {
  return b.toString('base64url');
}

/** Reversible encryption of the token for same-token resends. */
export function encryptInviteToken(token: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', inviteKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf-8'), cipher.final()]);
  return `${b64url(iv)}.${b64url(cipher.getAuthTag())}.${b64url(ciphertext)}`;
}

/** Unwrap a token previously sealed with encryptInviteToken. */
export function decryptInviteToken(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted invite token format.');
  const [ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', inviteKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf-8');
}

/** Public candidate link embedded in the invitation email. */
export function buildAssessmentLink(token: string): string {
  const base = config.clientUrl.replace(/\/+$/, '');
  return `${base}/assessments/take/${token}`;
}

/** True when an availability window has already closed. Null/undefined = no expiry. */
export function isWindowExpired(availableUntil: string | null | undefined, now = new Date()): boolean {
  if (!availableUntil) return false;
  const until = new Date(availableUntil).getTime();
  if (Number.isNaN(until)) return false;
  return until <= now.getTime();
}

/** Event-keyed email-log idempotency key (NOT a content hash). */
export function inviteEmailKey(assessmentId: string, candidateId: string, sendNumber: number): string {
  const base = `assessment_invite:${assessmentId}:${candidateId}`;
  return sendNumber <= 1 ? base : `${base}:resend-${sendNumber}`;
}
