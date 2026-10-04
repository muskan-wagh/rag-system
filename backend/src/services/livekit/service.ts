import { AccessToken } from 'livekit-server-sdk';
import { config } from '@/config';

/**
 * LiveKit video/audio layer for technical interviews (video ONLY).
 * - Reuses the existing interview auth: candidate session / recruiter
 *   ownership are validated by the CALLING controller, never here.
 * - Room names are deterministic per interview: no extra tables, no
 *   secrets in the database. API secret never leaves this module.
 * - Short-lived participant tokens (2h) scoped to ONE room via grant.
 */

export type LivekitRole = 'candidate' | 'interviewer';

export function isLivekitConfigured(): boolean {
  return Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);
}

/** Deterministic private room per interview — stable across reconnects. */
export function livekitRoomName(interviewId: string): string {
  const hex = String(interviewId).replace(/[^a-zA-Z0-9-]/g, '').replace(/-/g, '').slice(0, 32) || 'unknown';
  return `hs-interview-${hex}`;
}

function participantIdentity(role: LivekitRole, subjectId: string): string {
  const safe = String(subjectId).replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64) || 'unknown';
  return `${role}-${safe}`;
}

export interface MintTokenInput {
  interviewId: string;
  role: LivekitRole;
  /** Candidate id or recruiter id — embedded in the identity only. */
  subjectId: string;
  displayName: string;
}

export interface MintedToken {
  token: string;
  url: string;
  room: string;
  identity: string;
  /** Seconds until the LiveKit JWT expires. */
  expiresIn: number;
}

const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2h — covers long interviews + reconnects

export async function mintLivekitToken(input: MintTokenInput): Promise<MintedToken> {
  if (!isLivekitConfigured()) {
    throw new Error('LiveKit is not configured');
  }
  const room = livekitRoomName(input.interviewId);
  const identity = participantIdentity(input.role, input.subjectId);
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity,
    name: input.displayName.slice(0, 64) || identity,
    ttl: `${TOKEN_TTL_SECONDS}s`,
  });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  return { token, url: config.livekit.url, room, identity, expiresIn: TOKEN_TTL_SECONDS };
}
