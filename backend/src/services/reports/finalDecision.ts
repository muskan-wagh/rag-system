import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { enqueueReportJob } from '@/services/queue/reportQueue';

/**
 * Final-decision → report → email fan-out.
 * FAILURE ISOLATION: report/email failures MUST NOT roll back the hiring
 * decision. This helper never throws to decision handlers — it persists the
 * decision first (caller), then best-effort enqueues an idempotent report
 * job and records the outcome on candidate_reports for recruiter visibility.
 */
export async function requestCandidateReportAfterDecision(input: {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  decision: string;
  sendEmail?: boolean;
}): Promise<{ queued: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    // decisionVersion = number of prior candidate reports + 1 (monotonic).
    const { count } = await supabase
      .from('candidate_reports')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', input.candidateId)
      .eq('report_type', 'candidate');
    const decisionVersion = (count || 0) + 1;
    const { deduplicated } = await enqueueReportJob({
      candidateId: input.candidateId,
      jobId: input.jobId || null,
      recruiterId: input.recruiterId,
      reportType: 'candidate',
      decisionVersion,
      sendEmail: input.sendEmail !== false,
    });
    logger.info('[final-decision] report job enqueued', {
      candidateId: input.candidateId,
      decision: input.decision,
      deduplicated,
    });
    return { queued: true };
  } catch (err) {
    // Swallowed by design — the decision itself already persisted.
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[final-decision] report enqueue failed (decision preserved)', {
      candidateId: input.candidateId,
      error: message,
    });
    return { queued: false, error: message };
  }
}
