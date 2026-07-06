import { describe, it, expect } from 'vitest';
import { rankCandidates } from '../finalRanker';
import type { Candidate, ParsedJD } from '@/types';

const baseCandidate: Candidate = {
  id: '1', name: 'Alice', skills: ['python', 'react', 'aws'],
  experience: 5, education: { level: 'master', field: 'CS' },
  summary: 'Experienced engineer', email: '', phone: '',
};

const baseJD: ParsedJD = {
  title: 'Full Stack Engineer', skills: ['python', 'react', 'aws'],
  experience: { min: 3, max: 7 },
  education: { level: 'bachelor', field: 'CS' },
  responsibilities: ['Build features'], requirements: ['5 years exp'],
  rawText: '',
};

describe('rankCandidates', () => {
  it('sorts candidates by overall score descending', async () => {
    const candidates: Candidate[] = [
      { ...baseCandidate, id: '1', name: 'Alice', skills: ['python', 'react', 'aws'], experience: 5 },
      { ...baseCandidate, id: '2', name: 'Bob', skills: ['python'], experience: 1 },
      { ...baseCandidate, id: '3', name: 'Charlie', skills: ['java'], experience: 10 },
    ];

    const results = await rankCandidates(candidates, baseJD);

    expect(results).toHaveLength(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].scores.overall).toBeGreaterThanOrEqual(results[i].scores.overall);
    }
  });

  it('Alice should rank highest (best match)', async () => {
    const candidates: Candidate[] = [
      { ...baseCandidate, id: '1', name: 'Alice', skills: ['python', 'react', 'aws'], experience: 5 },
      { ...baseCandidate, id: '2', name: 'Bob', skills: ['excel'], experience: 2 },
    ];

    const results = await rankCandidates(candidates, baseJD);
    expect(results[0].candidate.name).toBe('Alice');
  });

  it('incorporates semantic scores when provided', async () => {
    const candidates: Candidate[] = [
      { ...baseCandidate, id: '1', name: 'Alice', skills: ['python'], experience: 3 },
      { ...baseCandidate, id: '2', name: 'Bob', skills: ['python'], experience: 3 },
    ];

    const semanticScores = new Map(Object.entries({ '1': 0.9, '2': 0.1 }));
    const results = await rankCandidates(candidates, baseJD, semanticScores);
    expect(results[0].candidate.name).toBe('Alice');
  });

  it('returns explanations with score breakdown', async () => {
    const results = await rankCandidates([baseCandidate], baseJD);
    expect(results[0].explanation).toContain('Match Score');
    expect(results[0].explanation).toContain('Semantic');
    expect(results[0].explanation).toContain('Skill');
    expect(results[0].explanation).toContain('Experience');
  });

  it('returns scores rounded to 2 decimal places', async () => {
    const results = await rankCandidates([baseCandidate], baseJD);
    const { scores } = results[0];
    [scores.skill, scores.experience, scores.overall].forEach((s) => {
      const decimalPart = s.toString().split('.')[1] ?? '';
      expect(decimalPart.length).toBeLessThanOrEqual(2);
    });
  });

  it('handles empty candidate list', async () => {
    const results = await rankCandidates([], baseJD);
    expect(results).toEqual([]);
  });

  it('handles single candidate', async () => {
    const results = await rankCandidates([baseCandidate], baseJD);
    expect(results).toHaveLength(1);
    expect(results[0].candidate.id).toBe('1');
  });
});
