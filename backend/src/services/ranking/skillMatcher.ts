import { Candidate, ParsedJD } from '@/types';

export function computeSkillScore(candidate: Candidate, jd: ParsedJD): number {
  const jdSkills = new Set(jd.skills.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const candidateSkills = new Set(candidate.skills.map((s) => s.trim().toLowerCase()).filter(Boolean));

  if (jdSkills.size === 0) {
    return candidateSkills.size > 0 ? 0.5 : 0;
  }

  let intersection = 0;
  for (const skill of jdSkills) {
    if (candidateSkills.has(skill)) {
      intersection++;
    }
  }

  const union = new Set([...jdSkills, ...candidateSkills]);

  const jaccard = union.size > 0 ? intersection / union.size : 0;
  const coverage = intersection / jdSkills.size;

  return jaccard * 0.4 + coverage * 0.6;
}
