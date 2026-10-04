import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

let reportQueue: Queue | null = null;

export async function getReportQueue(): Promise<Queue> {
  if (!reportQueue) {
    const connection = await ensureRedisConnected();
    reportQueue = new Queue('report-generation', {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    logger.info('BullMQ report queue initialized (report-generation)');
  }
  return reportQueue;
}

export interface ReportJobData {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  reportType: 'candidate';
  /** Final-decision version driving idempotency (1-based). */
  decisionVersion: number;
  /** Optional existing candidate_reports row to refresh. */
  reportId?: string;
  /** When true the worker also queues the candidate email with PDF. */
  sendEmail?: boolean;
}

/** Stable id: report-{candidate}-{job}-{type}-{version} */
export function reportJobId(candidateId: string, jobId: string | null | undefined, type: string, version: number): string {
  const c = String(candidateId).replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 60);
  const j = String(jobId || 'no-job').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 60);
  return `report-${c}-${j}-${type}-${Math.max(1, version | 0)}`.slice(0, 200);
}

export async function enqueueReportJob(data: ReportJobData): Promise<{ deduplicated: boolean }> {
  try {
    const q = await getReportQueue();
    const jobId = reportJobId(data.candidateId, data.jobId || null, data.reportType, data.decisionVersion);
    const existing = await q.getJob(jobId).catch(() => null);
    if (existing) {
      const state = await existing.getState().catch(() => 'unknown');
      if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        return { deduplicated: true };
      }
      await existing.remove().catch(() => {});
    }
    await q.add('generate-report', data, { jobId });
    return { deduplicated: false };
  } catch (err) {
    logger.error('Failed to enqueue report job', { err, candidateId: data.candidateId });
    return { deduplicated: false };
  }
}
