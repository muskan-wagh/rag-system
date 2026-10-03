import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the resend SDK so tests never hit the network (backend/.env may hold a
// real key). This verifies our refactor preserved the Resend code path.
const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { sendEmail, sendEmailByProvider } from '@/services/email';

describe('Resend regression', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('Resend path still sends (mocked SDK, no network)', async () => {
    mockSend.mockResolvedValue({ data: { id: 're_123' }, error: null });
    const res = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>hi</p>' });
    expect(mockSend).toHaveBeenCalledOnce();
    expect(res.success).toBe(true);
  });

  it('dispatcher resend path preserves behavior + surfaces SDK errors', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await sendEmailByProvider('resend', {
      to: 'a@example.com', subject: 's', html: '<p>hi</p>',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('boom');
  });

  it('gmail path requires recruiterId (never falls back to another recruiter)', async () => {
    const res = await sendEmailByProvider('gmail', {
      to: 'a@example.com', subject: 's', html: '<p>hi</p>',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/recruiterId/i);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('gmail failure does not break resend (independent providers)', async () => {
    const gmailRes = await sendEmailByProvider('gmail', {
      to: 'a@example.com', subject: 's', html: '<p>hi</p>',
    });
    expect(gmailRes.success).toBe(false);
    mockSend.mockResolvedValue({ data: { id: 're_456' }, error: null });
    const resendRes = await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>hi</p>' });
    expect(resendRes.success).toBe(true);
  });
});
