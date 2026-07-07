import { pipeline, env } from '@xenova/transformers';
import { logger } from '@/utils/logger';

env.localModelPath = '';
env.allowRemoteModels = true;
env.allowLocalModels = false;

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    logger.info('Loading embedding model...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    logger.info('Embedding model loaded (384-d)');
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  const extractor = await getEmbedder();
  const truncated = text.slice(0, 10000);

  const result = await extractor(truncated, {
    pooling: 'mean',
    normalize: true,
  });

  const embedding = Array.from(result.data) as number[];
  const duration = Date.now() - startTime;

  logger.debug('Embedding generated', {
    dimensions: embedding.length,
    duration: `${duration}ms`,
  });

  return embedding;
}
