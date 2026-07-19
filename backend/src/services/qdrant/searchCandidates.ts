import { getQdrantClient } from './client';
import { Candidate, SearchFilters } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { normalizeCandidatePayload } from './normalizePayload';

export interface SearchResult {
  candidate: Candidate;
  score: number;
}

export async function searchByEmbedding(
  embedding: number[],
  limit: number = 10,
  filters?: SearchFilters,
  offset?: number,
): Promise<SearchResult[]> {
  logger.info('Searching candidates by embedding', { limit, offset });

  const client = getQdrantClient();

  const filterConditions: Record<string, unknown>[] = [];

  if (filters?.minExperience !== undefined) {
    filterConditions.push({
      key: 'experience',
      range: { gte: filters.minExperience },
    });
  }

  if (filters?.maxExperience !== undefined) {
    filterConditions.push({
      key: 'experience',
      range: { lte: filters.maxExperience },
    });
  }

  if (filters?.skills && filters.skills.length > 0) {
    filterConditions.push({
      key: 'skills',
      match: { any: filters.skills },
    });
  }

  if (filters?.educationLevel) {
    filterConditions.push({
      key: 'education_level',
      match: { value: filters.educationLevel },
    });
  }

  const searchResult = await client.search(config.qdrant.collectionName, {
    vector: embedding,
    limit,
    offset: offset ?? 0,
    with_payload: true,
    ...(filterConditions.length > 0 ? { filter: { must: filterConditions } } : {}),
  });

  const results: SearchResult[] = searchResult.map((hit) => ({
    candidate: hit.payload ? normalizeCandidatePayload(hit.payload as Record<string, unknown>) : {} as Candidate,
    score: hit.score ?? 0,
  }));

  logger.info(`Found ${results.length} candidate matches`);
  return results;
}
