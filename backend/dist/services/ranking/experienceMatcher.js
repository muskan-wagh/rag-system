"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeExperienceScore = computeExperienceScore;
function computeExperienceScore(candidate, jd) {
    const candidateYoe = candidate.experience;
    const { min, max } = jd.experience;
    if (min === 0 && max === 0) {
        return 0.5;
    }
    if (candidateYoe >= max) {
        return 1.0;
    }
    if (candidateYoe >= min) {
        const range = max - min;
        if (range === 0) {
            return candidateYoe >= min ? 1.0 : 0.5;
        }
        return 0.5 + 0.5 * ((candidateYoe - min) / range);
    }
    if (min > 0) {
        return 0.5 * (candidateYoe / min);
    }
    return 0;
}
//# sourceMappingURL=experienceMatcher.js.map