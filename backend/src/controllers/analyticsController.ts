import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getAllCandidates } from '@/services/qdrant/getAllCandidates';
import { logger } from '@/utils/logger';

const EXPERIENCE_BUCKETS = [
  { label: '0-2 years', min: 0, max: 2 },
  { label: '3-5 years', min: 3, max: 5 },
  { label: '6-8 years', min: 6, max: 8 },
  { label: '9-11 years', min: 9, max: 11 },
  { label: '12+ years', min: 12, max: Infinity },
];

const EDUCATION_NORMALIZE: Record<string, string> = {
  phd: 'PhD',
  doctorate: 'PhD',
  'ph.d': 'PhD',
  'ph.d.': 'PhD',
  masters: "Master's",
  master: "Master's",
  "master's": "Master's",
  bachelors: "Bachelor's",
  bachelor: "Bachelor's",
  "bachelor's": "Bachelor's",
  'b.tech': "Bachelor's",
  'b.e': "Bachelor's",
  'm.tech': "Master's",
  'm.e': "Master's",
  diploma: 'Diploma',
  '10th': 'Diploma',
  '12th': 'Diploma',
  highschool: 'Diploma',
  'high school': 'Diploma',
};

function normalizeEducationLevel(level: string): string {
  const cleaned = level.trim().toLowerCase();
  return EDUCATION_NORMALIZE[cleaned] || level;
}

export const getAnalyticsHandler = asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Fetching analytics data');

  const candidates = await getAllCandidates();

  const totalCandidates = candidates.length;

  const totalExperience = candidates.reduce((sum, c) => sum + c.experience, 0);
  const avgExperience = totalCandidates > 0 ? Math.round((totalExperience / totalCandidates) * 10) / 10 : 0;

  const skillCounts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const skill of candidate.skills) {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    }
  }

  const skills = Array.from(skillCounts.entries())
    .map(([skill, count]) => ({
      skill,
      count,
      percentage: totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topSkills = skills.slice(0, 5);

  const experienceDistribution = EXPERIENCE_BUCKETS.map((bucket) => ({
    range: bucket.label,
    count: candidates.filter(
      (c) => c.experience >= bucket.min && c.experience <= bucket.max,
    ).length,
  }));

  const educationCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const level = normalizeEducationLevel(candidate.education.level);
    educationCounts.set(level, (educationCounts.get(level) || 0) + 1);
  }

  const educationDistribution = Array.from(educationCounts.entries())
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count);

  const data = {
    totalCandidates,
    avgExperience,
    skills,
    topSkills,
    experienceDistribution,
    educationDistribution,
  };

  logger.info('Analytics computed', { totalCandidates, uniqueSkills: skills.length });

  res.status(200).json({ success: true, data });
});
