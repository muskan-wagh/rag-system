/**
 * Managerial/HR interview invitation email (Resend only).
 * Human-led round — no AI interviewer.
 */

export interface HrInviteEmailInput {
  candidateName: string;
  interviewLink: string;
  interviewerName?: string | null;
  scheduledAt?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function hrInviteSubject(): string {
  return 'Managerial / HR Interview Invitation — HireStack';
}

export function buildHrInviteEmail(input: HrInviteEmailInput): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${escapeHtml(input.candidateName)},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        Great news — you cleared the technical round. You are invited to the
        <strong>Managerial / HR Interview</strong>.
      </p>
      ${input.interviewerName ? `<p style="font-size: 15px; color: #374151;">Interviewer: <strong>${escapeHtml(input.interviewerName)}</strong></p>` : ''}
      ${input.scheduledAt ? `<p style="font-size: 15px; color: #374151;">Scheduled: <strong>${escapeHtml(input.scheduledAt)}</strong></p>` : ''}
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Join using your secure link (unique to you — do not share it):</p>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(input.interviewLink)}" style="display: inline-block; background: #1F4770; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600;">Join HR Interview</a>
      </p>
      <p style="font-size: 13px; color: #6B7280; word-break: break-all;">${escapeHtml(input.interviewLink)}</p>
      <p style="font-size: 14px; color: #374151;">This is a conversation about your goals, team fit, and next steps. Good luck!</p>
      <p style="font-size: 16px; color: #374151;">Best regards,<br/>HireStack Talent Team</p>
    </div>
  `;
}
