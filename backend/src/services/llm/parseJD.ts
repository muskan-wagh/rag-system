import crypto from 'crypto';
import { chatCompletion } from './client';
import { ParsedJD } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { getCached, setCache } from '@/utils/cache';

const CACHE_TTL = 300_000;

const SYSTEM_PROMPT = `You are a job description parser. Extract structured information from job descriptions.
Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "skills": ["string"],
  "experience": { "min": number, "max": number },
  "education": { "level": "string", "field": "string" },
  "responsibilities": ["string"],
  "requirements": ["string"]
}

Rules:
- Extract all mentioned skills (technical and soft skills)
- Normalize skill names to lowercase
- For experience: if "X+ years" set min=X, max=10; if "X-Y years" set min=X, max=Y; if not specified set min=0, max=0
- For education level: "bachelor", "master", "phd", "diploma", or "any"
- For education field: the field of study
- If information is not present, use empty strings or arrays`;

function tryParseJSON(raw: string): ParsedJD | null {
  try {
    return JSON.parse(raw) as ParsedJD;
  } catch {
    return null;
  }
}

function jdCacheKey(jdText: string): string {
  return `jd:${crypto.createHash('md5').update(jdText).digest('hex')}`;
}

export async function parseJD(jdText: string): Promise<ParsedJD> {
  const cacheKey = jdCacheKey(jdText);

  const cached = await getCached<ParsedJD>(cacheKey);
  if (cached) {
    logger.info('JD cache hit', { cacheKey });
    return cached;
  }
  logger.info('JD cache miss', { cacheKey });

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: jdText },
    ], { temperature: attempt === 0 ? 0.05 : 0.1, maxTokens: 1024 });

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      await setCache(cacheKey, parsed, CACHE_TTL).catch(() => {});
      return parsed;
    }

    logger.warn(`JD parse attempt ${attempt + 1} returned invalid JSON, retrying`);
  }

  throw new AppError('Failed to parse JD: LLM returned invalid JSON after 2 attempts', 502, ErrorCodes.AI_ERROR);
}
