import { getQdrantClient } from './client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { normalizeCandidatePayload } from './normalizePayload';

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
  if (!point || !point.payload) return null;

  return normalizeCandidatePayload(point.payload as Record<string, unknown>);
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

  return result.points
    .filter((p): p is typeof p & { payload: Record<string, unknown> } => p.payload !== null && p.payload !== undefined)
    .map((p) => normalizeCandidatePayload(p.payload as Record<string, unknown>));
}
