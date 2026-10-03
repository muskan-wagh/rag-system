import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';

export const REPORTS_BUCKET = 'candidate-reports';

/** Storage path: candidate-reports/{candidateId}/{reportId}.pdf (no PII in path beyond ids). */
export function reportStoragePath(candidateId: string, reportId: string): string {
  const c = String(candidateId).replace(/[^a-zA-Z0-9-]/g, '');
  const r = String(reportId).replace(/[^a-zA-Z0-9-]/g, '');
  return `${c}/${r}.pdf`;
}

export async function uploadReportPdf(path: string, pdf: Buffer): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(REPORTS_BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (error) throw new Error(`Report PDF upload failed: ${error.message}`);
}

export async function downloadReportPdf(path: string): Promise<Buffer> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).download(path);
  if (error || !data) throw new Error(`Report PDF download failed: ${error?.message || 'not found'}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return buf;
}

/** Short-lived signed URL for recruiter download (server-authorized first). */
export async function signedReportUrl(path: string, expiresInSeconds = 600): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    logger.warn('signed report url failed', { error: error?.message });
    throw new Error('Could not create report download link');
  }
  return data.signedUrl;
}
