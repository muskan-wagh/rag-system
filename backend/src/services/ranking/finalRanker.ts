import { Candidate, ParsedJD, RankingScore, RankingResult } from '@/types';
import { computeSkillScore } from './skillMatcher';
import { computeExperienceScore } from './experienceMatcher';
import { computeEducationScore } from './educationMatcher';
import { logger } from '@/utils/logger';

const WEIGHTS = {
  semantic: 0.4,
  skill: 0.25,
  experience: 0.2,
  education: 0.15,
};

function computeCandidateScore(
  candidate: Candidate,
  jd: ParsedJD,
  semanticScore: number = 0,
): { scores: RankingScore } {
  const skillScore = computeSkillScore(candidate, jd);
  const experienceScore = computeExperienceScore(candidate, jd);
  const educationScore = computeEducationScore(candidate, jd);

  const overall =
    semanticScore * WEIGHTS.semantic +
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
  semanticScores?: Map<string, number>,
): Promise<RankingResult[]> {
  logger.info(`Ranking ${candidates.length} candidates`);

  const scored = candidates.map((candidate) => {
    const semanticScore = semanticScores?.get(candidate.id) ?? 0;
    const { scores } = computeCandidateScore(candidate, jd, semanticScore);
    return { candidate, scores, semanticScore };
  });

  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  const results: RankingResult[] = scored.map((item) => ({
    candidate: item.candidate,
    scores: item.scores,
    explanation: [
      `**Match Score: ${(item.scores.overall * 100).toFixed(0)}%**`,
      '',
      `Semantic: ${(item.semanticScore * 100).toFixed(0)}% | Skills: ${(item.scores.skill * 100).toFixed(0)}% | Experience: ${(item.scores.experience * 100).toFixed(0)}% | Education: ${(item.scores.education * 100).toFixed(0)}%`,
    ].join('\n'),
  }));

  logger.info('Ranking complete', {
    topScore: results[0]?.scores.overall,
    bottomScore: results[results.length - 1]?.scores.overall,
  });

  return results;
}
