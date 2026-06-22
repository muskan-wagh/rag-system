import { Candidate, ParsedJD, RankingScore, RankingResult } from '@/types';
import { computeSkillScore } from './skillMatcher';
import { computeExperienceScore } from './experienceMatcher';
import { computeEducationScore } from './educationMatcher';
import { explainRanking } from '@/services/llm/explainRanking';
import { logger } from '@/utils/logger';

const WEIGHTS = {
  skill: 0.4,
  experience: 0.35,
  education: 0.25,
};

const LLM_EXPLAIN_TOP_N = 5;

function computeCandidateScore(candidate: Candidate, jd: ParsedJD): { scores: RankingScore } {
  const skillScore = computeSkillScore(candidate, jd);
  const experienceScore = computeExperienceScore(candidate, jd);
  const educationScore = computeEducationScore(candidate, jd);

  const overall =
    skillScore * WEIGHTS.skill +
    experienceScore * WEIGHTS.experience +
    educationScore * WEIGHTS.education;

  const scores: RankingScore = {
    skill: Math.round(skillScore * 100) / 100,
    experience: Math.round(experienceScore * 100) / 100,
    education: Math.round(educationScore * 100) / 100,
    overall: Math.round(overall * 100) / 100,
  };

  return { scores };
}

export async function rankCandidates(
  candidates: Candidate[],
  jd: ParsedJD,
): Promise<RankingResult[]> {
  logger.info(`Ranking ${candidates.length} candidates`);

  const scored = candidates.map((candidate) => ({
    candidate,
    ...computeCandidateScore(candidate, jd),
  }));

  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  const results = await Promise.all(
    scored.map((item, i) => {
      if (i < LLM_EXPLAIN_TOP_N) {
        return explainRanking(item.candidate, jd, item.scores).then((explanation) => ({
          candidate: item.candidate,
          scores: item.scores,
          explanation,
        }));
      }
      return {
        candidate: item.candidate,
        scores: item.scores,
        explanation: `**Match Score: ${(item.scores.overall * 100).toFixed(0)}%**\n\nSkill match: ${(item.scores.skill * 100).toFixed(0)}%, Experience match: ${(item.scores.experience * 100).toFixed(0)}%, Education match: ${(item.scores.education * 100).toFixed(0)}%`,
      };
    }),
  );

  logger.info('Ranking complete', {
    topScore: results[0]?.scores.overall,
    bottomScore: results[results.length - 1]?.scores.overall,
    llmExplanations: Math.min(LLM_EXPLAIN_TOP_N, results.length),
  });

  return results;
}
