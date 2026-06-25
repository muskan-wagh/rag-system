import { chatCompletion } from './client';
import { Candidate, ParsedJD, RankingScore } from '@/types';
import { logger } from '@/utils/logger';

const SYSTEM_PROMPT = `You are a recruitment analyst. Given a job description, a candidate profile, and matching scores, provide a concise explanation of why this candidate is a good fit (or not).

Return ONLY valid JSON with this shape:
{
  "strengths": ["string"],
  "weaknesses": ["string"],
  "summary": "string (2-3 sentences)"
}

Focus on concrete skills and experience gaps. Be honest about weaknesses.`;

interface ExplanationJson {
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

function tryParseExplanation(raw: string): ExplanationJson | null {
  try {
    const parsed = JSON.parse(raw) as ExplanationJson;
    if (
      Array.isArray(parsed.strengths) &&
      Array.isArray(parsed.weaknesses) &&
      typeof parsed.summary === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function explainRanking(
  candidate: Candidate,
  jd: ParsedJD,
  scores: RankingScore,
): Promise<string> {
  logger.info('Generating ranking explanation', {
    candidateId: candidate.id,
    overallScore: scores.overall,
  });

  const prompt = `Job Description Title: ${jd.title}
Required Skills: ${jd.skills.join(', ')}
Required Experience: ${jd.experience.min}-${jd.experience.max} years
Required Education: ${jd.education.level} in ${jd.education.field}

Candidate Name: ${candidate.name}
Candidate Skills: ${candidate.skills.join(', ')}
Candidate Experience: ${candidate.experience} years
Candidate Education: ${candidate.education.level} in ${candidate.education.field}
Candidate Summary: ${candidate.summary}

Scores (0-1):
- Skill Match: ${scores.skill.toFixed(2)}
- Experience Match: ${scores.experience.toFixed(2)}
- Education Match: ${scores.education.toFixed(2)}
- Overall: ${scores.overall.toFixed(2)}

Provide a ranking explanation.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ], { temperature: 0.3, maxTokens: 512 });

    const parsed = tryParseExplanation(response.content);
    if (parsed) {
      const explanation = [
        `**Match Score: ${(scores.overall * 100).toFixed(0)}%**`,
        '',
        '**Strengths:**',
        ...parsed.strengths.map((s: string) => `- ${s}`),
        '',
        '**Weaknesses:**',
        ...parsed.weaknesses.map((w: string) => `- ${w}`),
        '',
        '**Summary:**',
        parsed.summary,
      ].join('\n');

      logger.info('Ranking explanation generated', {
        strengthsCount: parsed.strengths.length,
        weaknessesCount: parsed.weaknesses.length,
      });

      return explanation;
    }

    logger.warn(`Explanation parse attempt ${attempt + 1} failed, retrying`);
  }

  return [
    `**Match Score: ${(scores.overall * 100).toFixed(0)}%**`,
    '',
    `Skill match: ${(scores.skill * 100).toFixed(0)}%`,
    `Experience match: ${(scores.experience * 100).toFixed(0)}%`,
    `Education match: ${(scores.education * 100).toFixed(0)}%`,
  ].join('\n');
}
