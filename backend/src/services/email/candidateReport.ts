/**
 * Candidate hiring-report email (candidate-safe PDF attached).
 * NEVER attach the internal recruiter report.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface CandidateReportEmailInput {
  candidateName: string;
  jobTitle?: string | null;
  resultMessage: string;
  summaryLines?: string[];
  reportId?: string;
}

/** Idempotency: candidate-report:{candidateId}:{jobId}:{decisionVersion} */
export function candidateReportEmailKey(candidateId: string, jobId: string | null, decisionVersion: number): string {
  const c = String(candidateId).replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
  const j = String(jobId || 'no-job').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 80);
  return `candidate-report:${c}:${j}:${Math.max(1, decisionVersion | 0)}`;
}

export function candidateReportSubject(hired: boolean): string {
  return hired ? 'Your HireStack Hiring Result — Offer Next Steps' : 'Your HireStack Hiring Report';
}

export function buildCandidateReportEmail(input: CandidateReportEmailInput): string {
  const summary = (input.summaryLines || [])
    .map((l) => `<li style="font-size: 14px; line-height: 1.6; color: #374151;">${escapeHtml(l)}</li>`)
    .join('');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear ${escapeHtml(input.candidateName)},</p>
      <p style="font-size: 16px; line-height: 1.6; color: #374151;">${escapeHtml(input.resultMessage)}</p>
      ${input.jobTitle ? `<p style="font-size: 15px; color: #374151;">Role: <strong>${escapeHtml(input.jobTitle)}</strong></p>` : ''}
      ${summary ? `<ul style="padding-left: 20px; margin: 16px 0;">${summary}</ul>` : ''}
      <p style="font-size: 14px; color: #374151;">Your candidate-safe hiring report is attached as a PDF. It contains only information visible to you — no internal notes or confidential details.</p>
      ${input.reportId ? `<p style="font-size: 12px; color: #6B7280;">Report ID: ${escapeHtml(input.reportId)}</p>` : ''}
      <p style="font-size: 16px; color: #374151;">Best regards,<br/>HireStack Talent Team</p>
    </div>
  `;
}
