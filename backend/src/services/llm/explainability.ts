import { chatCompletion } from './client';
import { logger } from '@/utils/logger';

export interface CandidateExplanation {
  strengths: string[];
  missing_skills: string[];
  recommendation: 'Strong Hire' | 'Good Fit' | 'Consider' | 'Weak Fit';
  interview_tip: string;
}

export interface ExplainabilityResult {
  [candidateId: string]: CandidateExplanation;
}

const SYSTEM_PROMPT = `You are an AI recruiter. Given a job description and candidate profiles, provide an objective assessment.

Return ONLY valid JSON where keys are candidate IDs and values are:
{
  "strengths": ["3 specific strengths matching the JD"],
  "missing_skills": ["2 most critical missing or weak skills"],
  "recommendation": "Strong Hire" | "Good Fit" | "Consider" | "Weak Fit",
  "interview_tip": "1 specific question or area to probe in the interview"
}

Rules:
- Be specific, not generic
- Base recommendations on evidence from the profiles
- Interview tips should probe potential gaps or verify strengths
- Do NOT use candidate names in the output - use the provided IDs`;

function tryParseJSON(raw: string): ExplainabilityResult | null {
  try {
    return JSON.parse(raw) as ExplainabilityResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as ExplainabilityResult; } catch {}
    }
    return null;
  }
}

export async function generateExplanations(
  jdText: string,
  candidates: Array<{ id: string; name: string; skills: string[]; experience: number; summary: string }>,
): Promise<ExplainabilityResult> {
  if (candidates.length === 0) return {};

  const topCandidates = candidates.slice(0, 5);

  logger.info('Generating explainability for candidates', { count: topCandidates.length });

  const candidatesText = topCandidates
    .map(
      (c) =>
        `ID: ${c.id}\nName: ${c.name}\nSkills: ${c.skills.join(', ')}\nExperience: ${c.experience} years\nSummary: ${c.summary.slice(0, 500)}`,
    )
    .join('\n\n---\n\n');

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Job Description:\n${jdText.slice(0, 4000)}\n\nCandidates:\n${candidatesText}`,
        },
      ],
      { temperature: 0.1, maxTokens: 2048 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      logger.info('Explanations generated', { candidateCount: Object.keys(parsed).length });
      return parsed;
    }

    logger.warn(`Explainability attempt ${attempt + 1} returned invalid JSON, retrying`);
  }

  const fallback: ExplainabilityResult = {};
  for (const c of topCandidates) {
    fallback[c.id] = {
      strengths: ['Experience matches role requirements', 'Relevant skill set'],
      missing_skills: [],
      recommendation: 'Consider',
      interview_tip: 'Ask about specific projects and contributions',
    };
  }
  return fallback;
}
