/**
 * Assessment invitation email (Resend only).
 * New module — existing email/index.ts and Gmail code are untouched.
 * The controller enqueues this HTML via the existing email queue/worker.
 */

export interface AssessmentInviteEmailInput {
  candidateName: string;
  assessmentName: string;
  durationMinutes: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
  instructions?: string | null;
  assessmentLink: string;
}

function formatWindowEdge(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function assessmentInviteSubject(assessmentName: string): string {
  return `Assessment Invitation: ${assessmentName}`;
}

export function buildAssessmentInviteEmail(input: AssessmentInviteEmailInput): string {
  const instructions = (input.instructions || '').trim();
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${escapeHtml(input.candidateName)},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        You have been invited to complete the assessment
        <strong>${escapeHtml(input.assessmentName)}</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Assessment</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(input.assessmentName)}</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Duration</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${input.durationMinutes} minutes</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Available from</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(formatWindowEdge(input.availableFrom))}</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Available until</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(formatWindowEdge(input.availableUntil))}</strong></td></tr>
      </table>
      ${instructions ? `<p style="font-size: 15px; line-height: 1.6; color: #374151;"><strong>Instructions:</strong></p><p style="font-size: 15px; line-height: 1.6; color: #374151; white-space: pre-line;">${escapeHtml(instructions)}</p>` : ''}
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Start your assessment using this secure link:</p>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(input.assessmentLink)}" style="display: inline-block; background: #1F4770; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600;">Start Assessment</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6B7280; word-break: break-all;">${escapeHtml(input.assessmentLink)}</p>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        How to take the test: click the link above (it is unique to you — do not share it),
        complete the assessment in one sitting within the duration shown, and make sure you
        start before the availability window closes. The link stops working after the window ends.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Best regards,<br/>HireStack Talent Team</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
