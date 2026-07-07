import { logger } from '@/utils/logger';

interface WorkHistoryEntry {
  company: string;
  title: string;
  duration_years: number;
}

export interface FlightRiskResult {
  flight_risk: 'Low' | 'Medium' | 'High';
  growth_trajectory: 'Fast-track' | 'Steady' | 'Stagnant';
}

export function calculateFlightRisk(workHistory: WorkHistoryEntry[]): FlightRiskResult {
  let flight_risk: 'Low' | 'Medium' | 'High' = 'Medium';
  let growth_trajectory: 'Fast-track' | 'Steady' | 'Stagnant' = 'Steady';

  if (workHistory.length > 0) {
    const totalMonths = workHistory.reduce((sum, w) => sum + w.duration_years * 12, 0);
    const avgTenureMonths = totalMonths / workHistory.length;

    if (avgTenureMonths < 18) {
      flight_risk = 'High';
    } else if (avgTenureMonths <= 36) {
      flight_risk = 'Medium';
    } else {
      flight_risk = 'Low';
    }

    const promotedCount = workHistory.slice(0, Math.min(3, workHistory.length)).filter((w, i, arr) => {
      if (i === 0) return false;
      return w.title !== arr[i - 1].title;
    }).length;

    growth_trajectory = promotedCount >= 2 ? 'Fast-track' : 'Steady';
  }

  logger.debug('Flight risk calculated', { flight_risk, growth_trajectory, entries: workHistory.length });

  return { flight_risk, growth_trajectory };
}
