import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '@/config';
import { logger } from '@/utils/logger';

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
    });
    logger.info('Qdrant client initialized');
  }
  return client;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const qdrant = getQdrantClient();
    const collections = await qdrant.getCollections();
    return Array.isArray(collections.collections);
  } catch (error) {
    logger.error('Qdrant health check failed', { error });
    return false;
  }
}
