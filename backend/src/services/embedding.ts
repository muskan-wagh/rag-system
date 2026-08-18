import { pipeline, env } from '@xenova/transformers';
import { config } from '@/config';
import { logger } from '@/utils/logger';

env.localModelPath = '';
env.allowRemoteModels = true;
env.allowLocalModels = false;

let embedder: any = null;
let embedderPromise: Promise<any> | null = null;

function isHosted(): boolean {
  return Boolean(config.embedding.apiUrl && config.embedding.apiKey);
}

async function getEmbedder() {
  if (embedder) return embedder;
  if (!embedderPromise) {
    embedderPromise = (async () => {
      logger.info('Loading embedding model...');
      const model = await pipeline('feature-extraction', config.embedding.model, {
        quantized: true,
      });
      logger.info('Embedding model loaded', {
        model: config.embedding.model,
        dimensions: config.embedding.vectorSize,
      });
      return model;
    })().catch((err) => {
      embedderPromise = null;
      throw err;
    });
  }
  embedder = await embedderPromise;
  return embedder;
}

export async function warmUpEmbedding(): Promise<void> {
  if (isHosted()) {
    logger.info('Embedding provider is hosted — skipping local model warmup');
    return;
  }
  await getEmbedder();
}

async function localEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  const truncated = text.slice(0, 10000);

  const result = await extractor(truncated, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data) as number[];
}

async function hostedEmbedding(text: string): Promise<number[]> {
  const baseUrl = config.embedding.apiUrl.replace(/\/+$/, '');
  const model = config.embedding.apiModel || config.embedding.model;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.embedding.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding API returned a malformed response');
    }
    return embedding;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();

  const embedding = isHosted() ? await hostedEmbedding(text) : await localEmbedding(text);

  const duration = Date.now() - startTime;

  if (isHosted() && embedding.length !== config.qdrant.vectorSize) {
    logger.warn('Embedding dimension mismatch with Qdrant collection', {
      embeddingDimensions: embedding.length,
      qdrantVectorSize: config.qdrant.vectorSize,
      hint: 'Set EMBEDDING_VECTOR_SIZE and QDRANT_VECTOR_SIZE to match, then re-embed candidates.',
    });
  }

  logger.debug('Embedding generated', {
    provider: isHosted() ? 'hosted' : 'local',
    dimensions: embedding.length,
    duration: `${duration}ms`,
  });

  return embedding;
}
