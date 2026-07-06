import { describe, it, expect } from 'vitest';
import { computeExperienceScore } from '../experienceMatcher';
import type { Candidate, ParsedJD } from '@/types';

function makeCandidate(experience: number): Candidate {
  return {
    id: '1', name: 'Test', skills: ['python'],
    experience, education: { level: 'bachelor', field: 'CS' },
    summary: '', email: '', phone: '',
  };
}

function makeJD(min: number, max: number): ParsedJD {
  return {
    title: 'Engineer', skills: ['python'],
    experience: { min, max },
    education: { level: 'bachelor', field: 'CS' },
    responsibilities: [], requirements: [], rawText: '',
  };
}

describe('computeExperienceScore', () => {
  it('returns 1.0 when candidate >= max', () => {
    expect(computeExperienceScore(makeCandidate(8), makeJD(2, 5))).toBe(1.0);
    expect(computeExperienceScore(makeCandidate(5), makeJD(2, 5))).toBe(1.0);
  });

  it('returns 0.5-1.0 when candidate is between min and max', () => {
    const score = computeExperienceScore(makeCandidate(3), makeJD(2, 6));
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(1.0);
  });

  it('returns 0.0-0.5 when candidate is below min', () => {
    const score = computeExperienceScore(makeCandidate(1), makeJD(3, 6));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(0.5);
  });

  it('returns 0.5 for unknown requirement (min=max=0)', () => {
    expect(computeExperienceScore(makeCandidate(5), makeJD(0, 0))).toBe(0.5);
  });

  it('returns 0 for zero experience with positive requirement', () => {
    expect(computeExperienceScore(makeCandidate(0), makeJD(3, 6))).toBe(0);
  });

  it('handles candidate with no experience against novice JD', () => {
    expect(computeExperienceScore(makeCandidate(0), makeJD(0, 2))).toBe(0.5);
  });

  it('is monotonic (more experience never hurts)', () => {
    const scores = [0, 1, 2, 3, 5, 8, 10].map((y) =>
      computeExperienceScore(makeCandidate(y), makeJD(2, 5)),
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});
