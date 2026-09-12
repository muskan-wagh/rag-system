import crypto from 'crypto';
import dns from 'dns';
import { pipeline, env } from '@xenova/transformers';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

// Prefer IPv4 for outbound HTTPS (notably the HF Inference API): on hosts
// with broken IPv6 DNS/routing, undici can stall on AAAA before falling
// back. A records are still used whenever present; AAAA remains the
// fallback when no A record exists.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Older Node — default ordering already IPv4-first.
}

env.localModelPath = '';
env.allowRemoteModels = true;
env.allowLocalModels = false;

/**
 * Qdrant collection compatibility — the `candidates` collection is created
 * with 384 dimensions / Cosine distance (see qdrant/createCollection.ts and
 * config.qdrant.vectorSize). Any embedding provider MUST return 384-d
 * vectors or Qdrant upserts will fail. Hosted migration is therefore
 * opt-in and dimension-guarded, NOT automatic.
 */
export const EMBEDDING_DIMS = 384;
const MAX_INPUT_CHARS = 10000;

// Single-flight guard: under concurrency 5, five jobs can hit a cold
// embedder at once. Without this they would each trigger pipeline() and
// load duplicate ONNX model instances into RAM.
let embedder: any = null;
let embedderLoading: Promise<any> | null = null;

async function getEmbedder() {
  if (embedder) return embedder;
  if (!embedderLoading) {
    logger.info('Loading embedding model...');
    embedderLoading = pipeline('feature-extraction', config.embedding.model, {
      quantized: true,
    }).then(
      (extractor) => {
        embedder = extractor;
        logger.info('Embedding model loaded (384-d)');
        return extractor;
      },
      (err) => {
        embedderLoading = null;
        throw err;
      },
    );
  }
  return embedderLoading;
}

// Bounded in-memory cache for repeated texts (e.g. the same JD searched
// repeatedly). Cap keeps RAM bounded: 200 entries × 384 floats ≈ 2.5MB.
const EMBEDDING_CACHE_TTL_MS = 60 * 60_000;
const EMBEDDING_CACHE_MAX = 200;
const embeddingCache = new Map<string, { vector: number[]; expiresAt: number }>();

function cacheKey(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function cacheGet(key: string): number[] | undefined {
  const entry = embeddingCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    embeddingCache.delete(key);
    return undefined;
  }
  // Refresh LRU order.
  embeddingCache.delete(key);
  embeddingCache.set(key, entry);
  return entry.vector;
}

function cacheSet(key: string, vector: number[]): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value;
    if (oldest) embeddingCache.delete(oldest);
  }
  embeddingCache.set(key, { vector, expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS });
}

function assertCompatibleDims(vector: number[], provider: string): void {
  if (vector.length !== EMBEDDING_DIMS) {
    throw new AppError(
      `Embedding provider "${provider}" returned ${vector.length} dimensions, ` +
        `but the Qdrant collection requires ${EMBEDDING_DIMS}. ` +
        `Hosted migration blocked to protect collection compatibility.`,
      500,
      ErrorCodes.AI_ERROR,
    );
  }
}

async function generateLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  const result = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });
  const embedding = Array.from(result.data) as number[];
  assertCompatibleDims(embedding, 'local');
  return embedding;
}

// Hosted provider: Hugging Face Inference for the SAME MiniLM model, so
// vectors stay 384-d and compatible with the existing Qdrant collection
// (no re-embed, no migration). NOTE (verified 2026-09-12): the serverless
// router maps sentence-transformers/all-MiniLM-L6-v2 to a
// sentence-similarity pipeline, so it canNOT serve raw embeddings — point
// EMBEDDING_API_URL at a dedicated HF Inference Endpoint (or another
// feature-extraction endpoint for this model) instead. Until then,
// production stays on local; hosted failures fall back to local.
// Configured ONLY via environment — no hardcoded endpoints or keys.
const HOSTED_TIMEOUT_MS = 60_000;

export async function generateHostedEmbedding(text: string): Promise<number[]> {
  const { apiUrl, apiKey, hostedModel } = config.embedding;
  if (!apiUrl || !apiKey || !hostedModel) {
    throw new AppError(
      'Hosted embeddings selected but EMBEDDING_API_URL / EMBEDDING_API_KEY / EMBEDDING_HOSTED_MODEL are not all set',
      500,
      ErrorCodes.AI_ERROR,
    );
  }

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/${hostedModel}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HOSTED_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // wait_for_model: HF cold-starts the model instead of 503ing.
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Never log the key or the input text — status only.
      throw new AppError(
        `Hosted embedding request failed: ${response.status}`,
        503,
        ErrorCodes.AI_ERROR,
        body.slice(0, 200),
      );
    }
    const data = (await response.json()) as unknown;
    // Feature-extraction returns number[] for a single input; accept
    // number[][] defensively (take the first embedding).
    const vector = Array.isArray(data) && data.length > 0 && typeof data[0] === 'number'
      ? (data as number[])
      : Array.isArray(data) && Array.isArray(data[0])
        ? (data[0] as number[])
        : null;
    if (!vector || !vector.every((n) => typeof n === 'number')) {
      throw new AppError('Hosted embedding response had no usable vector', 503, ErrorCodes.AI_ERROR);
    }
    assertCompatibleDims(vector, 'hosted');
    return vector;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `Hosted embedding request failed: ${err.name === 'AbortError' ? 'timeout' : err.message}`,
      503,
      ErrorCodes.AI_ERROR,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  const truncated = text.slice(0, MAX_INPUT_CHARS);
  const key = cacheKey(truncated);
  const cached = cacheGet(key);
  if (cached) {
    logger.debug('Embedding cache hit', { duration: `${Date.now() - startTime}ms` });
    return cached;
  }

  const provider = config.embedding.provider;
  if (provider === 'hosted') {
    // Local stays as the safety net: a hosted outage or bad response must
    // never take down resume processing or search. Mismatches are logged
    // loudly so staging validation can detect them.
    try {
      const vector = await generateHostedEmbedding(truncated);
      cacheSet(key, vector);
      logger.debug('Embedding generated', {
        provider,
        dimensions: vector.length,
        duration: `${Date.now() - startTime}ms`,
      });
      return vector;
    } catch (err) {
      logger.warn('Hosted embedding failed — falling back to local provider', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const vector = await generateLocalEmbedding(truncated);

  cacheSet(key, vector);
  logger.debug('Embedding generated', {
    provider,
    dimensions: vector.length,
    duration: `${Date.now() - startTime}ms`,
  });
  return vector;
}
