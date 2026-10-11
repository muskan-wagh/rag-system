import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getRedisClient, isRedisAvailable } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import { verifyCandidateSession, parseCookies } from '@/services/hiring/candidateSession';
import { getSupabaseClient } from '@/services/supabase/client';
import { verifyClerkToken } from '@/middleware/auth';

const EVENTS_CHANNEL = 'app:events';

let wss: WebSocketServer | null = null;

interface RoomClient {
  ws: WebSocket;
  rooms: Set<string>;
  /** Recruiter uuid when authenticated as a recruiter; null for candidate sockets. */
  recruiterId: string | null;
  /** True once the socket has passed an auth check of any kind. */
  authenticated: boolean;
}

const clients = new Set<RoomClient>();

/**
 * Authorize a WS room join for one interview.
 * - Candidate: `session` query (or hs_candidate cookie) validated via
 *   verifyCandidateSession; room is ALWAYS the session's own interview —
 *   a spoofed interviewId can never join another candidate's room.
 * - Recruiter: `role=recruiter` + Clerk JWT (`token`); the JWT SIGNATURE is
 *   verified before the recruiter lookup, and ownership of the interview's
 *   candidate is then checked in DB (same rule as REST).
 * Returns the authorized room name or null.
 */
async function authorizeInterviewRoom(
  params: URLSearchParams,
  cookieHeader: string | undefined,
): Promise<{ room: string | null; recruiterId: string | null }> {
  const requestedId = (params.get('interviewId') || '').trim();
  const sessionToken = (params.get('session') || '').trim() || parseCookies(cookieHeader).hs_candidate || '';
  if (sessionToken) {
    try {
      const session = await verifyCandidateSession(sessionToken);
      if (session && session.scope === 'interview' && session.interview_invite_id) {
        const supabase = getSupabaseClient();
        const { data: invite } = await supabase
          .from('interview_invites')
          .select('interview_id, status')
          .eq('id', session.interview_invite_id)
          .maybeSingle();
        const inv = invite as { interview_id: string; status: string } | null;
        if (inv && inv.status !== 'revoked') {
          // Bind to the SESSION's interview, not the client claim.
          return { room: `interview:${inv.interview_id}`, recruiterId: null };
        }
      }
    } catch {
      return { room: null, recruiterId: null };
    }
    return { room: null, recruiterId: null };
  }
  if (params.get('role') === 'recruiter' && requestedId) {
    // Signature-verified. An unsigned/forged token resolves to no clerk id.
    const verified = await verifyClerkToken(params.get('token') || '');
    if ('error' in verified) return { room: null, recruiterId: null };
    try {
      const supabase = getSupabaseClient();
      const { data: recruiter } = await supabase
        .from('recruiters')
        .select('id')
        .eq('clerk_id', verified.clerkId)
        .maybeSingle();
      if (!recruiter) return { room: null, recruiterId: null };
      const { data: interview } = await supabase
        .from('interviews')
        .select('candidate_id')
        .eq('id', requestedId)
        .maybeSingle();
      if (!interview) return { room: null, recruiterId: null };
      const { data: cand } = await supabase
        .from('candidates')
        .select('id')
        .eq('id', (interview as { candidate_id: string }).candidate_id)
        .eq('recruiter_id', (recruiter as { id: string }).id)
        .maybeSingle();
      if (!cand) return { room: null, recruiterId: null };
      return { room: `interview:${requestedId}`, recruiterId: (recruiter as { id: string }).id };
    } catch {
      return { room: null, recruiterId: null };
    }
  }
  return { room: null, recruiterId: null };
}

/**
 * Events that carry candidate/interview identifiers and must therefore be
 * delivered ONLY to the interview's own room. Broadcasting these globally
 * leaked interview ids and statuses across recruiters and tenants.
 */
const ROOM_SCOPED_EVENTS = new Set(['interview:updated', 'interview:scheduled', 'interview:cancelled']);
const ROOM_EVENT_KEY = 'interviewId';

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const client: RoomClient = { ws, rooms: new Set(), recruiterId: null, authenticated: false };
    clients.add(client);
    clientsBySocket.set(ws, client);
    void (async () => {
      try {
        const url = new URL(req.url || '/ws', 'http://localhost');
        const requestedId = (url.searchParams.get('interviewId') || '').trim();
        const sessionToken =
          (url.searchParams.get('session') || '').trim() || parseCookies(req.headers.cookie).hs_candidate || '';

        if (!requestedId && !sessionToken) {
          // No credentials of any kind. Previously this socket was left OPEN and
          // subscribed to every global broadcast. Reject it outright.
          rejectUnauthorized(ws, client);
          return;
        }

        const { room, recruiterId } = await authorizeInterviewRoom(url.searchParams, req.headers.cookie);
        if (!room) {
          rejectUnauthorized(ws, client);
          return;
        }
        client.rooms.add(room);
        client.recruiterId = recruiterId;
        client.authenticated = true;
        ws.send(JSON.stringify({ event: 'ws:joined', payload: { room }, timestamp: new Date().toISOString() }));
      } catch (err) {
        logger.warn('WebSocket auth failed', { error: err instanceof Error ? err.message : String(err) });
        rejectUnauthorized(ws, client);
      }
    })();

    // Client messages are NEVER trusted for writes — all mutations go
    // through REST (session/Clerk auth there). Only ping/pong here.
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ event: 'ws:pong', payload: {}, timestamp: new Date().toISOString() }));
        }
      } catch { /* ignore malformed */ }
    });

    const cleanup = () => {
      clients.delete(client);
      clientsBySocket.delete(ws);
    };
    ws.on('close', cleanup);
    ws.on('error', (err) => {
      logger.warn('WebSocket error', { error: err.message });
      cleanup();
    });
  });

  // Subscribe to Redis events and forward to WebSocket clients
  if (isRedisAvailable()) {
    const sub = getRedisClient()!.duplicate();
    sub.subscribe(EVENTS_CHANNEL, (err) => {
      if (err) {
        logger.warn('Failed to subscribe to events channel', { error: err.message });
      } else {
        logger.info('Subscribed to redis events channel');
      }
    });
    sub.on('message', (_channel, message) => {
      try {
        broadcastRaw(message);
      } catch {
        // ignore malformed messages
      }
    });
    sub.on('error', (err) => {
      logger.warn('Events subscriber error', { error: err.message });
    });
  }

  logger.info('WebSocket server initialized');
  return wss;
}

function rejectUnauthorized(ws: WebSocket, client: RoomClient): void {
  clients.delete(client);
  try {
    ws.send(JSON.stringify({ event: 'ws:unauthorized', payload: {}, timestamp: new Date().toISOString() }));
  } catch { /* socket already gone */ }
  try {
    ws.close(4401, 'unauthorized');
  } catch { /* socket already gone */ }
}

/**
 * Fan a message out to AUTHENTICATED sockets only.
 * Unauthenticated sockets are closed on connect, but this guard keeps the
 * invariant enforced at send time as well.
 */
function broadcastRaw(message: string): void {
  if (!wss) return;
  wss.clients.forEach((socket) => {
    const client = clientsBySocket.get(socket);
    if (!client || !client.authenticated) return;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

/** Reverse index so broadcastRaw can check the auth flag without a socket scan. */
const clientsBySocket = new Map<WebSocket, RoomClient>();

export function broadcast(event: string, payload: Record<string, unknown>): void {
  // Interview-scoped coding events go ONLY to room members.
  if (event === 'interview:coding') {
    const interviewId = String((payload as Record<string, unknown>).interviewId || '');
    if (interviewId) {
      broadcastToInterview(interviewId, event, payload);
      return;
    }
  }
  // Interview lifecycle events also carry an interviewId — never global.
  if (ROOM_SCOPED_EVENTS.has(event)) {
    const interviewId = String((payload as Record<string, unknown>)[ROOM_EVENT_KEY] || '');
    if (interviewId) {
      broadcastToInterview(interviewId, event, payload);
      return;
    }
    // Missing interviewId: drop rather than leak a global copy.
    return;
  }
  broadcastRaw(JSON.stringify({ event, payload, timestamp: new Date().toISOString() }));
}

/** Room-scoped broadcast — server is the source of truth; no client write path. */
export function broadcastToInterview(interviewId: string, event: string, payload: Record<string, unknown>): void {
  const room = `interview:${interviewId}`;
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.rooms.has(room) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch { /* ignore dead sockets */ }
    }
  }
}
