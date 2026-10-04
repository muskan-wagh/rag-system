import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getRedisClient, isRedisAvailable } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import { verifyCandidateSession, parseCookies } from '@/services/hiring/candidateSession';
import { getSupabaseClient } from '@/services/supabase/client';

const EVENTS_CHANNEL = 'app:events';

let wss: WebSocketServer | null = null;

interface RoomClient {
  ws: WebSocket;
  rooms: Set<string>;
}

const clients = new Set<RoomClient>();

function decodeClerkSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Authorize a WS room join for one interview.
 * - Candidate: `session` query (or hs_candidate cookie) validated via
 *   verifyCandidateSession; room is ALWAYS the session's own interview —
 *   a spoofed interviewId can never join another candidate's room.
 * - Recruiter: `role=recruiter` + Clerk JWT (`token`); ownership of the
 *   interview's candidate is verified in DB (same rule as REST).
 * Returns the authorized room name or null.
 */
async function authorizeInterviewRoom(params: URLSearchParams, cookieHeader: string | undefined): Promise<string | null> {
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
          return `interview:${inv.interview_id}`;
        }
      }
    } catch {
      return null;
    }
    return null;
  }
  if (params.get('role') === 'recruiter' && requestedId) {
    const clerkSub = decodeClerkSub(params.get('token') || '');
    if (!clerkSub) return null;
    try {
      const supabase = getSupabaseClient();
      const { data: recruiter } = await supabase.from('recruiters').select('id').eq('clerk_id', clerkSub).maybeSingle();
      if (!recruiter) return null;
      const { data: interview } = await supabase.from('interviews').select('candidate_id').eq('id', requestedId).maybeSingle();
      if (!interview) return null;
      const { data: cand } = await supabase
        .from('candidates')
        .select('id')
        .eq('id', (interview as { candidate_id: string }).candidate_id)
        .eq('recruiter_id', (recruiter as { id: string }).id)
        .maybeSingle();
      if (!cand) return null;
      return `interview:${requestedId}`;
    } catch {
      return null;
    }
  }
  return null;
}

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const client: RoomClient = { ws, rooms: new Set() };
    clients.add(client);
    void (async () => {
      try {
        const url = new URL(req.url || '/ws', 'http://localhost');
        // Global listener (legacy dashboard events) needs no room.
        if (!url.searchParams.get('interviewId') && !url.searchParams.get('session')) return;
        const room = await authorizeInterviewRoom(url.searchParams, req.headers.cookie);
        if (!room) {
          ws.send(JSON.stringify({ event: 'ws:unauthorized', payload: {}, timestamp: new Date().toISOString() }));
          ws.close(4401, 'unauthorized');
          clients.delete(client);
          return;
        }
        client.rooms.add(room);
        ws.send(JSON.stringify({ event: 'ws:joined', payload: { room }, timestamp: new Date().toISOString() }));
      } catch (err) {
        logger.warn('WebSocket auth failed', { error: err instanceof Error ? err.message : String(err) });
        try { ws.close(4401, 'unauthorized'); } catch { /* noop */ }
        clients.delete(client);
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

function broadcastRaw(message: string): void {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
  // Room-tracked clients share the same underlying sockets; legacy global
  // fan-out stays intact for dashboard events.
}

export function broadcast(event: string, payload: Record<string, unknown>): void {
  const message = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  // Interview-scoped coding events go ONLY to room members.
  if (event === 'interview:coding') {
    const interviewId = String((payload as Record<string, unknown>).interviewId || '');
    if (interviewId) {
      broadcastToInterview(interviewId, event, payload);
      return;
    }
  }
  broadcastRaw(message);
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
