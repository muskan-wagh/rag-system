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
  /** Role the assessment is for. Rendered so the email is not context-free. */
  jobTitle?: string | null;
  /** Recruiter's company / product name. */
  companyName?: string | null;
  /** Published question-set version this link is pinned to. */
  version?: number | null;
  /** Support address shown to the candidate, when the recruiter configured one. */
  supportEmail?: string | null;
  /** IANA timezone label for the deadline, e.g. "Asia/Kolkata". */
  timezone?: string | null;
}

/**
 * Renders an instant WITH its timezone label.
 *
 * The previous version used `toLocaleString()` with no `timeZone`, which renders
 * in the SERVER's locale. A candidate in another country would get a deadline
 * that is silently wrong by hours. Every displayed instant now carries an
 * explicit offset, and the timezone is stated by name where one is configured.
 */
function formatWindowEdge(value: string | null | undefined, timeZone?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions = timeZone
    ? { timeZone, timeZoneName: 'short' }
    : { timeZoneName: 'short' };

  const formatted = date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
  return formatted;
}

export function assessmentInviteSubject(
  assessmentName: string,
  jobTitle?: string | null,
): string {
  const role = (jobTitle || '').trim();
  return role
    ? `Assessment Invitation: ${role} — ${assessmentName}`
    : `Assessment Invitation: ${assessmentName}`;
}

export function buildAssessmentInviteEmail(input: AssessmentInviteEmailInput): string {
  const instructions = (input.instructions || '').trim();
  const jobTitle = (input.jobTitle || '').trim();
  const company = (input.companyName || '').trim() || 'HireStack';
  const support = (input.supportEmail || '').trim();
  const tz = (input.timezone || '').trim() || undefined;

  const roleRow = jobTitle
    ? `<tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Role</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(jobTitle)}</strong></td></tr>`
    : '';

  const versionRow =
    input.version != null && input.version > 0
      ? `<tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Assessment version</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;">v${input.version}</td></tr>`
      : '';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${escapeHtml(input.candidateName)},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">
        You have been invited${
          jobTitle ? ` to complete an assessment for the <strong>${escapeHtml(jobTitle)}</strong> role` : ' to complete an assessment'
        } at <strong>${escapeHtml(company)}</strong>:
        <strong>${escapeHtml(input.assessmentName)}</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        ${roleRow}
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Assessment</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(input.assessmentName)}</strong></td></tr>
        ${versionRow}
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Time limit</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${input.durationMinutes} minutes</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Opens</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(formatWindowEdge(input.availableFrom, tz))}</strong></td></tr>
        <tr><td style="padding: 8px 12px; color: #6B7280; font-size: 14px;">Deadline</td><td style="padding: 8px 12px; font-size: 14px; color: #111111;"><strong>${escapeHtml(formatWindowEdge(input.availableUntil, tz))}</strong></td></tr>
      </table>
      ${
        tz
          ? `<p style="font-size: 12px; line-height: 1.5; color: #6B7280; margin: -12px 0 20px;">Times shown in ${escapeHtml(tz)}.</p>`
          : ''
      }
      ${
        instructions
          ? `<p style="font-size: 15px; line-height: 1.6; color: #374151;"><strong>Instructions:</strong></p><p style="font-size: 15px; line-height: 1.6; color: #374151; white-space: pre-line;">${escapeHtml(instructions)}</p>`
          : ''
      }
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Start your assessment using this secure link:</p>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(input.assessmentLink)}" style="display: inline-block; background: #1F4770; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600;">Start Assessment</a>
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6B7280; word-break: break-all;">${escapeHtml(input.assessmentLink)}</p>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">
        How to take the test: click the link above (it is unique to you — do not share it),
        complete the assessment in one sitting within the duration shown, and make sure you
        start before the deadline. The link stops working after the window ends.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #374151;">Best regards,<br/>${escapeHtml(company)} Talent Team</p>
      ${
        support
          ? `<p style="font-size: 13px; line-height: 1.6; color: #6B7280;">Questions? Reply to this email or contact <a href="mailto:${escapeHtml(support)}" style="color: #1F4770;">${escapeHtml(support)}</a>.</p>`
          : ''
      }
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