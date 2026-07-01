"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEducationScore = computeEducationScore;
const LEVEL_RANK = {
    phd: 4,
    master: 3,
    bachelor: 2,
    diploma: 1,
    any: 0,
};
const NORMALIZE_LEVEL = {
    phd: 'phd',
    doctorate: 'phd',
    'ph.d': 'phd',
    'ph.d.': 'phd',
    masters: 'master',
    master: 'master',
    "master's": 'master',
    bachelors: 'bachelor',
    bachelor: 'bachelor',
    "bachelor's": 'bachelor',
    'b.tech': 'bachelor',
    'b.e': 'bachelor',
    'm.tech': 'master',
    'm.e': 'master',
    diploma: 'diploma',
    '10th': 'diploma',
    '12th': 'diploma',
    highschool: 'diploma',
    'high school': 'diploma',
};
function normalizeLevel(level) {
    const cleaned = level.trim().toLowerCase();
    return NORMALIZE_LEVEL[cleaned] || cleaned;
}
function getLevelRank(level) {
    const normalized = normalizeLevel(level);
    return LEVEL_RANK[normalized] ?? -1;
}
function computeEducationScore(candidate, jd) {
    const jdLevel = jd.education?.level;
    const jdField = jd.education?.field?.toLowerCase();
    if (!candidate.education) {
        return 0.3;
    }
    const candidateLevel = candidate.education.level;
    const candidateField = candidate.education.field?.toLowerCase();
    if (!jdLevel || jdLevel === 'any') {
        return 0.5;
    }
    const jdRank = getLevelRank(jdLevel);
    const candidateRank = getLevelRank(candidateLevel);
    let levelScore = 0;
    if (candidateRank === -1 || jdRank === -1) {
        levelScore = 0.3;
    }
    else if (candidateRank === jdRank) {
        levelScore = 1.0;
    }
    else if (candidateRank > jdRank) {
        levelScore = 0.8;
    }
    else {
        levelScore = 0.4;
    }
    let fieldScore = 0;
    if (jdField && candidateField) {
        fieldScore =
            candidateField.includes(jdField) || jdField.includes(candidateField) ? 1.0 : 0.3;
    }
    else {
        fieldScore = 0.5;
    }
    return levelScore * 0.6 + fieldScore * 0.4;
}
//# sourceMappingURL=educationMatcher.js.map