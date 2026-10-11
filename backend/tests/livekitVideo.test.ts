import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// LiveKit credentials are read from a mutable object so the service can be
// exercised both configured and unconfigured within one process.
const livekitEnv = vi.hoisted(() => ({ url: '', apiKey: '', apiSecret: '' }));

vi.mock('@/config', async (importOriginal) => {
  const actual = (await importOriginal()) as { config: Record<string, unknown> };
  return { config: { ...actual.config, livekit: livekitEnv } };
});

// Supabase + candidate session are stubbed. The LiveKit SDK runs for real, so
// assertions are made against a genuinely signed JWT.
const inviteQuery = {
  select: vi.fn(() => inviteQuery),
  eq: vi.fn(() => inviteQuery),
  maybeSingle: vi.fn(),
};
const candidateQuery = {
  select: vi.fn(() => candidateQuery),
  eq: vi.fn(() => candidateQuery),
  maybeSingle: vi.fn(),
};
const inviteResult: { current: { data: unknown; error: unknown } } = {
  current: { data: null, error: null },
};

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'interview_invites') return inviteQuery;
      if (table === 'candidates') return candidateQuery;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })) };
    },
  }),
}));

vi.mock('@/services/hiring/candidateSession', () => ({
  verifyCandidateSession: vi.fn(),
  parseCookies: vi.fn(() => ({})),
}));

import { createLiveKitToken, interviewRoomName, isLiveKitConfigured } from '@/services/livekit/service';
import { verifyCandidateSession } from '@/services/hiring/candidateSession';
import { postCandidateLivekitTokenHandler } from '@/controllers/interviewVideoController';
import { errorHandler } from '@/middleware/errorHandler';

const SECRET = 'super-secret-livekit-api-secret-value';

interface CandidateTokenBody {
  success: boolean;
  data?: { token: string; roomName: string; url: string; expiresIn: number };
  error?: string;
}

function decodeJwt(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    candidate_id: 'cand-1',
    invite_id: null,
    interview_invite_id: 'inv-1',
    scope: 'interview',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

async function invokeCandidateHandler(sessionHeader?: string) {
  const header = sessionHeader === undefined ? 'tok' : sessionHeader;
  const app = express();
  app.use(express.json());
  app.post('/candidate/interview/livekit-token', postCandidateLivekitTokenHandler);
  app.use(errorHandler);
  const req = request(app)
    .post('/candidate/interview/livekit-token')
    .send({});
  if (header) req.set('x-candidate-session', header);
  const res = await req;
  return { status: res.status, body: res.body as CandidateTokenBody };
}

describe('LiveKit configuration', () => {
  beforeEach(() => {
    livekitEnv.url = '';
    livekitEnv.apiKey = '';
    livekitEnv.apiSecret = '';
  });

  it('reports unconfigured and refuses to mint a token without credentials', async () => {
    expect(isLiveKitConfigured()).toBe(false);
    await expect(
      createLiveKitToken({ roomName: 'r', participantName: 'n', participantId: 'p', canPublish: false }),
    ).rejects.toThrow(/not configured/i);
  });
});

describe('LiveKit room naming', () => {
  it('derives a stable, URL-safe room from the interview id', () => {
    expect(interviewRoomName('abc-123')).toBe('interview-abc-123');
  });

  it('strips characters that could manipulate the room name', () => {
    // Traversal segments and separators must not survive into the room name.
    expect(interviewRoomName('../../other-room')).toBe('interview-other-room');
    expect(interviewRoomName('a b;c')).toBe('interview-abc');
    expect(interviewRoomName('a/b?c=d')).toBe('interview-abcd');
  });
});

describe('Candidate LiveKit token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    livekitEnv.url = 'wss://example.livekit.cloud';
    livekitEnv.apiKey = 'APIkey';
    livekitEnv.apiSecret = SECRET;
    inviteResult.current = { data: null, error: null };
    inviteQuery.maybeSingle.mockImplementation(() => Promise.resolve(inviteResult.current));
    candidateQuery.maybeSingle.mockResolvedValue({ data: { id: 'cand-1', full_name: 'Ada Lovelace' }, error: null });
  });

  it('mints a room-scoped token that never carries the API secret', async () => {
    inviteResult.current = {
      data: { id: 'inv-1', interview_id: 'int-1', candidate_id: 'cand-1', status: 'sent' },
      error: null,
    };
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(session());

    const res = await invokeCandidateHandler();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.roomName).toBe('interview-int-1');
    expect(res.body.data?.url).toBe('wss://example.livekit.cloud');
    // The API secret must never reach the browser.
    expect(JSON.stringify(res.body)).not.toContain(SECRET);

    const video = decodeJwt(res.body.data!.token).video as Record<string, unknown>;
    expect(video.roomJoin).toBe(true);
    expect(video.room).toBe('interview-int-1');
    // Candidates join as subscribers — the interviewer publishes.
    expect(video.canPublish).toBe(false);
  });

  it('refuses a revoked invitation and never returns a token', async () => {
    inviteResult.current = {
      data: { id: 'inv-1', interview_id: 'int-1', candidate_id: 'cand-1', status: 'revoked' },
      error: null,
    };
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(session());
    const res = await invokeCandidateHandler();
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('token');
  });

  it('refuses when the invite belongs to a different candidate', async () => {
    inviteResult.current = {
      data: { id: 'inv-1', interview_id: 'int-1', candidate_id: 'someone-else', status: 'sent' },
      error: null,
    };
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(session());
    const res = await invokeCandidateHandler();
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('token');
  });

  it('refuses an assessment-scoped session (wrong scope)', async () => {
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(
      session({ scope: 'assessment', interview_invite_id: null }),
    );
    const res = await invokeCandidateHandler();
    expect(res.status).toBe(401);
  });

  it('refuses an invalid session', async () => {
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await invokeCandidateHandler();
    expect(res.status).toBe(401);
  });

  it('refuses when no session cookie is presented at all', async () => {
    // No session header and no cookie: must be rejected before any DB work.
    const res = await invokeCandidateHandler('');
    expect(res.status).toBe(401);
    expect(verifyCandidateSession).not.toHaveBeenCalled();
  });

  it('clamps the TTL so a caller cannot request an unbounded token', async () => {
    inviteResult.current = {
      data: { id: 'inv-1', interview_id: 'int-1', candidate_id: 'cand-1', status: 'sent' },
      error: null,
    };
    (verifyCandidateSession as ReturnType<typeof vi.fn>).mockResolvedValue(session());
    const huge = await createLiveKitToken({
      roomName: interviewRoomName('int-1'),
      participantName: 'Ada',
      participantId: 'candidate:cand-1',
      canPublish: false,
      ttlSeconds: 60 * 60 * 24 * 365,
    });
    expect(huge.expiresIn).toBe(24 * 3600);
    expect(decodeJwt(huge.token).exp).toBeLessThan(Math.floor(Date.now() / 1000) + 24 * 3600 + 60);
  });
});