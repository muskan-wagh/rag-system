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

export async function rankCandidate(
  candidate: Candidate,
  jd: ParsedJD,
): Promise<RankingResult> {
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

  logger.debug('Ranked candidate', {
    candidateId: candidate.id,
    scores,
  });

  const explanation = await explainRanking(candidate, jd, scores);

  return {
    candidate,
    scores,
    explanation,
  };
}

export async function rankCandidates(
  candidates: Candidate[],
  jd: ParsedJD,
): Promise<RankingResult[]> {
  logger.info(`Ranking ${candidates.length} candidates`);

  const results = await Promise.all(
    candidates.map((candidate) => rankCandidate(candidate, jd)),
  );

  results.sort((a, b) => b.scores.overall - a.scores.overall);

  logger.info('Ranking complete', {
    topScore: results[0]?.scores.overall,
    bottomScore: results[results.length - 1]?.scores.overall,
  });

  return results;
}
