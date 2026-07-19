import { Worker } from 'bullmq';
import { ensureRedisConnected, shutdownRedis } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import { sendEmail } from '@/services/email';

async function startEmailWorker(): Promise<void> {
  logger.info('=== Email Worker Starting ===');

  const connection = await ensureRedisConnected();

  const worker = new Worker(
    'email-sending',
    async (job) => {
      const { to, subject, html, from } = job.data;
      logger.info('Email worker: sending email', { to, subject });

      const result = await sendEmail({ to, subject, html, from });

      if (!result.success) {
        throw new Error(result.error || 'Unknown email error');
      }
    },
    {
      connection: connection as any,
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Email worker: job failed', {
      jobId: job?.id,
      error: err.message,
      to: job?.data?.to,
      subject: job?.data?.subject,
    });
  });

  worker.on('completed', (job) => {
    logger.info('Email worker: job completed', { jobId: job.id, to: job.data.to });
  });

  logger.info('Email worker started and listening on queue: email-sending');

  const shutdown = async () => {
    logger.info('Email worker shutting down...');
    await worker.close();
    shutdownRedis();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startEmailWorker().catch((err) => {
  logger.error('Email worker failed to start', { error: err.message });
  process.exit(1);
});
