import { chatCompletion } from './client';
import { logger } from '@/utils/logger';

export interface ParsedResume {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_company: string;
  total_experience_years: number;
  skills: string[];
  education: string;
  work_history: Array<{
    company: string;
    title: string;
    duration_years: number;
    start_date: string;
    end_date: string;
  }>;
  flight_risk: 'Low' | 'Medium' | 'High';
  growth_trajectory: 'Fast-track' | 'Steady' | 'Stagnant';
}

const SYSTEM_PROMPT = `You are a resume parser and retention analyst. Extract structured information from resume text and analyze flight risk.

Return ONLY valid JSON with this exact shape:
{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "current_company": "string",
  "total_experience_years": number,
  "skills": ["string"],
  "education": "string",
  "work_history": [
    { "company": "string", "title": "string", "duration_years": number, "start_date": "YYYY-MM-DD or empty string", "end_date": "YYYY-MM-DD or empty string" }
  ],
  "flight_risk": "Low" | "Medium" | "High",
  "growth_trajectory": "Fast-track" | "Steady" | "Stagnant"
}

Rules:
- Extract email and phone precisely
- Normalize skill names to lowercase (deduplicate identical skills)
- Calculate total_experience_years from work history or explicit mention
- If a field is not found, use empty string or 0
- work_history: list all jobs with company name, title, and duration in years
- For current_company, use the most recent employer

flight_risk rules (based on average tenure per job):
- If average tenure < 1.5 years -> "High"
- If average tenure 1.5-3 years -> "Medium"
- If average tenure > 3 years -> "Low"

growth_trajectory rules:
- If clear promotions or role progression visible -> "Fast-track"
- If stable career with no major jumps -> "Steady"
- If same-level roles for extended time -> "Stagnant"`;

function tryParseJSON(raw: string): ParsedResume | null {
  try {
    return JSON.parse(raw) as ParsedResume;
  } catch {
    return null;
  }
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  logger.info('Parsing resume text', { textLength: rawText.length });

  const truncated = rawText.slice(0, 15000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract structured data from this resume:\n\n${truncated}`,
        },
      ],
      { temperature: 0.1, maxTokens: 2048 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      logger.info('Resume parsed successfully', {
        name: parsed.full_name,
        skillCount: parsed.skills.length,
      });
      return parsed;
    }

    logger.warn(`Resume parse attempt ${attempt + 1} failed, retrying`);
  }

  return {
    full_name: '',
    email: '',
    phone: '',
    location: '',
    current_company: '',
    total_experience_years: 0,
    skills: [],
    education: '',
    work_history: [],
    flight_risk: 'Medium' as const,
    growth_trajectory: 'Steady' as const,
  };
}
