"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankCandidates = rankCandidates;
const skillMatcher_1 = require("./skillMatcher");
const experienceMatcher_1 = require("./experienceMatcher");
const educationMatcher_1 = require("./educationMatcher");
const logger_1 = require("@/utils/logger");
const WEIGHTS = {
    semantic: 0.4,
    skill: 0.25,
    experience: 0.2,
    education: 0.15,
};
function computeCandidateScore(candidate, jd, semanticScore = 0) {
    const skillScore = (0, skillMatcher_1.computeSkillScore)(candidate, jd);
    const experienceScore = (0, experienceMatcher_1.computeExperienceScore)(candidate, jd);
    const educationScore = (0, educationMatcher_1.computeEducationScore)(candidate, jd);
    const overall = semanticScore * WEIGHTS.semantic +
        skillScore * WEIGHTS.skill +
        experienceScore * WEIGHTS.experience +
        educationScore * WEIGHTS.education;
    const scores = {
        skill: Math.round(skillScore * 100) / 100,
        experience: Math.round(experienceScore * 100) / 100,
        education: Math.round(educationScore * 100) / 100,
        overall: Math.round(overall * 100) / 100,
    };
    return { scores };
}
async function rankCandidates(candidates, jd, semanticScores) {
    logger_1.logger.info(`Ranking ${candidates.length} candidates`);
    const scored = candidates.map((candidate) => {
        const semanticScore = semanticScores?.get(candidate.id) ?? 0;
        const { scores } = computeCandidateScore(candidate, jd, semanticScore);
        return { candidate, scores, semanticScore };
    });
    scored.sort((a, b) => b.scores.overall - a.scores.overall);
    const results = scored.map((item) => ({
        candidate: item.candidate,
        scores: item.scores,
        explanation: [
            `**Match Score: ${(item.scores.overall * 100).toFixed(0)}%**`,
            '',
            `Semantic: ${(item.semanticScore * 100).toFixed(0)}% | Skills: ${(item.scores.skill * 100).toFixed(0)}% | Experience: ${(item.scores.experience * 100).toFixed(0)}% | Education: ${(item.scores.education * 100).toFixed(0)}%`,
        ].join('\n'),
    }));
    logger_1.logger.info('Ranking complete', {
        topScore: results[0]?.scores.overall,
        bottomScore: results[results.length - 1]?.scores.overall,
    });
    return results;
}
//# sourceMappingURL=finalRanker.js.map