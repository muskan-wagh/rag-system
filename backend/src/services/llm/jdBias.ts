import { chatCompletion } from './client';
import { logger } from '@/utils/logger';

export interface BiasIssue {
  category: string;
  text: string;
  suggestion: string;
}

export interface BiasResult {
  has_bias: boolean;
  issues: BiasIssue[];
  suggestions: string[];
}

const SYSTEM_PROMPT = `You are a job description bias auditor. Analyze the given job description for potential bias.

Return ONLY valid JSON with this exact shape:
{
  "has_bias": boolean,
  "issues": [
    {
      "category": "gender|age|education|experience|language|other",
      "text": "the biased phrase or requirement",
      "suggestion": "how to make it more inclusive"
    }
  ],
  "suggestions": ["overall suggestion 1", "overall suggestion 2"]
}

Look for:
- Gendered language (ninja, rockstar, aggressive, assertive, etc.)
- Age bias (recent grad, digital native, years of experience range)
- Unnecessary requirements (specific degrees not relevant to role)
- Ableist language (walk-in, stand-up)
- Cultural bias (culture fit, must speak X dialect)
- Overly aggressive personality traits`;

function tryParseJSON(raw: string): BiasResult | null {
  try {
    return JSON.parse(raw) as BiasResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as BiasResult; } catch {}
    }
    return null;
  }
}

export async function scanBias(jdText: string): Promise<BiasResult> {
  logger.info('Scanning JD for bias', { textLength: jdText.length });

  const truncated = jdText.slice(0, 8000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this job description for bias:\n\n${truncated}` },
      ],
      { temperature: 0.1, maxTokens: 1024 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      logger.info('Bias scan complete', { hasBias: parsed.has_bias, issueCount: parsed.issues.length });
      return parsed;
    }

    logger.warn(`Bias scan attempt ${attempt + 1} returned invalid JSON, retrying`);
  }

  return { has_bias: false, issues: [], suggestions: [] };
}
