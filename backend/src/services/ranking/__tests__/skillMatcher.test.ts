import { describe, it, expect } from 'vitest';
import { computeSkillScore } from '../skillMatcher';
import type { Candidate, ParsedJD } from '@/types';

function makeCandidate(skills: string[]): Candidate {
  return {
    id: '1', name: 'Test', experience: 5,
    skills, education: { level: 'bachelor', field: 'CS' },
    summary: '', email: '', phone: '',
  };
}

function makeJD(skills: string[]): ParsedJD {
  return {
    title: 'Engineer', skills, experience: { min: 2, max: 5 },
    education: { level: 'bachelor', field: 'CS' },
    responsibilities: [], requirements: [], rawText: '',
  };
}

describe('computeSkillScore', () => {
  it('returns 1.0 for perfect match', () => {
    const score = computeSkillScore(makeCandidate(['python', 'react']), makeJD(['python', 'react']));
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('returns 0.5 for partial match', () => {
    const score = computeSkillScore(makeCandidate(['python']), makeJD(['python', 'react']));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 for no match', () => {
    const score = computeSkillScore(makeCandidate(['java']), makeJD(['python']));
    expect(score).toBe(0);
  });

  it('is case insensitive', () => {
    const a = computeSkillScore(makeCandidate(['Python']), makeJD(['python']));
    const b = computeSkillScore(makeCandidate(['python']), makeJD(['Python']));
    expect(a).toBeCloseTo(1.0, 2);
    expect(b).toBeCloseTo(1.0, 2);
  });

  it('handles empty JD skills', () => {
    const score = computeSkillScore(makeCandidate(['python']), makeJD([]));
    expect(score).toBe(0.5);
  });

  it('handles empty candidate skills', () => {
    const score = computeSkillScore(makeCandidate([]), makeJD(['python']));
    expect(score).toBe(0);
  });

  it('handles both empty', () => {
    const score = computeSkillScore(makeCandidate([]), makeJD([]));
    expect(score).toBe(0);
  });

  it('trims whitespace', () => {
    const score = computeSkillScore(makeCandidate([' python ']), makeJD(['python']));
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('coverage gives higher score than jaccard alone', () => {
    const partial = computeSkillScore(makeCandidate(['python']), makeJD(['python', 'react', 'aws']));
    const fullCoverage = computeSkillScore(makeCandidate(['python', 'java', 'c++', 'go']), makeJD(['python']));
    expect(fullCoverage).toBeGreaterThan(partial);
    expect(partial).toBeCloseTo(0.333, 2);
    expect(fullCoverage).toBeCloseTo(0.7, 2);
  });
});
