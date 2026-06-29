import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = Object.freeze({
  port: parseInt(optional('PORT', '5000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  clientUrl: optional('CLIENT_URL', 'http://localhost:3000'),
  allowedOrigins: [
    'http://localhost:3000',
    'https://recruitflow-blond.vercel.app',
  ],

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: optional('OPENAI_MODEL', 'qwen/qwen3-next-80b-a3b-instruct'),
    baseUrl: 'https://openrouter.ai/api/v1',
    embeddingModel: 'text-embedding-3-small',
  },

  qdrant: {
    url: required('QDRANT_URL'),
    apiKey: required('QDRANT_API_KEY'),
    collectionName: optional('QDRANT_COLLECTION_NAME', 'candidates'),
    vectorSize: 1536,
    distance: 'Cosine' as const,
  },
});
