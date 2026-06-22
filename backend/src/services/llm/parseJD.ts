import { chatCompletion } from './client';
import { ParsedJD } from '@/types';
import { logger } from '@/utils/logger';

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

export async function parseJD(jdText: string): Promise<ParsedJD> {
  logger.info('Parsing job description', { textLength: jdText.length });

  const response = await chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: jdText },
  ], { temperature: 0.1 });

  const parsed: ParsedJD = JSON.parse(response.content);

  logger.info('JD parsed successfully', {
    title: parsed.title,
    skillCount: parsed.skills.length,
    experienceRange: `${parsed.experience.min}-${parsed.experience.max}`,
  });

  return parsed;
}
