"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareCandidates = compareCandidates;
const client_1 = require("./client");
const logger_1 = require("@/utils/logger");
const SYSTEM_PROMPT = `You are a recruitment analyst comparing candidates for a job. Given a job description and multiple candidate profiles, provide a detailed comparison.

Return ONLY valid JSON with this exact shape:
{
  "comparisons": [
    {
      "candidateId": "string",
      "advantages": ["string"],
      "disadvantages": ["string"],
      "verdict": "string"
    }
  ],
  "recommendation": "string (which candidate is best and why)",
  "summary": "string (overall comparison summary)"
}

Be objective and data-driven.`;
function tryParseCompare(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.comparisons) &&
            typeof parsed.recommendation === 'string' &&
            typeof parsed.summary === 'string') {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
function formatComparison(data) {
    const lines = [];
    for (const c of data.comparisons) {
        const candidateName = c.candidateId;
        lines.push(`## ${candidateName}`);
        lines.push('');
        lines.push('### Advantages');
        for (const a of c.advantages) {
            lines.push(`- ${a}`);
        }
        lines.push('');
        lines.push('### Disadvantages');
        for (const d of c.disadvantages) {
            lines.push(`- ${d}`);
        }
        lines.push('');
        lines.push(`**Verdict:** ${c.verdict}`);
        lines.push('');
        lines.push('---');
        lines.push('');
    }
    lines.push(`## Recommendation\n\n${data.recommendation}`);
    lines.push('');
    lines.push(`## Summary\n\n${data.summary}`);
    return lines.join('\n');
}
async function compareCandidates(candidates, jd) {
    logger_1.logger.info('Comparing candidates', {
        candidateCount: candidates.length,
        jdTitle: jd.title,
    });
    const candidatesText = candidates.map((c, i) => `
Candidate ${i + 1} (ID: ${c.id}):
Name: ${c.name}
Skills: ${c.skills.join(', ')}
Experience: ${c.experience} years
Education: ${c.education.level} in ${c.education.field}
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
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await (0, client_1.chatCompletion)([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ], { temperature: 0.3, maxTokens: 2048 });
        const parsed = tryParseCompare(response.content);
        if (parsed) {
            logger_1.logger.info('Candidate comparison generated');
            return formatComparison(parsed);
        }
        logger_1.logger.warn(`Compare parse attempt ${attempt + 1} failed, retrying`);
    }
    logger_1.logger.warn('Falling back to raw comparison output after failed parses');
    return 'Comparison could not be generated. Please try again.';
}
//# sourceMappingURL=compareCandidates.js.map