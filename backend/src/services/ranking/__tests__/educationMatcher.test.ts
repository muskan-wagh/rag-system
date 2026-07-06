import { describe, it, expect } from 'vitest';
import { computeEducationScore } from '../educationMatcher';
import type { Candidate, ParsedJD } from '@/types';

function makeCandidate(level: string, field: string): Candidate {
  return {
    id: '1', name: 'Test', skills: ['python'],
    experience: 5, education: { level, field },
    summary: '', email: '', phone: '',
  };
}

function makeJD(level: string, field: string): ParsedJD {
  return {
    title: 'Engineer', skills: ['python'],
    experience: { min: 0, max: 5 },
    education: { level, field },
    responsibilities: [], requirements: [], rawText: '',
  };
}

describe('computeEducationScore', () => {
  it('perfect match (same level and field)', () => {
    const score = computeEducationScore(makeCandidate('bachelor', 'CS'), makeJD('bachelor', 'CS'));
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('candidate overqualified gets 0.8 * 0.6 + field * 0.4', () => {
    const score = computeEducationScore(makeCandidate('master', 'CS'), makeJD('bachelor', 'CS'));
    expect(score).toBeGreaterThan(0.6);
  });

  it('candidate underqualified scores lower', () => {
    const score = computeEducationScore(makeCandidate('diploma', 'CS'), makeJD('bachelor', 'CS'));
    expect(score).toBeLessThan(0.7);
  });

  it('any JD level returns 0.5', () => {
    const score = computeEducationScore(makeCandidate('bachelor', 'CS'), makeJD('any', 'CS'));
    expect(score).toBe(0.5);
  });

  it('returns 0.3 when candidate has no education', () => {
    const candidate: Candidate = { id: '1', name: 'Test', skills: ['python'], experience: 5, education: undefined as unknown as { level: string; field: string }, summary: '', email: '', phone: '' };
    const score = computeEducationScore(candidate, makeJD('bachelor', 'CS'));
    expect(score).toBe(0.3);
  });

  it('normalizes degree variants', () => {
    const bachelor = computeEducationScore(makeCandidate("bachelor's", 'CS'), makeJD('bachelor', 'CS'));
    const btech = computeEducationScore(makeCandidate('b.tech', 'CS'), makeJD('bachelor', 'CS'));
    expect(bachelor).toBeCloseTo(1.0, 1);
    expect(btech).toBeCloseTo(1.0, 1);
  });

  it('field mismatch reduces score', () => {
    const sameField = computeEducationScore(makeCandidate('master', 'CS'), makeJD('bachelor', 'CS'));
    const diffField = computeEducationScore(makeCandidate('master', 'Mechanical'), makeJD('bachelor', 'CS'));
    expect(sameField).toBeGreaterThan(diffField);
  });

  it('returns 0.5 when JD level is missing', () => {
    const jd: ParsedJD = { ...makeJD('bachelor', 'CS'), education: { level: '', field: '' } };
    const score = computeEducationScore(makeCandidate('bachelor', 'CS'), jd);
    expect(score).toBe(0.5);
  });
});
