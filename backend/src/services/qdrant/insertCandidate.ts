import { getQdrantClient } from './client';
import { generateEmbedding } from '@/services/llm/client';
import { Candidate } from '@/types';
import { config } from '@/config';
import { logger } from '@/utils/logger';

function buildCandidateText(candidate: Candidate): string {
  return [
    candidate.name,
    candidate.summary,
    `Skills: ${candidate.skills.join(', ')}`,
    `Experience: ${candidate.experience} years`,
    `Education: ${candidate.education.level} in ${candidate.education.field}`,
    candidate.education.details,
  ]
    .filter(Boolean)
    .join('. ');
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

export async function insertCandidate(candidate: Candidate): Promise<void> {
  logger.info('Inserting candidate', { candidateId: candidate.id });

  const text = buildCandidateText(candidate);
  const embedding = await generateEmbedding(text);

  const client = getQdrantClient();

  await client.upsert(config.qdrant.collectionName, {
    points: [
      {
        id: candidate.id,
        vector: embedding,
        payload: candidate as unknown as Record<string, unknown>,
      },
    ],
  });

  logger.info('Candidate inserted successfully', { candidateId: candidate.id });
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function insertCandidates(candidates: Candidate[]): Promise<void> {
  logger.info(`Inserting ${candidates.length} candidates`);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const points = await Promise.all(
      batch.map(async (candidate) => {
        const text = buildCandidateText(candidate);
        const embedding = await generateEmbedding(text);
        return {
          id: candidate.id,
          vector: embedding,
          payload: candidate as unknown as Record<string, unknown>,
        };
      }),
    );

    const client = getQdrantClient();
    await client.upsert(config.qdrant.collectionName, { points });

    logger.info(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} candidates`);

    if (i + BATCH_SIZE < candidates.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  logger.info(`Inserted ${candidates.length} candidates`);
}
