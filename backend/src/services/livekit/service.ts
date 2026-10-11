import { AccessToken } from 'livekit-server-sdk';
import { config } from '@/config';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

/**
 * LiveKit access tokens for technical interviews.
 *
 * Scope: VIDEO/AUDIO ONLY.
 *
 * The live-coding collaboration system is the existing WebSocket layer
 * (`services/websocket`) and is deliberately NOT replaced or duplicated here.
 * LiveKit carries media; the WebSocket carries code.
 *
 * Access tokens are minted server-side only. The API secret never reaches the
 * browser — the client receives a short-lived, room-scoped token and the public
 * `wss://` URL.
 */

const DEFAULT_TTL_SECONDS = 2 * 60 * 60; // 2 hours — covers a long interview slot.

export function isLiveKitConfigured(): boolean {
  return Boolean(config.livekit.url && config.livekit.apiKey && config.livekit.apiSecret);
}

export interface LiveKitTokenInput {
  /** Room name. Must be derived from an authorized interview id — never client input. */
  roomName: string;
  /** Display name shown to the other participant. */
  participantName: string;
  /** Stable id for LiveKit participant tracking. */
  participantId: string;
  /** Recruiters may publish; candidates always join as a viewer-free participant. */
  canPublish: boolean;
  ttlSeconds?: number;
}

export interface LiveKitTokenResult {
  token: string;
  url: string;
  roomName: string;
  expiresIn: number;
}

export async function createLiveKitToken(input: LiveKitTokenInput): Promise<LiveKitTokenResult> {
  if (!isLiveKitConfigured()) {
    throw new AppError(
      'Live video is not configured for this deployment',
      503,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
  // Room names must be safe to embed in a URL and must never contain raw ids
  // that a client could manipulate to reach another interview's room.
  const room = input.roomName.replace(/[^a-zA-Z0-9_\-=]/g, '_');

  const ttl = Math.max(60, Math.min(input.ttlSeconds ?? DEFAULT_TTL_SECONDS, 24 * 3600));
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: input.participantId,
    name: input.participantName.slice(0, 64) || 'Participant',
    ttl,
  });

  // Candidates join as subscribers (audio/video only). Recruiters may publish.
  at.addGrant({
    room: room,
    roomJoin: true,
    canPublish: input.canPublish,
    canSubscribe: true,
    canPublishData: false,
  });

  return {
    token: await at.toJwt(),
    url: config.livekit.url,
    roomName: room,
    expiresIn: ttl,
  };
}

/** Canonical room name for an interview. Single source of truth for room naming. */
export function interviewRoomName(interviewId: string): string {
  return `interview-${String(interviewId).replace(/[^a-zA-Z0-9_\-]/g, '')}`;
}