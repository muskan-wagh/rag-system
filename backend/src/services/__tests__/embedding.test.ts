import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@xenova/transformers', () => ({
  env: { localModelPath: '', allowRemoteModels: true, allowLocalModels: false },
  pipeline: vi.fn(async () => async () => ({ data: new Float32Array(384) })),
}));

const TOUCHED_KEYS = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'QWEN_API_KEY', 'QDRANT_URL',
  'QDRANT_API_KEY', 'REDIS_URL', 'CLERK_SECRET_KEY',
  'EMBEDDING_API_URL', 'EMBEDDING_API_KEY', 'EMBEDDING_API_MODEL',
  'EMBEDDING_VECTOR_SIZE', 'QDRANT_VECTOR_SIZE', 'EMBEDDING_MODEL',
];

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const k of TOUCHED_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
  for (const k of TOUCHED_KEYS) {
    const v = snap[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const REQUIRED_BASE = {
  SUPABASE_URL: 'http://localhost',
  SUPABASE_SERVICE_ROLE_KEY: 'test-sb',
  QWEN_API_KEY: 'test-qwen',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_API_KEY: 'test-qdrant',
  REDIS_URL: 'redis://localhost:6379',
  CLERK_SECRET_KEY: 'test-clerk',
};

let envSnap: Record<string, string | undefined>;

beforeEach(() => {
  envSnap = snapshotEnv();
  Object.assign(process.env, REQUIRED_BASE);
  vi.resetModules();
});

afterEach(() => {
  restoreEnv(envSnap);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('generateEmbedding (hosted provider)', () => {
  it('calls the OpenAI-compatible embeddings endpoint and returns the vector', async () => {
    process.env.EMBEDDING_API_URL = 'https://api.jina.ai/v1';
    process.env.EMBEDDING_API_KEY = 'secret-key';
    process.env.EMBEDDING_API_MODEL = 'jina-embeddings-v3';
    process.env.EMBEDDING_VECTOR_SIZE = '1024';
    process.env.QDRANT_VECTOR_SIZE = '1024';

    const fetchMock = vi.fn(async (_url: string, _opts?: RequestInit) =>
      new Response(JSON.stringify({ data: [{ embedding: new Array(1024).fill(0.5) }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { generateEmbedding } = await import('@/services/embedding');
    const result = await generateEmbedding('test text');

    expect(result).toHaveLength(1024);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    const init = opts as RequestInit;
    expect(url).toBe('https://api.jina.ai/v1/embeddings');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('jina-embeddings-v3');
    expect(body.input).toBe('test text');
  });

  it('does not touch the network when hosted embedding is not configured', async () => {
    process.env.EMBEDDING_API_URL = '';
    process.env.EMBEDDING_API_KEY = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { generateEmbedding } = await import('@/services/embedding');
    const result = await generateEmbedding('fallback text');

    expect(result).toHaveLength(384);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});