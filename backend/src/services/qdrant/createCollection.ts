import { getQdrantClient } from './client';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function createCollection(): Promise<void> {
  const client = getQdrantClient();
  const collectionName = config.qdrant.collectionName;

  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === collectionName);

  if (exists) {
    logger.info(`Collection "${collectionName}" already exists`);
    return;
  }

  await client.createCollection(collectionName, {
    vectors: {
      size: config.qdrant.vectorSize,
      distance: config.qdrant.distance,
    },
  });

  logger.info(`Collection "${collectionName}" created`, {
    vectorSize: config.qdrant.vectorSize,
    distance: config.qdrant.distance,
  });
}
