import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnrecoverableError, Job } from 'bullmq';
import type { EmailJobData } from '@/services/queue/emailWorker';

const { mockSendEmail } = vi.hoisted(() => ({ mockSendEmail: vi.fn() }));

vi.mock('@/services/email', () => ({
  sendEmail: mockSendEmail,
}));

import { processEmailJob } from '@/services/queue/emailWorker';

function job(data: Partial<EmailJobData>): Job<EmailJobData> {
  return { id: 'job-1', data: data as EmailJobData } as Job<EmailJobData>;
}

describe('processEmailJob (email-sending worker)', () => {
  beforeEach(() => {
    mockSendEmail.mockReset();
  });

  it('delivers via the existing Resend sendEmail service', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    await processEmailJob(job({ to: 'c@example.com', subject: 'Hi', html: '<p>Hi</p>' }));
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'c@example.com', subject: 'Hi', html: '<p>Hi</p>', from: undefined,
    });
  });

  it('passes a custom from address through untouched', async () => {
    mockSendEmail.mockResolvedValue({ success: true });
    await processEmailJob(job({ to: 'c@example.com', subject: 'Hi', html: '<p>Hi</p>', from: 'team@x.com' }));
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'team@x.com' }),
    );
  });

  it('fails fast (no retry) on invalid payload without calling Resend', async () => {
    await expect(processEmailJob(job({ to: '', subject: 'Hi', html: '<p>Hi</p>' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('throws retryable error on transient Resend failure (queue retries 3x)', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'socket hang up' });
    const err = await processEmailJob(job({ to: 'c@example.com', subject: 'Hi', html: '<p>Hi</p>' })).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(UnrecoverableError);
  });

  it('fails fast when Resend is not configured (retries would never help)', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'Resend not configured' });
    await expect(
      processEmailJob(job({ to: 'c@example.com', subject: 'Hi', html: '<p>Hi</p>' })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
