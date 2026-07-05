import { chatCompletion } from './client';
import { logger } from '@/utils/logger';
import type { ParsedResume } from './parseResume';

export interface FlightRiskAnalysis {
  flight_risk: 'Low' | 'Medium' | 'High';
  growth_trajectory: 'Fast-track' | 'Steady' | 'Stagnant';
}

const SYSTEM_PROMPT = `You are a retention analyst. Analyze a candidate's work history and resume to predict flight risk and growth trajectory.

Return ONLY valid JSON with this exact shape:
{
  "flight_risk": "Low" | "Medium" | "High",
  "growth_trajectory": "Fast-track" | "Steady" | "Stagnant",
  "reasoning": "string (1 sentence)"
}

Rules for flight_risk:
- If average tenure per job < 1.5 years -> "High"
- If average tenure 1.5-3 years -> "Medium"
- If average tenure > 3 years -> "Low"

Rules for growth_trajectory:
- If clear promotions or role progression visible -> "Fast-track"
- If stable career with no major jumps -> "Steady"
- If same-level roles for extended time -> "Stagnant"`;

interface FlightRiskResponse {
  flight_risk: 'Low' | 'Medium' | 'High';
  growth_trajectory: 'Fast-track' | 'Steady' | 'Stagnant';
  reasoning: string;
}

function tryParseJSON(raw: string): FlightRiskResponse | null {
  try {
    return JSON.parse(raw) as FlightRiskResponse;
  } catch {
    return null;
  }
}

export async function analyzeFlightRisk(
  rawResumeText: string,
  parsed: ParsedResume,
): Promise<FlightRiskAnalysis> {
  logger.info('Analyzing flight risk');

  const workHistoryText = parsed.work_history.length > 0
    ? parsed.work_history
        .map((w) => `- ${w.title} at ${w.company} (${w.duration_years} years)`)
        .join('\n')
    : 'No structured work history available';

  const resumePreview = rawResumeText.slice(0, 8000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Work History:\n${workHistoryText}\n\nFull Resume:\n${resumePreview}\n\nAnalyze flight risk and growth trajectory.`,
        },
      ],
      { temperature: 0.1, maxTokens: 512 },
    );

    const parsed = tryParseJSON(response.content);
    if (parsed) {
      logger.info('Flight risk analyzed', {
        risk: parsed.flight_risk,
        trajectory: parsed.growth_trajectory,
      });
      return {
        flight_risk: parsed.flight_risk,
        growth_trajectory: parsed.growth_trajectory,
      };
    }

    logger.warn(`Flight risk attempt ${attempt + 1} failed, retrying`);
  }

  return { flight_risk: 'Medium', growth_trajectory: 'Steady' };
}
