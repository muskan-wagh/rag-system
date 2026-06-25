import crypto from 'crypto';
import { chatCompletion } from './client';
import { ParsedJD } from '@/types';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';
import { AppError } from '@/middleware/errorHandler';

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
  const cached = getCached<ParsedJD>(cacheKey);
  if (cached) {
    logger.info('Returning cached JD parse result', { title: cached.title });
    return cached;
  }

  logger.info('Parsing job description', { textLength: jdText.length });

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: jdText },
    ], { temperature: 0.1 });

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      setCache(cacheKey, parsed, 300000);

      logger.info('JD parsed successfully', {
        title: parsed.title,
        skillCount: parsed.skills.length,
        experienceRange: `${parsed.experience.min}-${parsed.experience.max}`,
      });

      return parsed;
    }

    logger.warn(`JD parse attempt ${attempt + 1} returned invalid JSON, retrying`);
  }

  throw new AppError('Failed to parse JD: LLM returned invalid JSON after 3 attempts', 502);
}
