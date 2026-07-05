import { chatCompletion } from './client';
import { logger } from '@/utils/logger';

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

function tryParseJSON(raw: string): StrategyResponse | null {
  try {
    return JSON.parse(raw) as StrategyResponse;
  } catch {
    return null;
  }
}

export async function generateClosingStrategy(
  jdText: string,
  resumeText: string,
): Promise<{ selling_points: SellingPoint[]; major_objection: Objection }> {
  logger.info('Generating closing strategy');

  const trimmedJd = jdText.slice(0, 6000);
  const trimmedResume = resumeText.slice(0, 10000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Job Description:\n${trimmedJd}\n\nCandidate Resume:\n${trimmedResume}\n\nGenerate a closing strategy.`,
        },
      ],
      { temperature: 0.4, maxTokens: 1536 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed && parsed.selling_points.length >= 2) {
      logger.info('Closing strategy generated', {
        sellingPoints: parsed.selling_points.length,
      });
      return {
        selling_points: parsed.selling_points,
        major_objection: parsed.major_objection,
      };
    }

    logger.warn(`Closing strategy attempt ${attempt + 1} failed, retrying`);
  }

  return {
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
}
