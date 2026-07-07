import { getSupabaseClient } from './client';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

const BUCKET_NAME = 'resumes';

export async function ensureResumeBucket(): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      logger.warn('Cannot list storage buckets, may need SQL setup', { error: listError.message });
      return;
    }

    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (exists) {
      logger.info(`Storage bucket "${BUCKET_NAME}" already exists`);
      return;
    }

    logger.warn(`Storage bucket "${BUCKET_NAME}" not found via API — ensure it is created via SQL (see supabase_setup.sql)`);
  } catch (error) {
    logger.warn('Failed to ensure storage bucket', { error });
  }
}

export async function uploadResumeFile(
  sessionId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabaseClient();
  const timestamp = Date.now();
  const storagePath = `${sessionId}/${timestamp}_${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    logger.error('Failed to upload resume file to storage', { error: error.message });
    throw new AppError(`Failed to upload resume file: ${error.message}`, 500);
  }

  logger.info('Resume file uploaded to storage', { path: storagePath });
  return storagePath;
}

export async function getResumeFileUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}
