import crypto from 'crypto';
import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';
import { config } from '@/config';

const CACHE_TTL = 3_600_000;

export interface HiringBrief {
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  hiringRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high' }>;
  confidenceScore: number;
  recommendation: 'Strong Hire' | 'Good Fit' | 'Consider' | 'Weak Fit';
  interviewQuestions: {
    technical: string[];
    behavioral: string[];
  };
  followUpTopics: string[];
}

const SYSTEM_PROMPT = `You are an expert technical recruiter. Given a job description and a candidate's resume, provide a structured hiring brief.

Return ONLY valid JSON with this exact structure:
{
  "executive_summary": "2-3 sentence assessment of candidate fit for this role",
  "strengths": ["3-5 specific strengths that directly match job requirements"],
  "weaknesses": ["2-3 specific areas where the candidate falls short"],
  "missing_skills": ["top 3 most critical missing or weak skills for this role"],
  "hiring_risks": [
    {"risk": "description of specific risk", "severity": "low|medium|high"}
  ],
  "confidence_score": 0.0-1.0,
  "recommendation": "Strong Hire|Good Fit|Consider|Weak Fit",
  "interview_questions": {
    "technical": ["3-4 technical questions to verify depth of expertise"],
    "behavioral": ["2-3 behavioral questions to assess culture fit and soft skills"]
  },
  "follow_up_topics": ["2-3 topics that need further discussion before decision"]
}

Rules:
- Be specific and reference actual skills and experiences from the resume
- Do not make up information not present in the resume
- Confidence score reflects how much evidence exists to evaluate (higher = more data available)
- Hiring risks should be about retention, growth, culture, or skill gaps — not generic concerns
- If no job description is provided, evaluate against the candidate's career trajectory`;

function tryParseJSON(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as Record<string, unknown>; } catch {}
    }
    return null;
  }
}

function briefCacheKey(jdText: string, candidateName: string, resumeText: string): string {
  const hash = crypto.createHash('md5').update(jdText + resumeText).digest('hex');
  return `brief:${candidateName}:${hash}`;
}

export async function generateHiringBrief(
  jdText: string,
  resumeText: string,
  candidateName: string,
  skills: string[],
  experience: number,
): Promise<HiringBrief> {
  const cacheKey = briefCacheKey(jdText, candidateName, resumeText);

  const cached = await getCached<HiringBrief>(cacheKey);
  if (cached) {
    logger.info('Brief cache hit', { cacheKey });
    return cached;
  }
  logger.info('Brief cache miss', { cacheKey, candidate: candidateName });

  const resumePreview = resumeText.slice(0, 4000);
  const jdPreview = jdText ? jdText.slice(0, 4000) : 'No job description provided';

  const userPrompt = `Job Description:\n${jdPreview}\n\n---\n\nCandidate: ${candidateName}\nSkills: ${skills.join(', ')}\nExperience: ${experience} years\n\nResume:\n${resumePreview}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.1,
          maxTokens: 2048,
          model: config.openai.premiumModel,
        },
      );

      const parsed = tryParseJSON(response.content);
      if (parsed) {
        const p = parsed;
        const brief: HiringBrief = {
          executiveSummary: String(p.executive_summary || ''),
          strengths: Array.isArray(p.strengths) ? (p.strengths as string[]) : [],
          weaknesses: Array.isArray(p.weaknesses) ? (p.weaknesses as string[]) : [],
          missingSkills: Array.isArray(p.missing_skills) ? (p.missing_skills as string[]) : [],
          hiringRisks: Array.isArray(p.hiring_risks) ? (p.hiring_risks as Array<{ risk: string; severity: 'low' | 'medium' | 'high' }>) : [],
          confidenceScore: Math.min(1, Math.max(0, Number(p.confidence_score) || 0.5)),
          recommendation: validateRecommendation(String(p.recommendation || '')),
          interviewQuestions: {
            technical: Array.isArray((p.interview_questions as Record<string, unknown>)?.technical) ? ((p.interview_questions as Record<string, unknown>).technical as string[]) : [],
            behavioral: Array.isArray((p.interview_questions as Record<string, unknown>)?.behavioral) ? ((p.interview_questions as Record<string, unknown>).behavioral as string[]) : [],
          },
          followUpTopics: Array.isArray(p.follow_up_topics) ? (p.follow_up_topics as string[]) : [],
        };

        await setCache(cacheKey, brief, CACHE_TTL).catch(() => {});
        logger.info('Hiring brief generated', { candidate: candidateName });
        return brief;
      }

      logger.warn(`Brief generation attempt ${attempt + 1} returned invalid JSON, retrying`);
    } catch (error) {
      logger.error('Brief generation failed', { error: error instanceof Error ? error.message : String(error) });
      if (attempt === 2) throw error;
    }
  }

  throw new Error('Failed to generate hiring brief after 3 attempts');
}

function validateRecommendation(val: string): HiringBrief['recommendation'] {
  const valid: HiringBrief['recommendation'][] = ['Strong Hire', 'Good Fit', 'Consider', 'Weak Fit'];
  return valid.includes(val as any) ? (val as HiringBrief['recommendation']) : 'Consider';
}
