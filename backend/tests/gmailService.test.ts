import { describe, it, expect } from 'vitest';
import MailComposer from 'nodemailer/lib/mail-composer';
import { isValidEmail } from '@/services/gmail/send';
import { buildGmailIdempotencyKey } from '@/services/gmail/gmailEmailService';

describe('email validation', () => {
  it('accepts valid recipients', () => {
    expect(isValidEmail('recruiter@gmail.com')).toBe(true);
    expect(isValidEmail('  candidate+tag@example.co  ')).toBe(true);
  });

  it('rejects invalid recipients', () => {
    for (const bad of ['', 'not-an-email', 'a@b', 'a@b c.com', '@x.com']) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe('event-specific idempotency keys', () => {
  const base = { recruiterId: 'rec-1', emailType: 'gmail_outreach', candidateId: 'cand-1' };

  it('is stable for the same event', () => {
    const a = buildGmailIdempotencyKey({ ...base, eventId: 'evt-1' });
    const b = buildGmailIdempotencyKey({ ...base, eventId: 'evt-1' });
    expect(a).toBe(b);
  });

  it('differs across events even with identical content (legit repeats allowed)', () => {
    const a = buildGmailIdempotencyKey({ ...base, eventId: 'evt-1' });
    const b = buildGmailIdempotencyKey({ ...base, eventId: 'evt-2' });
    expect(a).not.toBe(b);
  });

  it('differs across recruiters/candidates (isolation)', () => {
    const a = buildGmailIdempotencyKey({ ...base, eventId: 'evt-1' });
    const otherRecruiter = buildGmailIdempotencyKey({ ...base, recruiterId: 'rec-2', eventId: 'evt-1' });
    const otherCandidate = buildGmailIdempotencyKey({ ...base, candidateId: 'cand-2', eventId: 'evt-1' });
    expect(a).not.toBe(otherRecruiter);
    expect(a).not.toBe(otherCandidate);
  });

  it('never embeds message content (no content-hash fallback)', () => {
    const key = buildGmailIdempotencyKey({ ...base, eventId: 'evt-1' });
    expect(key).not.toContain('subject');
    expect(key).not.toContain('hello');
  });
});

describe('multipart MIME (MailComposer)', () => {
  it('builds text+html multipart with Reply-To and UTF-8 subject', async () => {
    const subject = 'Opportunity — café ☕';
    const mail = new MailComposer({
      from: 'recruiter@gmail.com',
      to: 'candidate@example.com',
      subject,
      text: 'Hello — plain',
      html: '<p>Hello <b>HTML</b></p>',
      replyTo: 'reply@example.com',
    });
    const buf: Buffer = await mail.compile().build();
    const raw = buf.toString('utf-8');
    expect(raw).toContain('candidate@example.com');
    expect(raw).toContain('multipart/alternative');
    expect(raw).toContain('text/plain');
    expect(raw).toContain('text/html');
    expect(raw).toContain('Reply-To: reply@example.com');
    // Non-ASCII subject must be RFC 2047 encoded, not raw-concatenated.
    expect(raw).toContain('=?UTF-8?');
    expect(raw).not.toContain(subject);
    // Gmail API transport encoding round-trips.
    const transport = buf.toString('base64url');
    expect(Buffer.from(transport, 'base64url').toString('utf-8')).toBe(raw);
  });
});
