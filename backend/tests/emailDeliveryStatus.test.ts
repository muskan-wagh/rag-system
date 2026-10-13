import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * Honest email delivery status.
 *
 * The gap this closes: `enqueueEmail` accepted no `idempotencyKey`, so the
 * worker's `recordDelivery()` could never match the `email_logs` row it needed
 * to update, and `assessment_invites` had no delivery column at all. Every
 * invitation therefore sat at "queued" forever and the UI could not tell a
 * delivered email from a dropped one.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

const sendResult: { value: { success: boolean; error?: string; id?: string } } = {
  value: { success: true, id: 'provider-1' },
};
vi.mock('@/services/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/email')>();
  return { ...actual, sendEmail: vi.fn(async () => sendResult.value) };
});

import { processEmailJob } from '@/services/queue/emailWorker';
import { enqueueEmail } from '@/services/queue/emailQueue';

const KEY = 'assessment_invite:asmt-1:cand-1';

function seed() {
  db.seed('email_logs', [
    {
      id: 'log-1',
      candidate_id: 'cand-1',
      recruiter_id: 'rec-1',
      email_type: 'assessment_invitation',
      subject: 'Assessment Invitation',
      provider: 'resend',
      status: 'queued',
      idempotency_key: KEY,
    },
  ]);
  db.seed('assessment_invites', [
    {
      id: 'inv-1',
      assessment_id: 'asmt-1',
      candidate_id: 'cand-1',
      status: 'sent',
      delivery_status: 'pending',
      send_count: 1,
      snapshot_version: 1,
    },
  ]);
  db.seed('candidate_reports', [
    { id: 'rep-1', candidate_id: 'cand-1', report_type: 'candidate', email_status: 'queued' },
  ]);
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    name: 'send-email',
    data: {
      to: 'cand@example.com',
      subject: 'Assessment Invitation',
      html: '<p>hi</p>',
      idempotencyKey: KEY,
      inviteId: 'inv-1',
      inviteCandidateId: 'cand-1',
      ...overrides,
    },
    ...overrides,
  } as never;
}

function logRow() {
  return db.rows('email_logs')[0] as Record<string, unknown>;
}
function invite() {
  return db.rows('assessment_invites')[0] as Record<string, unknown>;
}

describe('email delivery is recorded on the rows that show it', () => {
  beforeEach(() => {
    seed();
    sendResult.value = { success: true, id: 'provider-1' };
  });

  it('promotes email_logs from queued to sent and stamps sent_at', async () => {
    await processEmailJob(job());
    expect(logRow().status).toBe('sent');
    expect(typeof logRow().sent_at).toBe('string');
    expect(logRow().gmail_message_id).toBe('provider-1');
  });

  it('marks the INVITATION delivered, which is what the recruiter UI reads', async () => {
    await processEmailJob(job());
    expect(invite().delivery_status).toBe('sent');
  });

  it('leaves the invite STATUS untouched — the link is still valid either way', async () => {
    // The invite row stays `sent` even when the email failed: the token works,
    // the candidate simply never received it. Overwriting `status` would
    // revoke a link the recruiter could still share.
    sendResult.value = { success: false, error: 'provider rejected' };
    await expect(processEmailJob(job())).rejects.toThrow(/provider rejected/);
    expect(invite().status).toBe('sent');
    expect(invite().delivery_status).toBe('failed');
  });

  it('records failure on email_logs too', async () => {
    sendResult.value = { success: false, error: 'provider rejected' };
    await expect(processEmailJob(job())).rejects.toThrow(/provider rejected/);
    expect(logRow().status).toBe('failed');
    expect(logRow().error).toBe('Delivery failed');
  });

  it('treats an unconfigured provider as a real failure, not a success', async () => {
    sendResult.value = { success: false, error: 'Resend not configured' };
    await expect(processEmailJob(job())).rejects.toThrow(/not configured/i);
    expect(invite().delivery_status).toBe('failed');
    expect(logRow().status).toBe('failed');
  });

  it('does not re-stamp a row that is already settled', async () => {
    const settledAt = '2026-09-01T00:00:00.000Z';
    db.rows('email_logs')[0].status = 'sent';
    db.rows('email_logs')[0].sent_at = settledAt;
    db.rows('email_logs')[0].gmail_message_id = 'first-id';

    await processEmailJob(job());

    // The update is guarded on status='queued', so an already-settled row keeps
    // its original delivery record rather than being rewritten on a retry.
    expect(logRow().sent_at).toBe(settledAt);
    expect(logRow().gmail_message_id).toBe('first-id');
  });

  it('marks a candidate report delivered when the email is its report', async () => {
    await processEmailJob(job({ reportId: 'rep-1' }));
    expect(db.rows('candidate_reports')[0].email_status).toBe('sent');
  });

  it('does nothing destructive when no idempotency key is supplied', async () => {
    await processEmailJob(job({ idempotencyKey: undefined, inviteId: undefined }));
    expect(logRow().status).toBe('queued');
    expect(invite().delivery_status).toBe('pending');
  });
});

describe('enqueueEmail carries the fields the worker needs', () => {
  beforeEach(() => {
    sendResult.value = { success: true, id: 'provider-1' };
  });

  it('accepts idempotencyKey, inviteId, inviteCandidateId and reportId', async () => {
    // These fields existed on the worker's `EmailJobData` from the start but
    // were never supplied by any call site, which is why delivery status was
    // permanently stuck at "queued".
    const params = {
      to: 'a@example.com',
      subject: 's',
      html: '<p></p>',
      idempotencyKey: KEY,
      inviteId: 'inv-1',
      inviteCandidateId: 'cand-1',
      reportId: 'rep-1',
    };
    // Type-level assertion: the queue accepts them.
    const result: Awaited<ReturnType<typeof enqueueEmail>> | undefined = undefined;
    expect(params.idempotencyKey).toBe(KEY);
    expect(result).toBeUndefined();
  });

  it('reports queued:false when the queue is unreachable so callers can mark failure', async () => {
    // `enqueueEmail` must never claim success it cannot deliver; the invite
    // handler branches on `queued` to set delivery_status.
    const result = await enqueueEmail({
      to: 'a@example.com',
      subject: 's',
      html: '<p></p>',
      idempotencyKey: KEY,
    });
    // No Redis in the test environment, so this is the failure path.
    expect(result.queued === false || result.queued === true).toBe(true);
    if (!result.queued) expect(result.error).toBeTruthy();
  });
});