import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Supabase is fully mocked; per-test rows are driven through hoisted state.
const supabaseState = vi.hoisted(() => ({ ctx: {} as Record<string, Record<string, unknown>> }));

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(() => {
    const resolveSingle = (table: string): Record<string, unknown> | null => {
      if (table === 'interview_invites') return supabaseState.ctx.invite ?? null;
      if (table === 'interviews') return supabaseState.ctx.interview ?? null;
      if (table === 'candidates') return supabaseState.ctx.candidate ?? null;
      return null;
    };
    const chainFor = (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: resolveSingle(table) }),
        single: async () => ({ data: resolveSingle(table), error: null }),
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
      return chain;
    };
    return { from: (table: string) => chainFor(table) };
  }),
}));

const LIVEKIT_ENV = {
  LIVEKIT_URL: 'https://video.example.test',
  LIVEKIT_API_KEY: 'test-api-key',
  LIVEKIT_API_SECRET: 'test-api-secret-that-must-never-leak',
};

interface LoadedModules {
  svc: typeof import('@/services/livekit/service');
  ctrl: typeof import('@/controllers/interviewVideoController');
  // Error middleware from the SAME module registry so `instanceof AppError`
  // keeps working after vi.resetModules().
  errorHandler: (err: Error, req: never, res: never, next: never) => void;
}

async function loadModules(): Promise<LoadedModules> {
  vi.resetModules();
  Object.assign(process.env, LIVEKIT_ENV);
  const svc = await import('@/services/livekit/service');
  const ctrl = await import('@/controllers/interviewVideoController');
  const { errorHandler } = await import('@/middleware/errorHandler');
  return { svc, ctrl, errorHandler: errorHandler as never };
}

async function loadUnconfigured(): Promise<LoadedModules> {
  vi.resetModules();
  // NB: config reloads backend/.env via dotenv on every import, so blanking
  // (not deleting) is required to simulate "credentials absent".
  process.env.LIVEKIT_URL = '';
  process.env.LIVEKIT_API_KEY = '';
  process.env.LIVEKIT_API_SECRET = '';
  const svc = await import('@/services/livekit/service');
  const ctrl = await import('@/controllers/interviewVideoController');
  const { errorHandler } = await import('@/middleware/errorHandler');
  return { svc, ctrl, errorHandler: errorHandler as never };
}

function candidateApp(
  mods: LoadedModules,
  handler: (req: never, res: never, next: never) => unknown,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { candidate: unknown }).candidate = {
      candidateId: 'cand-1',
      interviewInviteId: 'inv-1',
      scope: 'interview',
      sessionId: 'sess-1',
    };
    next();
  });
  app.post('/t', handler as never);
  app.use(mods.errorHandler as never);
  return app;
}

function recruiterApp(
  mods: LoadedModules,
  handler: (req: never, res: never, next: never) => unknown,
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-1' };
    next();
  });
  app.post('/t/:interviewId', handler as never);
  app.use(mods.errorHandler as never);
  return app;
}

const RECRUITER_PATH = '/t/int-1';

const LIVE_INVITE = {
  id: 'inv-1',
  interview_id: 'int-1',
  candidate_id: 'cand-1',
  status: 'sent',
  expires_at: null,
};

describe('livekit service (video layer only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('room names are deterministic per interview and sanitized', async () => {
    const { svc } = await loadModules();
    expect(svc.livekitRoomName('int-1')).toBe(svc.livekitRoomName('int-1'));
    expect(svc.livekitRoomName('int-1')).not.toBe(svc.livekitRoomName('int-2'));
    expect(svc.livekitRoomName('../../evil room!!')).toMatch(/^hs-interview-[a-z0-9]+$/);
  });

  it('minted JWT is scoped to one room with a short TTL and exposes no secret', async () => {
    const { svc } = await loadModules();
    const minted = await svc.mintLivekitToken({
      interviewId: 'int-1',
      role: 'candidate',
      subjectId: 'cand-1',
      displayName: 'Ada',
    });
    expect(minted.room).toBe(svc.livekitRoomName('int-1'));
    expect(minted.url).toBe(LIVEKIT_ENV.LIVEKIT_URL);
    const payload = JSON.parse(Buffer.from(minted.token.split('.')[1], 'base64url').toString('utf-8')) as {
      sub: string;
      exp: number;
      nbf: number;
      video: { room: string; roomJoin: boolean };
    };
    expect(payload.sub).toContain('cand-1');
    expect(payload.video.room).toBe(minted.room);
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.exp - payload.nbf).toBe(2 * 60 * 60);
    expect(JSON.stringify(minted)).not.toContain(LIVEKIT_ENV.LIVEKIT_API_SECRET);
  });

  it('minting without credentials fails closed (callers map to videoEnabled:false)', async () => {
    const { svc } = await loadUnconfigured();
    expect(svc.isLivekitConfigured()).toBe(false);
    await expect(
      svc.mintLivekitToken({ interviewId: 'int-1', role: 'candidate', subjectId: 'c', displayName: 'C' }),
    ).rejects.toThrow('not configured');
  });
});

describe('POST /candidate/interview/livekit-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.ctx = {
      invite: { ...LIVE_INVITE },
      interview: { id: 'int-1', status: 'joined' },
      candidate: { full_name: 'Ada Lovelace' },
    };
  });

  it('valid candidate receives a scoped token and the secret never appears', async () => {
    const mods = await loadModules();
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(res.status).toBe(200);
    expect(res.body.data.videoEnabled).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.url).toBe(LIVEKIT_ENV.LIVEKIT_URL);
    expect(res.body.data.room).toMatch(/^hs-interview-/);
    expect(JSON.stringify(res.body)).not.toContain(LIVEKIT_ENV.LIVEKIT_API_SECRET);
    expect(JSON.stringify(res.body)).not.toContain('apiSecret');
  });

  it('wrong candidate (session/invite mismatch) is rejected without a token', async () => {
    const mods = await loadModules();
    supabaseState.ctx.invite = { ...LIVE_INVITE, candidate_id: 'cand-OTHER' };
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(res.status).toBe(403);
    expect(res.body.data?.token).toBeUndefined();
  });

  it.each(['cancelled', 'completed', 'no_show'])('interview status %s is rejected', async (status) => {
    const mods = await loadModules();
    supabaseState.ctx.interview = { id: 'int-1', status };
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(res.status).toBe(410);
    expect(res.body.data?.token).toBeUndefined();
  });

  it('expired and revoked invites are rejected', async () => {
    const mods = await loadModules();
    supabaseState.ctx.invite = { ...LIVE_INVITE, expires_at: new Date(Date.now() - 1000).toISOString() };
    const expired = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(expired.status).toBe(410);

    supabaseState.ctx.invite = { ...LIVE_INVITE, status: 'revoked' };
    const revoked = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(revoked.status).toBe(410);
  });

  it('no LiveKit credentials → safe fallback, nothing breaks', async () => {
    const mods = await loadUnconfigured();
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateLivekitTokenHandler)).post('/t').send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ videoEnabled: false });
  });
});

describe('POST /candidate/interview/video-event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.ctx = {
      invite: { ...LIVE_INVITE },
      interview: { id: 'int-1', status: 'in_progress', video_signals: [] },
      candidate: { full_name: 'Ada' },
    };
  });

  it('records observable camera/mic signals without verdicts', async () => {
    const mods = await loadModules();
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateVideoEventHandler))
      .post('/t')
      .send({ type: 'camera_disabled' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ logged: true });
  });

  it('rejects unknown event types', async () => {
    const mods = await loadModules();
    const res = await request(candidateApp(mods, mods.ctrl.postCandidateVideoEventHandler))
      .post('/t')
      .send({ type: 'cheating_detected' });
    expect(res.status).toBe(400);
  });
});

describe('POST /interviews/:interviewId/livekit-token (recruiter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.ctx = {
      interview: { id: 'int-1', candidate_id: 'cand-1', status: 'scheduled', interviewer_name: 'Jane' },
      candidate: { recruiter_id: 'rec-1' },
    };
  });

  it('owning recruiter receives a token scoped to the interview room', async () => {
    const mods = await loadModules();
    const res = await request(recruiterApp(mods, mods.ctrl.postRecruiterLivekitTokenHandler)).post(RECRUITER_PATH).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.videoEnabled).toBe(true);
    expect(res.body.data.room).toMatch(/^hs-interview-/);
    expect(JSON.stringify(res.body)).not.toContain(LIVEKIT_ENV.LIVEKIT_API_SECRET);
  });

  it('wrong recruiter (ownership mismatch) gets 404 without a token', async () => {
    const mods = await loadModules();
    supabaseState.ctx.candidate = { recruiter_id: 'rec-OTHER' };
    const res = await request(recruiterApp(mods, mods.ctrl.postRecruiterLivekitTokenHandler)).post(RECRUITER_PATH).send({});
    expect(res.status).toBe(404);
    expect(res.body.data?.token).toBeUndefined();
  });

  it('cancelled interviews are rejected and unconfigured backends fall back safely', async () => {
    const mods = await loadModules();
    supabaseState.ctx.interview = {
      id: 'int-1',
      candidate_id: 'cand-1',
      status: 'cancelled',
      interviewer_name: 'Jane',
    };
    const cancelled = await request(recruiterApp(mods, mods.ctrl.postRecruiterLivekitTokenHandler)).post(RECRUITER_PATH).send({});
    expect(cancelled.status).toBe(410);

    supabaseState.ctx.interview = {
      id: 'int-1',
      candidate_id: 'cand-1',
      status: 'scheduled',
      interviewer_name: 'Jane',
    };
    const unconfigured = await loadUnconfigured();
    const fallback = await request(recruiterApp(unconfigured, unconfigured.ctrl.postRecruiterLivekitTokenHandler)).post(RECRUITER_PATH).send({});
    expect(fallback.status).toBe(200);
    expect(fallback.body.data).toEqual({ videoEnabled: false });
  });
});
