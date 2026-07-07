import crypto from 'crypto';
import { chatCompletion } from './client';
import { ParsedJD } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

const jdCache = new Map<string, { value: ParsedJD; expiry: number }>();
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

export async function parseJD(jdText: string): Promise<ParsedJD> {
  const cacheKey = `jd:${crypto.createHash('md5').update(jdText).digest('hex')}`;
  const cached = jdCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: jdText },
    ], { temperature: 0.1 });

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      jdCache.set(cacheKey, { value: parsed, expiry: Date.now() + CACHE_TTL });
      return parsed;
    }

    logger.warn(`JD parse attempt ${attempt + 1} returned invalid JSON, retrying`);
  }

  throw new AppError('Failed to parse JD: LLM returned invalid JSON after 3 attempts', 502, ErrorCodes.AI_ERROR);
}
