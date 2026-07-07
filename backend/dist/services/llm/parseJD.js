"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJD = parseJD;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("./client");
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/middleware/errorHandler");
const errorCodes_1 = require("@/middleware/errorCodes");
const jdCache = new Map();
const CACHE_TTL = 300_000;
const SYSTEM_PROMPT = `You are a job description parser. Extract structured information from job descriptions.
Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "skills": ["string"],
  "experience": { "min": number, "max": number },
  "education": { "level": "string", "field": "string" },
  "responsibilities": ["string"],
  "requirements": ["string"]
}

Rules:
- Extract all mentioned skills (technical and soft skills)
- Normalize skill names to lowercase
- For experience: if "X+ years" set min=X, max=10; if "X-Y years" set min=X, max=Y; if not specified set min=0, max=0
- For education level: "bachelor", "master", "phd", "diploma", or "any"
- For education field: the field of study
- If information is not present, use empty strings or arrays`;
function tryParseJSON(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function parseJD(jdText) {
    const cacheKey = `jd:${crypto_1.default.createHash('md5').update(jdText).digest('hex')}`;
    const cached = jdCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
        return cached.value;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await (0, client_1.chatCompletion)([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: jdText },
        ], { temperature: 0.1 });
        const parsed = tryParseJSON(response.content);
        if (parsed) {
            jdCache.set(cacheKey, { value: parsed, expiry: Date.now() + CACHE_TTL });
            return parsed;
        }
        logger_1.logger.warn(`JD parse attempt ${attempt + 1} returned invalid JSON, retrying`);
    }
    throw new errorHandler_1.AppError('Failed to parse JD: LLM returned invalid JSON after 3 attempts', 502, errorCodes_1.ErrorCodes.AI_ERROR);
}
//# sourceMappingURL=parseJD.js.map