import crypto from 'crypto';
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

export async function insertCandidate(candidate: Candidate): Promise<void> {
  logger.info('Inserting candidate', { candidateId: candidate.id });

  const text = buildCandidateText(candidate);
  const embedding = await generateEmbedding(text);

  const client = getQdrantClient();

  await client.upsert(config.qdrant.collectionName, {
    points: [
      {
        id: crypto.randomUUID(),
        vector: embedding,
        payload: candidate as unknown as Record<string, unknown>,
      },
    ],
  });

  logger.info('Candidate inserted successfully', { candidateId: candidate.id });
}

export async function insertCandidates(candidates: Candidate[]): Promise<void> {
  logger.info(`Inserting ${candidates.length} candidates`);

  const points = await Promise.all(
    candidates.map(async (candidate) => {
      const text = buildCandidateText(candidate);
      const embedding = await generateEmbedding(text);
      return {
        id: crypto.randomUUID(),
        vector: embedding,
        payload: candidate as unknown as Record<string, unknown>,
      };
    }),
  );

  const client = getQdrantClient();

  await client.upsert(config.qdrant.collectionName, { points });

  logger.info(`Inserted ${candidates.length} candidates`);
}
