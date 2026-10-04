import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { buildInternalReport } from '@/services/reports/buildReport';
import { toCandidateSafeReport, assertCandidateSafe } from '@/services/reports/filterCandidateSafe';
import { generateReportPdf } from '@/services/reports/generatePdf';
import { uploadReportPdf, downloadReportPdf, reportStoragePath } from '@/services/reports/storage';
import { enqueueReportJob } from '@/services/queue/reportQueue';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { buildCandidateReportEmail, candidateReportEmailKey, candidateReportSubject } from '@/services/email/candidateReport';
import { logEmail } from '@/services/supabase/database';

async function requireOwnedCandidate(recruiterId: string, candidateId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('candidates').select('id, recruiter_id').eq('id', candidateId).maybeSingle();
  if (!data || (data as { recruiter_id: string }).recruiter_id !== recruiterId) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }
}

function candidateIdOf(req: Request): string {
  return String((req.params as Record<string, unknown>).candidateId || (req.params as Record<string, unknown>).id || '');
}

// GET /candidates/:candidateId/reports — recruiter list (metadata only, no payload dump by default).
export const listReportsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('candidate_reports')
    .select('id, candidate_id, job_id, report_type, version, generated_at, generated_by, email_sent_at, email_status, email_error, created_at')
    .eq('candidate_id', candidateId)
    .order('version', { ascending: false });
  res.json({ success: true, data: data || [] });
});

// POST /candidates/:candidateId/reports/generate { reportType, sendEmail? }
export const generateReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const reportType = String(req.body?.reportType || 'candidate');
  if (!['internal', 'candidate'].includes(reportType)) {
    throw new AppError('Invalid reportType', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const jobId = (req.body?.jobId as string | null) || null;
  const sendEmail = req.body?.sendEmail === true;
  const supabase = getSupabaseClient();

  const { data: prior } = await supabase
    .from('candidate_reports')
    .select('version')
    .eq('candidate_id', candidateId)
    .eq('report_type', reportType)
    .order('version', { ascending: false })
    .limit(1);
  const version = (((prior || []) as Array<{ version: number }>)[0]?.version || 0) + 1;

  // Synchronous build keeps the UI simple and retryable; the heavy
  // final-decision flow uses the background queue instead.
  const full = await buildInternalReport({ candidateId, jobId, reportType: reportType as 'internal' | 'candidate', version });
  const payload = reportType === 'candidate' ? toCandidateSafeReport(full) : full;
  if (reportType === 'candidate') {
    const leaked = assertCandidateSafe(payload);
    if (leaked.length > 0) throw new AppError('Report filter failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
  const { data: row, error } = await supabase
    .from('candidate_reports')
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      report_type: reportType,
      version,
      payload: payload as unknown as Record<string, unknown>,
      generated_by: recruiter.id,
      email_status: sendEmail ? 'queued' : 'pending',
    })
    .select('id')
    .single();
  if (error || !row) throw new AppError(`Report save failed: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  const reportId = (row as { id: string }).id;
  const pdf = await generateReportPdf({ ...payload, reportId });
  const path = reportStoragePath(candidateId, reportId);
  await uploadReportPdf(path, pdf);
  await supabase.from('candidate_reports').update({ pdf_storage_path: path, generated_at: new Date().toISOString() }).eq('id', reportId);

  if (sendEmail) {
    if (reportType !== 'candidate') throw new AppError('Only candidate-safe reports may be emailed', 400, ErrorCodes.VALIDATION_ERROR);
    await queueCandidateReportEmail({ candidateId, jobId, recruiterId: recruiter.id, reportId, version });
  }
  res.json({ success: true, data: { reportId, version } });
});

// GET /candidates/:candidateId/reports/:reportId — recruiter view (payload).
export const getReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const reportId = String((req.params as Record<string, unknown>).reportId || '');
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('candidate_reports').select('*').eq('id', reportId).eq('candidate_id', candidateId).maybeSingle();
  if (!data) throw new AppError('Report not found', 404, ErrorCodes.NOT_FOUND);
  res.json({ success: true, data });
});

// GET /candidates/:candidateId/reports/:reportId/download — PDF bytes (auth-checked).
export const downloadReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const reportId = String((req.params as Record<string, unknown>).reportId || '');
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('candidate_reports')
    .select('id, pdf_storage_path, report_type')
    .eq('id', reportId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (!data || !(data as { pdf_storage_path?: string | null }).pdf_storage_path) {
    throw new AppError('Report PDF not ready', 404, ErrorCodes.NOT_FOUND);
  }
  const pdf = await downloadReportPdf((data as { pdf_storage_path: string }).pdf_storage_path);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="HireStack-Report-${reportId.slice(0, 8)}.pdf"`);
  res.send(pdf);
});

async function queueCandidateReportEmail(input: { candidateId: string; jobId: string | null; recruiterId: string; reportId: string; version: number }) {
  const supabase = getSupabaseClient();
  const { data: row } = await supabase
    .from('candidate_reports')
    .select('report_type, payload, pdf_storage_path')
    .eq('id', input.reportId)
    .maybeSingle();
  if (!row || (row as { report_type: string }).report_type !== 'candidate') {
    throw new AppError('Only candidate-safe reports may be emailed', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const { data: cand } = await supabase.from('candidates').select('email, full_name, current_status').eq('id', input.candidateId).maybeSingle();
  const to = ((cand as { email?: string } | null)?.email || '') as string;
  if (!to) throw new AppError('Candidate email missing', 400, ErrorCodes.VALIDATION_ERROR);
  const name = ((cand as { full_name?: string } | null)?.full_name || 'Candidate') as string;
  const status = ((cand as { current_status?: string } | null)?.current_status || 'Completed') as string;
  const path = (row as { pdf_storage_path?: string | null }).pdf_storage_path;
  if (!path) throw new AppError('Report PDF not ready', 409, ErrorCodes.VALIDATION_ERROR);
  const pdf = await downloadReportPdf(path);
  const hired = status.toLowerCase() === 'hired';
  const html = buildCandidateReportEmail({
    candidateName: name,
    resultMessage: hired
      ? 'Congratulations — you have been selected. Details are in your attached hiring report.'
      : `Your hiring process has concluded with status: ${status}. Your candidate-safe summary is attached.`,
    summaryLines: [`Report version ${input.version}`, `Final status: ${status}`],
    reportId: input.reportId,
  });
  const key = candidateReportEmailKey(input.candidateId, input.jobId, input.version);
  const { deduplicated } = await enqueueEmail({
    to,
    subject: candidateReportSubject(hired),
    html,
    attachments: [{ filename: `HireStack-Report-${input.reportId.slice(0, 8)}.pdf`, content: pdf.toString('base64'), contentType: 'application/pdf' }],
    jobId: key,
  });
  if (!deduplicated) {
    try {
      await logEmail(input.candidateId, 'candidate_report', candidateReportSubject(hired), html, {
        recruiterId: input.recruiterId, provider: 'resend', status: 'queued', idempotencyKey: key,
      });
    } catch { /* race-safe */ }
  }
  await supabase
    .from('candidate_reports')
    .update({ email_sent_at: new Date().toISOString(), email_status: 'queued', email_error: '' })
    .eq('id', input.reportId);
}

// POST /candidates/:candidateId/reports/:reportId/send { resend? } — manual send / resend.
export const sendReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const reportId = String((req.params as Record<string, unknown>).reportId || '');
  const resend = req.body?.resend === true;
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('candidate_reports').select('version, job_id, email_status').eq('id', reportId).eq('candidate_id', candidateId).maybeSingle();
  if (!data) throw new AppError('Report not found', 404, ErrorCodes.NOT_FOUND);
  const r = data as { version: number; job_id: string | null; email_status: string };
  // Prevent accidental duplicates: refuse when already queued/sent unless explicit resend.
  if ((r.email_status === 'queued' || r.email_status === 'sent') && !resend) {
    throw new AppError('Report email already queued/sent — pass resend:true to resend', 409, ErrorCodes.VALIDATION_ERROR);
  }
  await queueCandidateReportEmail({ candidateId, jobId: r.job_id, recruiterId: recruiter.id, reportId, version: r.version });
  res.json({ success: true, data: { queued: true } });
});

// POST /candidates/:candidateId/final-decision { decision, jobId?, sendEmail? }
// Persists the decision FIRST, then best-effort enqueues the candidate report.
// Report/email failure never rolls back the decision.
export const finalDecisionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const candidateId = candidateIdOf(req);
  await requireOwnedCandidate(recruiter.id, candidateId);
  const decision = String(req.body?.decision || '');
  if (!['Hired', 'Rejected', 'Hold'].includes(decision)) {
    throw new AppError('decision must be Hired | Rejected | Hold', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const jobId = (req.body?.jobId as string | null) || null;
  const supabase = getSupabaseClient();
  await supabase.from('candidates').update({ current_status: decision }).eq('id', candidateId);
  await supabase.from('candidate_status_log').insert({ candidate_id: candidateId, status: decision, details: { finalDecision: true } });

  let report: { queued: boolean; error?: string } = { queued: false };
  try {
    const { count } = await supabase
      .from('candidate_reports')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', candidateId)
      .eq('report_type', 'candidate');
    const decisionVersion = (count || 0) + 1;
    const { deduplicated } = await enqueueReportJob({
      candidateId,
      jobId,
      recruiterId: recruiter.id,
      reportType: 'candidate',
      decisionVersion,
      sendEmail: req.body?.sendEmail !== false,
    });
    report = { queued: true };
    void deduplicated;
  } catch (err) {
    report = { queued: false, error: err instanceof Error ? err.message : String(err) };
  }
  res.json({ success: true, data: { decision, report } });
});

// ---------- Candidate self-service (session auth, candidate-safe ONLY) ----------

export const getCandidateReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('No candidate session', 401, ErrorCodes.NOT_FOUND);
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('candidate_reports')
    .select('id, version, payload, generated_at, email_sent_at, email_status')
    .eq('candidate_id', ctx.candidateId)
    .eq('report_type', 'candidate')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new AppError('No report available yet', 404, ErrorCodes.NOT_FOUND);
  res.json({ success: true, data });
});

export const downloadCandidateReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('No candidate session', 401, ErrorCodes.NOT_FOUND);
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('candidate_reports')
    .select('id, pdf_storage_path')
    .eq('candidate_id', ctx.candidateId)
    .eq('report_type', 'candidate')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const path = (data as { pdf_storage_path?: string | null } | null)?.pdf_storage_path;
  if (!path) throw new AppError('Report PDF not ready', 404, ErrorCodes.NOT_FOUND);
  const pdf = await downloadReportPdf(path);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="HireStack-Report.pdf"');
  res.send(pdf);
});
