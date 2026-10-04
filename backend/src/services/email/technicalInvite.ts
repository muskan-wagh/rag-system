/**
 * Technical interview invitation email (Resend only).
 * Reuses the existing email queue/worker — no new provider.
 * Supports scheduled / rescheduled / cancelled variants.
 */

export interface TechnicalInviteEmailInput {
  candidateName: string;
  interviewLink: string;
  interviewerName?: string | null;
  scheduledAt?: string | null;
  jobTitle?: string | null;
  meetingLink?: string | null;
}

export type TechnicalInterviewEvent = 'scheduled' | 'rescheduled' | 'cancelled';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function technicalInviteSubject(): string {
  return 'Technical Interview Invitation — HireStack';
}

export function technicalInterviewSubject(event: TechnicalInterviewEvent): string {
  if (event === 'rescheduled') return 'Technical Interview Rescheduled — HireStack';
  if (event === 'cancelled') return 'Technical Interview Cancelled — HireStack';
  return technicalInviteSubject();
}

/** Stable idempotency key: technical-interview:{interviewId}:{event}:{version} */
export function technicalInterviewEmailKey(interviewId: string, event: TechnicalInterviewEvent, version: number): string {
  const safe = String(interviewId).replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 100);
  return `technical-interview:${safe}:${event}:${Math.max(1, version | 0)}`;
}

export function buildTechnicalInviteEmail(input: TechnicalInviteEmailInput): string {
  return buildTechnicalInterviewEmail({ ...input, event: 'scheduled' });
}

export function buildTechnicalInterviewEmail(
  input: TechnicalInviteEmailInput & { event?: TechnicalInterviewEvent },
): string {
  const event = input.event || 'scheduled';
  const heading =
    event === 'rescheduled'
      ? 'Your <strong>Technical Interview</strong> has been rescheduled. Updated details below.'
      : event === 'cancelled'
        ? 'Your <strong>Technical Interview</strong> has been cancelled. Your recruiter will follow up with next steps.'
        : 'Congratulations — you qualified in the assessment. You are invited to the <strong>Technical Interview</strong> round.';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${escapeHtml(input.candidateName)},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">${heading}</p>
      ${input.jobTitle ? `<p style="font-size: 15px; color: #374151;">Role: <strong>${escapeHtml(input.jobTitle)}</strong></p>` : ''}
      ${input.interviewerName ? `<p style="font-size: 15px; color: #374151;">Interviewer: <strong>${escapeHtml(input.interviewerName)}</strong></p>` : ''}
      ${input.scheduledAt ? `<p style="font-size: 15px; color: #374151;">Scheduled: <strong>${escapeHtml(input.scheduledAt)}</strong></p>` : ''}
      ${input.meetingLink ? `<p style="font-size: 15px; color: #374151;">Meeting link: <a href="${escapeHtml(input.meetingLink)}" style="color: #1F4770;">${escapeHtml(input.meetingLink)}</a></p>` : ''}
      ${event === 'cancelled' ? '' : `
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Join using your secure link (unique to you — do not share it):</p>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(input.interviewLink)}" style="display: inline-block; background: #1F4770; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600;">Join Technical Interview</a>
      </p>
      <p style="font-size: 13px; color: #6B7280; word-break: break-all;">${escapeHtml(input.interviewLink)}</p>
      <p style="font-size: 14px; color: #374151;">You will meet a human interviewer, share a live coding environment, and discuss your experience. Keep this page open and join the meeting link at the scheduled time. Good luck!</p>
      `}
      <p style="font-size: 16px; color: #374151;">Best regards,<br/>HireStack Talent Team</p>
    </div>
  `;
}
