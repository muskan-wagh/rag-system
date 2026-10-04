import { Worker, Job } from 'bullmq';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { buildInternalReport } from '@/services/reports/buildReport';
import { toCandidateSafeReport } from '@/services/reports/filterCandidateSafe';
import { generateReportPdf } from '@/services/reports/generatePdf';
import { uploadReportPdf, reportStoragePath } from '@/services/reports/storage';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { buildCandidateReportEmail, candidateReportEmailKey, candidateReportSubject } from '@/services/email/candidateReport';
import { logEmail } from '@/services/supabase/database';
import type { ReportJobData } from '@/services/queue/reportQueue';

/**
 * Report worker: builds the candidate-safe report snapshot, renders the
 * PDF (pdfkit), uploads to the private bucket, updates candidate_reports,
 * and optionally queues the candidate email with the PDF attached.
 * Retries are safe: rows are upserted per (candidate, type, version) and
 * email jobs are idempotent per candidate-report key.
 */
export async function processReportJob(job: Job<ReportJobData>): Promise<void> {
  const { candidateId, jobId, recruiterId, reportType, decisionVersion, sendEmail } = job.data;
  const supabase = getSupabaseClient();

  const { data: candidate } = await supabase.from('candidates').select('id, email, full_name, current_status, recruiter_id').eq('id', candidateId).maybeSingle();
  if (!candidate) throw new Error('Candidate not found for report');
  const cand = candidate as { email?: string; full_name?: string; current_status?: string; recruiter_id?: string };
  if (cand.recruiter_id && cand.recruiter_id !== recruiterId) {
    logger.warn('[report-worker] ownership mismatch — skipping', { candidateId });
    return;
  }

  // Next version for this candidate+type (decisionVersion drives idempotency upstream;
  // version column keeps a monotonic per-candidate history).
  const { data: existing } = await supabase
    .from('candidate_reports')
    .select('version')
    .eq('candidate_id', candidateId)
    .eq('report_type', reportType)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = Math.max(decisionVersion | 0 || 1, (((existing || []) as Array<{ version: number }>)[0]?.version || 0) + 1);

  // Upsert placeholder row first so retries / concurrent runs collapse.
  const { data: row, error: upsertError } = await supabase
    .from('candidate_reports')
    .upsert(
      {
        candidate_id: candidateId,
        job_id: jobId || null,
        report_type: reportType,
        version: nextVersion,
        generated_by: recruiterId,
        email_status: sendEmail ? 'queued' : 'pending',
      },
      { onConflict: 'candidate_id,report_type,version' },
    )
    .select('id')
    .single();
  if (upsertError || !row) throw new Error(`Report row upsert failed: ${upsertError?.message}`);
  const reportId = (row as { id: string }).id;

  try {
    // Internal snapshot is NOT stored on the candidate path — build once, filter to safe.
    const full = await buildInternalReport({ candidateId, jobId: jobId || null, reportType, version: nextVersion, reportId });
    const safe = reportType === 'candidate' ? toCandidateSafeReport(full) : full;
    const pdf = await generateReportPdf({ ...safe, reportId });
    const path = reportStoragePath(candidateId, reportId);
    await uploadReportPdf(path, pdf);

    await supabase
      .from('candidate_reports')
      .update({ payload: safe as unknown as Record<string, unknown>, pdf_storage_path: path, generated_at: new Date().toISOString(), email_status: sendEmail ? 'queued' : 'pending', email_error: '' })
      .eq('id', reportId);

    if (sendEmail) {
      const to = cand.email || '';
      if (!to) {
        await supabase.from('candidate_reports').update({ email_status: 'failed', email_error: 'Candidate email missing' }).eq('id', reportId);
        return;
      }
      const hired = String(cand.current_status || '').toLowerCase() === 'hired';
      const html = buildCandidateReportEmail({
        candidateName: cand.full_name || 'Candidate',
        resultMessage: hired
          ? 'Congratulations — you have been selected. Details are in your attached hiring report.'
          : `Your hiring process has concluded with status: ${cand.current_status || 'Completed'}. Your candidate-safe summary is attached.`,
        summaryLines: [
          `Report version ${nextVersion}`,
          `Final status: ${cand.current_status || 'Completed'}`,
        ],
        reportId,
      });
      const key = candidateReportEmailKey(candidateId, jobId || null, decisionVersion);
      await enqueueEmail({
        to,
        subject: candidateReportSubject(hired),
        html,
        attachments: [{ filename: `HireStack-Report-${reportId.slice(0, 8)}.pdf`, content: pdf.toString('base64'), contentType: 'application/pdf' }],
        jobId: key,
      });
      try {
        await logEmail(candidateId, 'candidate_report', candidateReportSubject(hired), html, {
          recruiterId,
          provider: 'resend',
          status: 'queued',
          idempotencyKey: key,
        });
      } catch {
        // email_logs UNIQUE race on retry — safe to ignore.
      }
      await supabase.from('candidate_reports').update({ email_sent_at: new Date().toISOString(), email_status: 'queued', email_error: '' }).eq('id', reportId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
    await supabase.from('candidate_reports').update({ email_status: sendEmail ? 'failed' : 'pending', email_error: message }).eq('id', reportId);
    throw err;
  }
}

export function startReportWorker(connection: unknown): Worker<ReportJobData> {
  const worker = new Worker<ReportJobData>('report-generation', (job) => processReportJob(job as Job<ReportJobData>), {
    connection: connection as never,
    concurrency: 3,
    lockDuration: 60_000,
  });
  worker.on('failed', (job, err) => {
    logger.error('[report-worker] job failed', { jobId: job?.id, error: err.message });
  });
  worker.on('completed', (job) => {
    logger.info('[report-worker] job completed', { jobId: job?.id });
  });
  logger.info('Report worker listening on queue: report-generation');
  return worker;
}
