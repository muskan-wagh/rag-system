import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { downloadResumeFile } from '@/services/supabase/storage';
import { updateCandidate, insertSkills, insertExperience } from '@/services/supabase/database';
import { extractResumeText, sanitizeText } from '@/services/resume-parser';
import { generateEmbedding } from '@/services/embedding';
import { parseResume } from '@/services/llm/parseResume';
import { calculateFlightRisk } from '@/services/llm/flightRisk';
import { getQdrantClient } from '@/services/qdrant/client';
import { publishEvent } from '@/services/events';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';

async function startWorker(): Promise<void> {
  logger.info('=== RecruitIQ Worker Starting ===');

  if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
    logger.error('REDIS_URL is still a placeholder! Set it to your Upstash Redis connection string.');
    logger.error('Get a free Redis instance at: https://upstash.com');
    process.exit(1);
  }

  const redisConnection = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Worker Redis: max connection retries exceeded');
        process.exit(1);
      }
      return Math.min(times * 200, 3000);
    },
  });

  await new Promise<void>((resolve, reject) => {
    redisConnection.on('ready', () => {
      logger.info('Worker Redis connected successfully');
      resolve();
    });
    redisConnection.on('error', (err) => {
      logger.error('Worker Redis connection error', { error: err.message });
    });
    redisConnection.on('close', () => {
      logger.warn('Worker Redis connection closed');
    });
    setTimeout(() => reject(new Error('Redis connection timeout after 15s')), 15000);
  });

  const worker = new Worker(
    'resume-processing',
    async (job) => {
      const { sessionId, storagePath, mimeType, originalName, source, candidateId } = job.data;
      const logCtx = { jobId: job.id, candidateId, sessionId, fileName: originalName };

      logger.info('=== WORKER: Job started ===', logCtx);

      // Step 1: Mark as PROCESSING
      await updateCandidate(candidateId, { processing_status: 'PROCESSING' });
      publishEvent('resume:processing', { candidateId, sessionId });

      // Step 2: Download file from storage + extract text (parallel not needed, download first)
      logger.info('WORKER: Downloading file from storage', logCtx);
      const fileBuffer = await downloadResumeFile(storagePath);
      const rawText = await extractResumeText(fileBuffer, mimeType);
      const cleanText = sanitizeText(rawText);
      logger.info('WORKER: Text extracted', { ...logCtx, textLength: cleanText.length });

      if (cleanText.length < 50) {
        throw new Error(`Extracted text is too short (${cleanText.length} chars) — file may be unreadable or scanned image`);
      }

      // Step 3: Parse with Qwen LLM
      logger.info('WORKER: Parsing resume with Qwen LLM', logCtx);
      const parsed = await parseResume(cleanText);

      // Step 4: Calculate flight risk
      const workHistory = parsed.work_history?.map(w => ({
        company: w.company,
        title: w.title,
        duration_years: w.duration_years,
      })) || [];
      const { flight_risk, growth_trajectory } = calculateFlightRisk(workHistory);

      // Step 5: Update candidate + insert skills + insert experience + generate embedding (parallel)
      const currentTitle = parsed.work_history?.[0]?.title || '';
      logger.info('WORKER: Running parallel updates (DB + embedding)', logCtx);

      const [embedding] = await Promise.all([
        (async () => {
          const embeddingText = [
            parsed.full_name,
            `Skills: ${parsed.skills.join(', ')}`,
            `Experience: ${parsed.total_experience_years} years`,
            `Education: ${parsed.education}`,
            cleanText.slice(0, 8000),
          ].filter(Boolean).join('. ');
          return generateEmbedding(embeddingText);
        })(),
        updateCandidate(candidateId, {
          full_name: parsed.full_name || 'Unknown',
          email: parsed.email || undefined,
          phone: parsed.phone || undefined,
          location: parsed.location || undefined,
          current_company: parsed.current_company || undefined,
          current_title: currentTitle,
          total_experience_years: parsed.total_experience_years || 0,
          parsed_json: parsed as unknown as Record<string, unknown>,
          flight_risk,
          growth_trajectory,
          source: source || '',
          raw_resume_text: cleanText,
          processing_status: 'COMPLETED',
        }),
      ]);

      // Insert skills and experiences (parallel, independent of embedding)
      if (parsed.skills && parsed.skills.length > 0) {
        await insertSkills(candidateId, parsed.skills);
      }
      if (parsed.work_history && parsed.work_history.length > 0) {
        await insertExperience(
          candidateId,
          parsed.work_history.map(w => ({
            job_title: w.title,
            company: w.company,
            start_date: '',
            end_date: '',
            is_current: false,
          })),
        );
      }

      // Step 6: Upsert to Qdrant
      logger.info('WORKER: Upserting to Qdrant', logCtx);
      const qdrant = getQdrantClient();
      await qdrant.upsert(config.qdrant.collectionName, {
        points: [{
          id: candidateId,
          vector: embedding,
          payload: {
            id: candidateId,
            name: parsed.full_name,
            email: parsed.email,
            skills: parsed.skills,
            experience: parsed.total_experience_years,
            education_level: '',
            education_field: '',
            summary: cleanText.slice(0, 500),
            source: source || '',
          },
        }],
      });

      publishEvent('resume:completed', { candidateId, name: parsed.full_name });
      logger.info('=== WORKER: Job completed successfully ===', { ...logCtx, name: parsed.full_name });
    },
    {
      connection: redisConnection as any,
      concurrency: 5,
    },
  );

  worker.on('failed', async (job, err) => {
    const candidateId = job?.data?.candidateId;
    logger.error('=== WORKER: Job failed ===', {
      jobId: job?.id,
      candidateId,
      error: err.message,
      attempts: job?.attemptsMade,
      stack: err.stack,
    });

    if (candidateId) {
      publishEvent('resume:failed', { candidateId, error: err.message });
      try {
        const { updateCandidate } = await import('@/services/supabase/database');
        await updateCandidate(candidateId, {
          processing_status: 'FAILED',
          error_message: `Attempt ${job?.attemptsMade}/3: ${err.message}`,
        });
      } catch (dbErr) {
        logger.error('WORKER: Failed to update candidate error status', { candidateId, dbErr });
      }
    }
  });

  worker.on('completed', (job) => {
    logger.info('=== WORKER: Job completed ===', { jobId: job.id, candidateId: job.data?.candidateId });
  });

  logger.info('BullMQ worker started and listening for jobs on queue: resume-processing');

  // Scan for stuck candidates and re-enqueue them using existing storage files
  try {
    const { getPendingCandidates } = await import('@/services/supabase/database');
    const { Queue: BullQueue } = await import('bullmq');
    const pending = await getPendingCandidates();
    if (pending.length > 0) {
      logger.info(`Found ${pending.length} stuck candidate(s)`, {
        statuses: pending.map(c => c.processing_status),
      });
      const reprocessQueue = new BullQueue('resume-processing', { connection: redisConnection as any });
      for (const c of pending) {
        if (!c.resume_file_url) {
          logger.warn('Cannot reprocess — no resume_file_url', { candidateId: c.id });
          continue;
        }
        // Derive storage path from public URL (last two segments: sessionId/filename)
        const urlParts = new URL(c.resume_file_url).pathname.split('/');
        const storagePath = urlParts.slice(-2).join('/');

        await reprocessQueue.add('process-resume', {
          sessionId: c.upload_session_id,
          storagePath,
          mimeType: c.resume_file_url.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          originalName: c.resume_file_url.split('/').pop() || 'resume',
          source: c.source || '',
          candidateId: c.id,
        });
      }
      await reprocessQueue.close();
    } else {
      logger.info('No stuck candidates found');
    }
  } catch (err: any) {
    logger.error('Reprocess scan failed', { error: err.message });
  }
}

startWorker().catch((err) => {
  logger.error('Worker failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});