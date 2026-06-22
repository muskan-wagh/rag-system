"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankCandidate = rankCandidate;
exports.rankCandidates = rankCandidates;
const skillMatcher_1 = require("./skillMatcher");
const experienceMatcher_1 = require("./experienceMatcher");
const educationMatcher_1 = require("./educationMatcher");
const explainRanking_1 = require("@/services/llm/explainRanking");
const logger_1 = require("@/utils/logger");
const WEIGHTS = {
    skill: 0.4,
    experience: 0.35,
    education: 0.25,
};
async function rankCandidate(candidate, jd) {
    const skillScore = (0, skillMatcher_1.computeSkillScore)(candidate, jd);
    const experienceScore = (0, experienceMatcher_1.computeExperienceScore)(candidate, jd);
    const educationScore = (0, educationMatcher_1.computeEducationScore)(candidate, jd);
    const overall = skillScore * WEIGHTS.skill +
        experienceScore * WEIGHTS.experience +
        educationScore * WEIGHTS.education;
    const scores = {
        skill: Math.round(skillScore * 100) / 100,
        experience: Math.round(experienceScore * 100) / 100,
        education: Math.round(educationScore * 100) / 100,
        overall: Math.round(overall * 100) / 100,
    };
    logger_1.logger.debug('Ranked candidate', {
        candidateId: candidate.id,
        scores,
    });
    const explanation = await (0, explainRanking_1.explainRanking)(candidate, jd, scores);
    return {
        candidate,
        scores,
        explanation,
    };
}
async function rankCandidates(candidates, jd) {
    logger_1.logger.info(`Ranking ${candidates.length} candidates`);
    const results = await Promise.all(candidates.map((candidate) => rankCandidate(candidate, jd)));
    results.sort((a, b) => b.scores.overall - a.scores.overall);
    logger_1.logger.info('Ranking complete', {
        topScore: results[0]?.scores.overall,
        bottomScore: results[results.length - 1]?.scores.overall,
    });
    return results;
}
//# sourceMappingURL=finalRanker.js.map