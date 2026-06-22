import { getQdrantClient } from './client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function getAllCandidates(): Promise<Candidate[]> {
  const client = getQdrantClient();
  const collectionName = config.qdrant.collectionName;

  let allPoints: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextOffset: any = undefined;

  do {
    const result = await client.scroll(collectionName, {
      limit: 100,
      offset: nextOffset,
      with_payload: true,
    });

    allPoints = allPoints.concat(result.points);
    nextOffset = result.next_page_offset;
  } while (nextOffset != null);

  const candidates = allPoints.map((p) => p.payload as unknown as Candidate);

  logger.info(`Retrieved ${candidates.length} candidates from Qdrant`);

  return candidates;
}
