import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '@/middleware/errorHandler';

vi.mock('@/services/supabase/database', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    getCandidateInterviews: vi.fn(),
    logEmail: vi.fn(),
  };
});

vi.mock('@/services/queue/emailQueue', () => ({
  enqueueEmail: vi.fn(),
}));

vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(),
}));

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: vi.fn(),
}));

import { sendInterviewEmailHandler } from '@/controllers/candidateController';
import * as database from '@/services/supabase/database';
import * as emailQueue from '@/services/queue/emailQueue';
import * as supabaseClient from '@/services/supabase/client';

const mockedDb = vi.mocked(database);
const mockedQueue = vi.mocked(emailQueue);
const mockedClient = vi.mocked(supabaseClient);

const INTERVIEW = {
  id: 'int-1',
  scheduled_date: '2026-10-01',
  scheduled_time: '10:00',
  interview_type: 'google_meet',
  meeting_link: 'https://meet.example/abc',
};

function mockCandidateEmail(email: string | null) {
  mockedClient.getSupabaseClient.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: email ? { email } : null }),
        }),
      }),
    }),
  } as never);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-1' };
    next();
  });
  app.post('/c/:id/send-email', sendInterviewEmailHandler);
  app.use(errorHandler);
  return app;
}

describe('POST /candidates/:id/send-email (Resend delivery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockedDb.getCandidateInterviews as ReturnType<typeof vi.fn>).mockResolvedValue([INTERVIEW]);
  });

  it('enqueues the email via Resend and keeps the response shape', async () => {
    mockCandidateEmail('candidate@example.com');
    const app = makeApp();
    const res = await request(app)
      .post('/c/cand-1/send-email')
      .send({ subject: 'Interview Confirmation', body: 'See you soon' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subject).toBe('Interview Confirmation');
    expect(res.body.data.body).toBe('See you soon');
    expect(mockedQueue.enqueueEmail).toHaveBeenCalledOnce();
    expect(mockedQueue.enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'candidate@example.com',
        subject: 'Interview Confirmation',
      }),
    );
    const html = (mockedQueue.enqueueEmail.mock.calls[0][0] as { html: string }).html;
    expect(html).toContain('See you soon');
  });

  it('still responds 200 without enqueue when the candidate has no email (backward compat)', async () => {
    mockCandidateEmail(null);
    const app = makeApp();
    const res = await request(app).post('/c/cand-1/send-email').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockedQueue.enqueueEmail).not.toHaveBeenCalled();
  });

  it('404s when no interview exists (unchanged behavior)', async () => {
    (mockedDb.getCandidateInterviews as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    mockCandidateEmail('candidate@example.com');
    const app = makeApp();
    const res = await request(app).post('/c/cand-1/send-email').send({});
    expect(res.status).toBe(404);
    expect(mockedQueue.enqueueEmail).not.toHaveBeenCalled();
  });
});
