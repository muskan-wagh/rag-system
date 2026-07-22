import crypto from 'crypto';
import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';
import { extractJson } from '@/utils/parse-llm-json';

const CACHE_TTL = 300_000;

const SYSTEM_PROMPT = `You are a recruitment closing specialist. Given a candidate's resume and a job description, generate a closing strategy.

Return ONLY valid JSON with this exact shape:
{
  "selling_points": [
    {
      "point": "string",
      "detail": "string (why this matters to the candidate)"
    }
  ],
  "major_objection": {
    "objection": "string",
    "overcome_strategy": "string (how to address it)"
  }
}

Rules:
- Selling points should highlight what makes this opportunity compelling for THIS specific candidate
- Consider the candidate's current company vs the hiring company
- The major objection should identify the most likely hesitation`;

interface SellingPoint {
  point: string;
  detail: string;
}

interface Objection {
  objection: string;
  overcome_strategy: string;
}

interface StrategyResponse {
  selling_points: SellingPoint[];
  major_objection: Objection;
}

const FALLBACK = {
  selling_points: [
    {
      point: 'Career Growth',
      detail: 'This role offers clear advancement opportunities aligned with your experience level.',
    },
    {
      point: 'Impact',
      detail: 'You will work on challenging problems that leverage your core skills.',
    },
    {
      point: 'Compensation',
      detail: 'Competitive package commensurate with your expertise.',
    },
  ],
  major_objection: {
    objection: 'Compensation or benefits may not meet expectations',
    overcome_strategy:
      'Focus on total compensation including equity, bonuses, and growth opportunities rather than just base salary.',
  },
};

function cacheKey(jdText: string, resumeText: string): string {
  const hash = crypto.createHash('md5').update(jdText + resumeText).digest('hex');
  return `closing:${hash}`;
}

export async function generateClosingStrategy(
  jdText: string,
  resumeText: string,
): Promise<{ selling_points: SellingPoint[]; major_objection: Objection }> {
  const key = cacheKey(jdText, resumeText);

  const cached = await getCached<{ selling_points: SellingPoint[]; major_objection: Objection }>(key);
  if (cached) {
    logger.info('Closing strategy cache hit');
    return cached;
  }
  logger.info('Generating closing strategy');

  const trimmedJd = jdText.slice(0, 6000);
  const trimmedResume = resumeText.slice(0, 10000);

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Job Description:\n${trimmedJd}\n\nCandidate Resume:\n${trimmedResume}\n\nGenerate a closing strategy.`,
        },
      ],
      { temperature: 0.4, maxTokens: 1024 },
    );

    const parsed = extractJson<StrategyResponse>(response.content);
    if (parsed && Array.isArray(parsed.selling_points) && parsed.selling_points.length >= 2 && parsed.major_objection) {
      const result = {
        selling_points: parsed.selling_points,
        major_objection: parsed.major_objection,
      };
      await setCache(key, result, CACHE_TTL).catch(() => {});
      logger.info('Closing strategy generated', { sellingPoints: parsed.selling_points.length });
      return result;
    }

    logger.warn(`Closing strategy attempt ${attempt + 1} failed, retrying`);
  }

  await setCache(key, FALLBACK, CACHE_TTL).catch(() => {});
  return FALLBACK;
}
