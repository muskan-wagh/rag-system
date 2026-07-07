import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { uploadResumeFile, getResumeFileUrl } from '@/services/supabase/storage';
import { updateCandidate, insertSkills, insertExperience } from '@/services/supabase/database';
import { extractResumeText, sanitizeText } from '@/services/resume-parser';
import { generateEmbedding } from '@/services/embedding';
import { parseResume } from '@/services/llm/parseResume';
import { calculateFlightRisk } from '@/services/llm/flightRisk';
import { getQdrantClient } from '@/services/qdrant/client';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';

async function startWorker(): Promise<void> {
  logger.info('=== RecruitIQ Worker Starting ===');

  if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
    logger.error('REDIS_URL is still a placeholder! Set it to your Upstash Redis connection string.');
    logger.error('Get a free Redis instance at: https://upstash.com');
    process.exit(1);
  }

  logger.info('Connecting to Redis...', { url: config.redis.url.replace(/:[^:@]+@/, ':****@') });

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

  logger.info('Starting BullMQ worker...');

  const worker = new Worker(
    'resume-processing',
    async (job) => {
      const { sessionId, fileBuffer, mimeType, originalName, source, candidateId } = job.data;
      const logCtx = { jobId: job.id, candidateId, sessionId, fileName: originalName };

      logger.info('=== WORKER: Job started ===', logCtx);

      // Step 1: Mark as PROCESSING
      logger.info('WORKER: Step 1 - Marking candidate as PROCESSING', logCtx);
      await updateCandidate(candidateId, { processing_status: 'PROCESSING' });

      // Step 2: Upload file to Supabase Storage
      logger.info('WORKER: Step 2 - Uploading file to Supabase Storage', logCtx);
      const storagePath = await uploadResumeFile(sessionId, originalName, Buffer.from(fileBuffer), mimeType);
      const resumeFileUrl = await getResumeFileUrl(storagePath);
      logger.info('WORKER: File uploaded', { ...logCtx, storagePath, resumeFileUrl });

      // Step 3: Extract text from resume
      logger.info('WORKER: Step 3 - Extracting text from resume', logCtx);
      const rawText = await extractResumeText(Buffer.from(fileBuffer), mimeType);
      const cleanText = sanitizeText(rawText);
      logger.info('WORKER: Text extracted', { ...logCtx, textLength: cleanText.length });

      if (cleanText.length < 50) {
        throw new Error(`Extracted text is too short (${cleanText.length} chars) — file may be unreadable or scanned image`);
      }

      // Step 4: Parse with Qwen LLM
      logger.info('WORKER: Step 4 - Parsing resume with Qwen LLM', logCtx);
      const parsed = await parseResume(cleanText);
      logger.info('WORKER: Resume parsed', { ...logCtx, name: parsed.full_name, skills: parsed.skills.length, experience: parsed.work_history?.length });

      // Step 5: Calculate flight risk
      logger.info('WORKER: Step 5 - Calculating flight risk', logCtx);
      const { flight_risk, growth_trajectory } = calculateFlightRisk(
        parsed.work_history?.map(w => ({
          company: w.company,
          title: w.title,
          duration_years: w.duration_years,
        })) || [],
      );
      logger.info('WORKER: Flight risk calculated', { ...logCtx, flight_risk, growth_trajectory });

      // Step 6: Update candidate record in Supabase
      logger.info('WORKER: Step 6 - Updating candidate record in Supabase', logCtx);
      const currentTitle = parsed.work_history?.[0]?.title || '';
      await updateCandidate(candidateId, {
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
        resume_file_url: resumeFileUrl,
        raw_resume_text: cleanText,
        processing_status: 'COMPLETED',
      });
      logger.info('WORKER: Candidate record updated', logCtx);

      // Step 7: Insert skills
      if (parsed.skills && parsed.skills.length > 0) {
        logger.info('WORKER: Step 7 - Inserting skills', { ...logCtx, skillCount: parsed.skills.length });
        await insertSkills(candidateId, parsed.skills);
        logger.info('WORKER: Skills inserted', logCtx);
      } else {
        logger.info('WORKER: Step 7 - No skills to insert', logCtx);
      }

      // Step 8: Insert experience
      if (parsed.work_history && parsed.work_history.length > 0) {
        logger.info('WORKER: Step 8 - Inserting experience', { ...logCtx, expCount: parsed.work_history.length });
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
        logger.info('WORKER: Experience inserted', logCtx);
      } else {
        logger.info('WORKER: Step 8 - No experience to insert', logCtx);
      }

      // Step 9: Generate embedding and upsert to Qdrant
      logger.info('WORKER: Step 9 - Generating embedding', logCtx);
      const embeddingText = [
        parsed.full_name,
        `Skills: ${parsed.skills.join(', ')}`,
        `Experience: ${parsed.total_experience_years} years`,
        cleanText.slice(0, 3000),
      ].filter(Boolean).join('. ');

      const embedding = await generateEmbedding(embeddingText);
      logger.info('WORKER: Embedding generated', { ...logCtx, dimensions: embedding.length });

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
            summary: cleanText.slice(0, 500),
            source: source || '',
          },
        }],
      });
      logger.info('WORKER: Candidate upserted to Qdrant', logCtx);

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
      try {
        const { updateCandidate } = await import('@/services/supabase/database');
        await updateCandidate(candidateId, {
          processing_status: 'FAILED',
          error_message: `Attempt ${job?.attemptsMade}/3: ${err.message}`,
        });
        logger.info('WORKER: Candidate marked as FAILED', { candidateId });
      } catch (dbErr) {
        logger.error('WORKER: Failed to update candidate error status', { candidateId, dbErr });
      }
    }
  });

  worker.on('completed', (job) => {
    logger.info('=== WORKER: Job completed ===', { jobId: job.id, candidateId: job.data?.candidateId });
  });

  logger.info('BullMQ worker started and listening for jobs on queue: resume-processing');

  // Scan for stuck candidates and re-enqueue them
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
        logger.info('Reprocessing candidate', { candidateId: c.id, status: c.processing_status });
        const res = await fetch(c.resume_file_url);
        if (!res.ok) {
          logger.error('Failed to download stored resume', { candidateId: c.id, status: res.status });
          continue;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        await reprocessQueue.add('process-resume', {
          sessionId: c.upload_session_id,
          fileBuffer: Array.from(buffer),
          mimeType: c.resume_file_url.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          originalName: c.resume_file_url.split('/').pop() || 'resume',
          source: c.source || '',
          candidateId: c.id,
        });
        logger.info('Reprocess job enqueued', { candidateId: c.id });
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
