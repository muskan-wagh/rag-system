import { getQdrantClient } from './client';
import { generateEmbedding } from '@/services/llm/client';
import { Candidate, SearchFilters } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';

interface SearchResult {
  candidate: Candidate;
  score: number;
}

export async function searchCandidates(
  queryText: string,
  limit: number = 10,
  filters?: SearchFilters,
): Promise<SearchResult[]> {
  logger.info('Searching candidates', { queryLength: queryText.length, limit });

  const embedding = await generateEmbedding(queryText);

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
      key: 'education.level',
      match: { value: filters.educationLevel },
    });
  }

  const searchResult = await client.search(config.qdrant.collectionName, {
    vector: embedding,
    limit,
    with_payload: true,
    ...(filterConditions.length > 0 ? { filter: { must: filterConditions } } : {}),
  });

  const results: SearchResult[] = searchResult.map((hit) => ({
    candidate: hit.payload as unknown as Candidate,
    score: hit.score ?? 0,
  }));

  logger.info(`Found ${results.length} candidate matches`);

  return results;
}
