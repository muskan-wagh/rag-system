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
  } else {
    await client.createCollection(collectionName, {
      vectors: {
        size: config.qdrant.vectorSize,
        distance: config.qdrant.distance,
      },
    });
    logger.info(`Collection "${collectionName}" created`);
  }

  await Promise.all([
    client.createPayloadIndex(collectionName, {
      field_name: 'id',
      field_schema: 'keyword',
    }),
    client.createPayloadIndex(collectionName, {
      field_name: 'experience',
      field_schema: 'integer',
    }),
    client.createPayloadIndex(collectionName, {
      field_name: 'skills',
      field_schema: 'keyword',
    }),
    client.createPayloadIndex(collectionName, {
      field_name: 'education.level',
      field_schema: 'keyword',
    }),
  ]);

  logger.info(`Payload indexes ensured for "${collectionName}"`, {
    vectorSize: config.qdrant.vectorSize,
    distance: config.qdrant.distance,
  });
}
