import crypto from 'crypto';
import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';
import { extractJson } from '@/utils/parse-llm-json';

const CACHE_TTL = 300_000;

const SYSTEM_PROMPT = `You are a hiring manager preparing screening questions. Given a job description and a candidate's resume, generate 5 insightful questions to verify claimed skills and assess fit.

Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "question": "string",
      "focus_area": "string (e.g. 'Technical Skill', 'Experience Verification', 'Soft Skill')",
      "why_this_matters": "string (1 sentence)"
    }
  ]
}

Rules:
- Questions should target SPECIFIC claims in the resume
- Each question should verify a different skill or experience
- Be concrete, not generic
- Focus on areas most relevant to the job requirements`;

interface ScreeningQuestion {
  question: string;
  focus_area: string;
  why_this_matters: string;
}

interface ScreeningResponse {
  questions: ScreeningQuestion[];
}

function cacheKey(jdText: string, resumeText: string): string {
  const hash = crypto.createHash('md5').update(jdText + resumeText).digest('hex');
  return `screening:${hash}`;
}

const FALLBACK = {
  questions: [
    {
      question: 'Could you walk us through a project where you demonstrated the key skills listed on your resume?',
      focus_area: 'Experience Verification',
      why_this_matters: 'Validates the depth of claimed experience',
    },
  ],
};

export async function generateScreeningQuestions(
  jdText: string,
  resumeText: string,
): Promise<{ questions: ScreeningQuestion[] }> {
  const key = cacheKey(jdText, resumeText);

  const cached = await getCached<{ questions: ScreeningQuestion[] }>(key);
  if (cached) {
    logger.info('Screening questions cache hit');
    return cached;
  }
  logger.info('Generating screening questions');

  const trimmedJd = jdText.slice(0, 6000);
  const trimmedResume = resumeText.slice(0, 10000);

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Job Description:\n${trimmedJd}\n\nCandidate Resume:\n${trimmedResume}\n\nGenerate 5 personalized screening questions.`,
        },
      ],
      { temperature: 0.4, maxTokens: 1024 },
    );

    const parsed = extractJson<ScreeningResponse>(response.content);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
      const result = { questions: parsed.questions };
      await setCache(key, result, CACHE_TTL).catch(() => {});
      logger.info('Screening questions generated', { count: parsed.questions.length });
      return result;
    }

    logger.warn(`Screening questions attempt ${attempt + 1} failed, retrying`);
  }

  await setCache(key, FALLBACK, CACHE_TTL).catch(() => {});
  return FALLBACK;
}
