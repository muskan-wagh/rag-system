import crypto from 'crypto';
import { chatCompletion } from './client';
import { Candidate, ParsedJD, CompareResult, ComparisonCandidateInsight } from '@/types';
import { logger } from '@/utils/logger';
import { getCached, setCache } from '@/utils/cache';

const CACHE_TTL = 300_000;

const SYSTEM_PROMPT = `You are a senior recruitment analyst comparing candidates for a specific role.

Given a job description and multiple candidate profiles, produce a structured analysis.

Return ONLY valid JSON. No markdown, no code fences, no extra text. No trailing commas.

Schema:
{
  "comparisons": [
    {
      "candidateId": "uuid",
      "scores": {
        "overall": 0-100,
        "technical": 0-100,
        "experience": 0-100,
        "education": 0-100,
        "culture": 0-100,
        "leadership": 0-100,
        "communication": 0-100
      },
      "strengths": ["string"],
      "weaknesses": ["string"],
      "missingSkills": ["skill not in candidate profile but important for the role"],
      "risks": ["hiring risk statements"],
      "verdict": "1-2 sentence verdict"
    }
  ],
  "recommendation": {
    "candidateId": "uuid",
    "reasoning": "detailed explanation"
  },
  "summary": "executive summary of the comparison",
  "interviewQuestions": [
    "specific question for candidate 1",
    "specific question for candidate 2"
  ],
  "skillOverlap": {
    "shared": ["skill1", "skill2"],
    "unique": { "candidateId1": ["unique skill"], "candidateId2": ["unique skill"] }
  }
}

Scoring guidelines:
- overall: weighted combination of all dimensions
- technical: proficiency in required tech stack and tools
- experience: relevance and depth of work history
- education: degree level, field relevance, certifications
- culture: alignment with team/company values inferred from background
- leadership: team lead, mentorship, ownership signals
- communication: clarity of resume writing, articulation

Be objective and data-driven. Base scores ONLY on information in the candidate profiles.`;

interface CompareAiJson {
  comparisons: Array<{
    candidateId: string;
    scores: {
      overall: number;
      technical: number;
      experience: number;
      education: number;
      culture: number;
      leadership: number;
      communication: number;
    };
    strengths: string[];
    weaknesses: string[];
    missingSkills: string[];
    risks: string[];
    verdict: string;
  }>;
  recommendation: {
    candidateId: string;
    reasoning: string;
  };
  summary: string;
  interviewQuestions: string[];
  skillOverlap: {
    shared: string[];
    unique: Record<string, string[]>;
  };
}

function findCandidateName(candidateId: string, candidates: Candidate[]): string {
  const c = candidates.find(c => c.id === candidateId);
  return c?.name || candidateId;
}

function computeSkillOverlap(candidates: Candidate[]): { shared: string[]; unique: Record<string, string[]> } {
  if (candidates.length === 0) return { shared: [], unique: {} };

  const allSkillSets = candidates.map(c => new Set(c.skills.map(s => s.toLowerCase().trim())));

  const shared: string[] = [];
  const firstSet = allSkillSets[0];
  if (firstSet) {
    for (const skill of firstSet) {
      if (allSkillSets.every(set => set.has(skill))) {
        shared.push(skill);
      }
    }
  }

  const unique: Record<string, string[]> = {};
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const others = allSkillSets.filter((_, j) => j !== i);
    const candidateSkills = allSkillSets[i];
    const uniqueSkills: string[] = [];
    if (candidateSkills) {
      for (const skill of candidateSkills) {
        if (others.every(set => !set.has(skill))) {
          uniqueSkills.push(skill);
        }
      }
    }
    unique[candidate.id] = uniqueSkills;
  }

  return { shared, unique };
}

function compareCacheKey(jdText: string, candidateIds: string[]): string {
  const jdHash = crypto.createHash('md5').update(jdText).digest('hex');
  const ids = [...candidateIds].sort().join(',');
  return `compare:${jdHash}:${ids}`;
}

export async function compareCandidates(
  candidates: Candidate[],
  jd: ParsedJD,
  jdText: string,
): Promise<CompareResult> {
  const candidateIds = candidates.map(c => c.id);
  const cacheKey = compareCacheKey(jdText, candidateIds);

  const cached = await getCached<CompareResult>(cacheKey);
  if (cached) {
    logger.info('Compare cache hit', { cacheKey });
    return cached;
  }
  logger.info('Compare cache miss', { cacheKey, candidateCount: candidates.length, jdTitle: jd.title });

  const candidatesText = candidates.map((c, i) => `
Candidate ${i + 1} (ID: ${c.id}):
Name: ${c.name}
Skills: ${c.skills.join(', ')}
Experience: ${c.experience} years
Education: ${c.education.level} in ${c.education.field}${c.education.details ? ` - ${c.education.details}` : ''}
Summary: ${c.summary}
`).join('\n---\n');

  const prompt = `Job Description Title: ${jd.title}
Required Skills: ${jd.skills.join(', ')}
Required Experience: ${jd.experience.min}-${jd.experience.max} years
Required Education: ${jd.education.level} in ${jd.education.field}
Responsibilities: ${jd.responsibilities.join(', ')}
Requirements: ${jd.requirements.join(', ')}

Candidates:
${candidatesText}

Compare these candidates for this role.`;

  let result: CompareResult | null = null;
  let lastRawContent = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ], { temperature: attempt === 0 ? 0.1 : 0.3, maxTokens: 4096 });

    lastRawContent = response.content;
    logger.debug('Raw LLM response captured', {
      attempt: attempt + 1,
      length: lastRawContent.length,
    });

    const parsed = extractCompareJson(lastRawContent);
    if (parsed) {
      result = buildCompareResult(parsed, candidates);
      break;
    }
    logger.warn(`Compare parse attempt ${attempt + 1} failed validation, retrying`);
  }

  if (!result) {
    logger.warn('All LLM attempts failed validation, computing fallback result');
    result = buildFallbackResult(candidates, jd);
  }

  await setCache(cacheKey, result, CACHE_TTL).catch(() => {});
  logger.info('Candidate comparison generated');
  return result;
}

function extractCompareJson(raw: string): CompareAiJson | null {
  const cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/\s*```/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const lastBrace = cleaned.lastIndexOf('}');
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.comparisons) || parsed.comparisons.length === 0) return null;
  if (typeof parsed.recommendation !== 'object' || !parsed.recommendation.candidateId) return null;
  if (typeof parsed.summary !== 'string') return null;

  for (const c of parsed.comparisons) {
    if (typeof c.candidateId !== 'string') return null;
    if (typeof c.scores !== 'object' || typeof c.scores.overall !== 'number') return null;
    if (!Array.isArray(c.strengths)) return null;
    if (!Array.isArray(c.weaknesses)) return null;
    if (typeof c.verdict !== 'string') return null;
  }

  return parsed as CompareAiJson;
}

function buildCompareResult(ai: CompareAiJson, candidates: Candidate[]): CompareResult {
  const insights: ComparisonCandidateInsight[] = ai.comparisons.map(ac => {
    const candidate = candidates.find(c => c.id === ac.candidateId);
    return {
      candidateId: ac.candidateId,
      name: candidate?.name || findCandidateName(ac.candidateId, candidates),
      title: '',
      company: '',
      location: '',
      experience: candidate?.experience || 0,
      education: candidate?.education || { level: '', field: '' },
      skills: candidate?.skills || [],
      scores: {
        overall: clampScore(ac.scores.overall),
        technical: clampScore(ac.scores.technical),
        experience: clampScore(ac.scores.experience),
        education: clampScore(ac.scores.education),
        culture: clampScore(ac.scores.culture),
        leadership: clampScore(ac.scores.leadership),
        communication: clampScore(ac.scores.communication),
      },
      strengths: ac.strengths || [],
      weaknesses: ac.weaknesses || [],
      missingSkills: ac.missingSkills || [],
      risks: ac.risks || [],
      verdict: ac.verdict || '',
    };
  });

  const overlap = computeSkillOverlap(candidates);

  return {
    candidates: insights,
    recommendation: {
      candidateId: ai.recommendation.candidateId,
      reasoning: ai.recommendation.reasoning,
    },
    summary: ai.summary,
    interviewQuestions: ai.interviewQuestions || [],
    skillOverlap: ai.skillOverlap || overlap,
  };
}

function buildFallbackResult(candidates: Candidate[], jd: ParsedJD): CompareResult {
  const insights: ComparisonCandidateInsight[] = candidates.map(c => ({
    candidateId: c.id,
    name: c.name,
    title: '',
    company: '',
    location: '',
    experience: c.experience,
    education: c.education,
    skills: c.skills,
    scores: {
      overall: 50,
      technical: 50,
      experience: 50,
      education: 50,
      culture: 50,
      leadership: 50,
      communication: 50,
    },
    strengths: [],
    weaknesses: [],
    missingSkills: jd.skills.filter(s => !c.skills.some(cs => cs.toLowerCase() === s.toLowerCase())),
    risks: [],
    verdict: 'Unable to generate AI analysis. Please review the candidate profiles manually.',
  }));

  const overlap = computeSkillOverlap(candidates);

  return {
    candidates: insights,
    recommendation: {
      candidateId: candidates[0]?.id || '',
      reasoning: 'AI analysis unavailable. Review the comparison data manually.',
    },
    summary: 'AI-powered comparison could not be completed. Showing basic profile comparison instead.',
    interviewQuestions: [],
    skillOverlap: overlap,
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
