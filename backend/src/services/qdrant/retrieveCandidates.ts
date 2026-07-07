import { getQdrantClient } from './client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { normalizeCandidatePayload } from './normalizePayload';

export async function retrieveCandidateByIds(ids: string[]): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  const client = getQdrantClient();

  const result = await client.retrieve(config.qdrant.collectionName, {
    ids,
    with_payload: true,
  });

  return result
    .filter((p) => p.payload !== null && p.payload !== undefined)
    .map((p) => normalizeCandidatePayload(p.payload as Record<string, unknown>));
}
