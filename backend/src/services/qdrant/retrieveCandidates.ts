import { getQdrantClient } from './client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function retrieveCandidateById(id: string): Promise<Candidate | null> {
  const client = getQdrantClient();

  const result = await client.scroll(config.qdrant.collectionName, {
    limit: 1,
    filter: {
      must: [{ key: 'id', match: { value: id } }],
    },
    with_payload: true,
  });

  const point = result.points[0];
  if (!point) return null;

  return point.payload as unknown as Candidate;
}

export async function retrieveCandidatesByIds(ids: string[]): Promise<Candidate[]> {
  const client = getQdrantClient();

  const result = await client.scroll(config.qdrant.collectionName, {
    limit: ids.length,
    filter: {
      should: ids.map((id) => ({ key: 'id', match: { value: id } })),
    },
    with_payload: true,
  });

  return result.points.map((p) => p.payload as unknown as Candidate);
}
