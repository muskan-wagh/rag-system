import crypto from 'crypto';
import { config } from '@/config';
import { getSupabaseClient } from '@/services/supabase/client';

/**
 * Short-lived candidate sessions (correction #9).
 * Flow: candidate opens /assessments/take/[token] -> validate opaque
 * invite token ONCE -> create session -> set HttpOnly Secure
 * SameSite=Lax cookie `hs_candidate`. Subsequent candidate API calls
 * authenticate via the session cookie, NOT the raw token.
 * Raw tokens are never stored in localStorage and never required
 * per-request after exchange.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const INFO = 'candidate-session-v1';

function sessionKey(): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', config.supabase.serviceRoleKey, INFO, '', 32) as ArrayBuffer);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf-8').digest('hex');
}

export async function createCandidateSession(input: {
  candidateId: string;
  inviteId?: string | null;
  interviewInviteId?: string | null;
  scope: 'assessment' | 'interview';
}): Promise<{ token: string; expiresAt: Date }> {
  const supabase = getSupabaseClient();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { error } = await supabase.from('candidate_sessions').insert({
    candidate_id: input.candidateId,
    invite_id: input.inviteId || null,
    interview_invite_id: input.interviewInviteId || null,
    session_hash: hashSessionToken(token),
    scope: input.scope,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Failed to create candidate session: ${error.message}`);
  return { token, expiresAt };
}

export interface CandidateSession {
  id: string;
  candidate_id: string;
  invite_id: string | null;
  interview_invite_id: string | null;
  scope: 'assessment' | 'interview';
  expires_at: string;
}

export async function verifyCandidateSession(token: string): Promise<CandidateSession | null> {
  if (!token) return null;
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('candidate_sessions')
    .select('id, candidate_id, invite_id, interview_invite_id, scope, expires_at')
    .eq('session_hash', hashSessionToken(token))
    .maybeSingle();
  if (!data) return null;
  if (new Date((data as CandidateSession).expires_at).getTime() <= Date.now()) return null;
  return data as CandidateSession;
}

export function sessionCookieHeader(token: string, expiresAt: Date): string {
  const parts = [
    `hs_candidate=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
    'Max-Age=43200',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader(): string {
  return 'hs_candidate=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
}

/** Parse cookies without adding a dependency (express has no cookie parser installed). */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function signValue(value: string): string {
  const h = crypto.createHmac('sha256', sessionKey()).update(value, 'utf-8').digest('base64url');
  return `${value}.${h}`;
}

export function verifySignedValue(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', sessionKey()).update(value, 'utf-8').digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}
