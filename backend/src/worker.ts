import { Worker, Queue } from 'bullmq';
import { ensureRedisConnected, shutdownRedis } from '@/services/redis/manager';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { downloadResumeFile } from '@/services/supabase/storage';
import { updateCandidate, insertSkills, insertExperience, getPendingCandidates } from '@/services/supabase/database';
import { extractResumeText, sanitizeText } from '@/services/resume-parser';
import { generateEmbedding } from '@/services/embedding';
import { parseResume } from '@/services/llm/parseResume';
import { calculateFlightRisk } from '@/services/llm/flightRisk';
import { getQdrantClient } from '@/services/qdrant/client';
import { publishEvent } from '@/services/events';

async function startWorker(): Promise<void> {
  logger.info('=== RecruitIQ Worker Starting ===');

  const connection = await ensureRedisConnected();

  const worker = new Worker(
    'resume-processing',
    async (job) => {
      const { sessionId, storagePath, mimeType, originalName, source, candidateId } = job.data;
      const logCtx = { jobId: job.id, candidateId, sessionId, fileName: originalName };

      logger.info('=== WORKER: Job started ===', logCtx);

      // Step 1: Mark as PROCESSING
      logger.info('WORKER: Step 1/8 — Marking candidate as PROCESSING', logCtx);
      await updateCandidate(candidateId, { processing_status: 'PROCESSING' });
      publishEvent('resume:processing', { candidateId, sessionId });

      // Step 2: Download file from storage + extract text
      logger.info('WORKER: Step 2/8 — Downloading file from storage', logCtx);
      const fileBuffer = await downloadResumeFile(storagePath);
      const rawText = await extractResumeText(fileBuffer, mimeType);
      const cleanText = sanitizeText(rawText);
      logger.info('WORKER: Text extracted', { ...logCtx, textLength: cleanText.length });

      if (cleanText.length < 50) {
        throw new Error(`Extracted text is too short (${cleanText.length} chars) — file may be unreadable or scanned image`);
      }

      // Step 3: Parse with Qwen LLM
      logger.info('WORKER: Step 3/8 — Parsing resume with Qwen LLM', logCtx);
      const parsed = await parseResume(cleanText);

      // Step 4: Calculate flight risk
      logger.info('WORKER: Step 4/8 — Calculating flight risk', logCtx);
      const workHistory = parsed.work_history?.map(w => ({
        company: w.company,
        title: w.title,
        duration_years: w.duration_years,
      })) || [];
      const { flight_risk, growth_trajectory } = calculateFlightRisk(workHistory);

      // Step 5: Generate embedding
      logger.info('WORKER: Step 5/8 — Generating embedding', logCtx);
      const embeddingText = [
        parsed.full_name,
        `Skills: ${parsed.skills.join(', ')}`,
        `Experience: ${parsed.total_experience_years} years`,
        `Education: ${parsed.education}`,
        cleanText.slice(0, 8000),
      ].filter(Boolean).join('. ');
      const embedding = await generateEmbedding(embeddingText);

      // Step 6: Update candidate in DB (sequential — must succeed before Qdrant)
      logger.info('WORKER: Step 6/8 — Updating candidate in database', logCtx);
      const currentTitle = parsed.work_history?.[0]?.title || '';
      await updateCandidate(candidateId, {
        full_name: parsed.full_name || 'Unknown',
        email: parsed.email || '',
        phone: parsed.phone || '',
        location: parsed.location || '',
        current_company: parsed.current_company || '',
        current_title: currentTitle,
        total_experience_years: parsed.total_experience_years || 0,
        parsed_json: parsed as unknown as Record<string, unknown>,
        flight_risk,
        growth_trajectory,
        source: source || '',
        raw_resume_text: cleanText,
        processing_status: 'COMPLETED',
      });

      // Insert skills and experiences (parallel, independent)
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

      // Step 7: Upsert to Qdrant (after DB is committed)
      logger.info('WORKER: Step 7/8 — Upserting to Qdrant', logCtx);
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

      // Step 8: Publish completion event
      logger.info('WORKER: Step 8/8 — Publishing completion event', logCtx);
      publishEvent('resume:completed', { candidateId, name: parsed.full_name });
      logger.info('=== WORKER: Job completed successfully ===', { ...logCtx, name: parsed.full_name });
    },
    {
      connection: connection as any,
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

  logger.info('BullMQ worker started and listening on queue: resume-processing');

  // Scan for stuck candidates and re-enqueue them using existing storage files
  try {
    const pending = await getPendingCandidates();
    if (pending.length > 0) {
      logger.info(`Found ${pending.length} stuck candidate(s)`, {
        statuses: pending.map(c => c.processing_status),
      });
      const reprocessQueue = new Queue('resume-processing', { connection: connection as any });
      for (const c of pending) {
        if (!c.resume_file_url) {
          logger.warn('Cannot reprocess — no resume_file_url', { candidateId: c.id });
          continue;
        }
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

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Worker shutting down...');
    await worker.close();
    shutdownRedis();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch((err) => {
  logger.error('Worker failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});
