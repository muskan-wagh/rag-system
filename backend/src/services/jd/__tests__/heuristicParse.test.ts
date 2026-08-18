import { describe, it, expect } from 'vitest';
import { heuristicParseJD, setCorpusSkills } from '../heuristicParse';

describe('heuristicParseJD', () => {
  it('extracts title, experience, education, and sections from a realistic JD', () => {
    const jd = `Senior Backend Engineer
We are looking for a Senior Backend Engineer with 5-8 years of experience building scalable microservices.

Responsibilities:
- Design and build REST APIs using Node.js and Express
- Manage PostgreSQL, Redis and Kafka infrastructure

Requirements:
- Bachelors degree in Computer Science or related field
- Strong knowledge of AWS, TypeScript and testing (Jest)`;

    const parsed = heuristicParseJD(jd);

    expect(parsed.title).toBe('Senior Backend Engineer');
    expect(parsed.experience.min).toBe(5);
    expect(parsed.experience.max).toBe(8);
    expect(parsed.education.level).toBe('bachelor');
    expect(parsed.education.field).toBe('computer science');
    expect(parsed.skills).toContain('node.js');
    expect(parsed.skills).toContain('aws');
    expect(parsed.skills).toContain('typescript');
    expect(parsed.responsibilities[0]).toContain('REST APIs');
    expect(parsed.requirements[0]).toContain('Bachelors degree');
    expect(parsed.rawText).toBe(jd);
  });

  it('does not match skill substrings (e.g. scala in scalable, go in google)', () => {
    const jd = 'Looking for a developer who can build scalable services using Google Cloud.';
    const parsed = heuristicParseJD(jd);

    expect(parsed.skills).not.toContain('scala');
    expect(parsed.skills).not.toContain('go');
    expect(parsed.skills).toContain('google cloud');
  });

  it('handles "+ years" as min with a max floor of 10', () => {
    const parsed = heuristicParseJD('Requires 7+ years of experience');
    expect(parsed.experience.min).toBe(7);
    expect(parsed.experience.max).toBe(10);
  });

  it('handles bare years as a fixed requirement', () => {
    const parsed = heuristicParseJD('Requires 3 years experience');
    expect(parsed.experience.min).toBe(3);
    expect(parsed.experience.max).toBe(3);
  });

  it('defaults to any/zero when nothing is specified', () => {
    const parsed = heuristicParseJD('We are hiring. Apply now!');
    expect(parsed.experience.min).toBe(0);
    expect(parsed.experience.max).toBe(0);
    expect(parsed.education.level).toBe('any');
  });

  it('uses corpus skills when provided', () => {
    setCorpusSkills(['internal-tool', 'postgresql']);
    const parsed = heuristicParseJD('Familiarity with the internal-tool is a plus.');
    expect(parsed.skills).toContain('internal-tool');
  });
});
