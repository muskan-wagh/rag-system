import { getQdrantClient } from './client';
import { config } from '@/config';
import { logger } from '@/utils/logger';

async function ensurePayloadIndex(
  collectionName: string,
  fieldName: string,
  fieldSchema: 'keyword' | 'integer',
): Promise<void> {
  try {
    await getQdrantClient().createPayloadIndex(collectionName, {
      field_name: fieldName,
      field_schema: fieldSchema,
      wait: false,
    });
    logger.debug(`Payload index created for "${fieldName}"`);
  } catch {
    logger.debug(`Payload index already exists for "${fieldName}"`);
  }
}

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
    ensurePayloadIndex(collectionName, 'id', 'keyword'),
    ensurePayloadIndex(collectionName, 'experience', 'integer'),
    ensurePayloadIndex(collectionName, 'skills', 'keyword'),
    ensurePayloadIndex(collectionName, 'education_level', 'keyword'),
  ]);

  logger.info(`Payload indexes ensured for "${collectionName}"`, {
    vectorSize: config.qdrant.vectorSize,
    distance: config.qdrant.distance,
  });
}
