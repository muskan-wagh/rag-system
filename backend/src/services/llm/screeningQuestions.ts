import { chatCompletion } from './client';
import { logger } from '@/utils/logger';

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

function tryParseJSON(raw: string): ScreeningResponse | null {
  try {
    return JSON.parse(raw) as ScreeningResponse;
  } catch {
    return null;
  }
}

export async function generateScreeningQuestions(
  jdText: string,
  resumeText: string,
): Promise<{ questions: ScreeningQuestion[] }> {
  logger.info('Generating screening questions');

  const trimmedJd = jdText.slice(0, 6000);
  const trimmedResume = resumeText.slice(0, 10000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Job Description:\n${trimmedJd}\n\nCandidate Resume:\n${trimmedResume}\n\nGenerate 5 personalized screening questions.`,
        },
      ],
      { temperature: 0.4, maxTokens: 1536 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed && parsed.questions.length >= 3) {
      logger.info('Screening questions generated', {
        count: parsed.questions.length,
      });
      return { questions: parsed.questions };
    }

    logger.warn(`Screening questions attempt ${attempt + 1} failed, retrying`);
  }

  return {
    questions: [
      {
        question: 'Could you walk us through a project where you demonstrated the key skills listed on your resume?',
        focus_area: 'Experience Verification',
        why_this_matters: 'Validates the depth of claimed experience',
      },
    ],
  };
}
