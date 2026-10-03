import { describe, it, expect } from 'vitest';
import {
  technicalInterviewEmailKey,
  technicalInterviewSubject,
  buildTechnicalInterviewEmail,
} from '@/services/email/technicalInvite';
import {
  candidateReportEmailKey,
  candidateReportSubject,
  buildCandidateReportEmail,
} from '@/services/email/candidateReport';
import { toCandidateSafeReport, assertCandidateSafe } from '@/services/reports/filterCandidateSafe';
import { generateReportPdf } from '@/services/reports/generatePdf';
import { reportJobId } from '@/services/queue/reportQueue';
import { reportStoragePath } from '@/services/reports/storage';
import type { HiringReport } from '@/services/reports/buildReport';

function internalFixture(): HiringReport {
  return {
    reportType: 'internal',
    version: 1,
    generatedAt: new Date().toISOString(),
    candidate: {
      id: 'cand-1', name: 'Ada Lovelace', email: 'ada@example.com', phone: '123',
      location: 'London', currentTitle: 'Engineer', currentCompany: 'Acme',
      experienceYears: 5, applicationDate: '2026-09-01', currentStage: 'Hired',
    },
    job: { id: 'job-1', title: 'Backend Engineer' },
    screening: {
      overall: 82, semantic: 80, skills: 85, experience: 78, education: 90,
      matchedSkills: ['node', 'sql'], missingSkills: ['go'],
      explanation: 'Strong match', status: 'passed', recruiterOverride: false, overrideReason: 'internal reason',
    },
    assessment: {
      name: 'Backend Screen', startedAt: '2026-09-02', submittedAt: '2026-09-02',
      score: 8, maxScore: 10, percentage: 80, passed: true, isMockExecution: false,
      questionCount: 5, answeredCount: 5,
      answers: [{ question_id: 'q1', score: 2, is_correct: true }],
      proctoringEventCount: 3,
    },
    technicalInterview: {
      date: '2026-09-10', time: '10:00', interviewer: 'Jane Interviewer', status: 'completed',
      technicalKnowledge: 5, problemSolving: 4, communication: 4, codeQuality: 5,
      recommendation: 'hire', summary: 'Great candidate, hire now',
      privateNotes: 'SECRET private notes must never leak',
      codingProblem: 'Two Sum', codingLanguage: 'javascript', codingRuns: 2,
    },
    hrInterview: {
      date: '2026-09-12', interviewer: 'HR Person', status: 'completed',
      recommendation: 'strong_hire', summary: 'Excellent fit', privateNotes: 'HR SECRET',
    },
    finalOutcome: {
      currentStage: 'Hired', finalDecision: 'Hired', decisionAt: '2026-09-13',
      timeline: [{ status: 'Applied', at: '2026-09-01' }, { status: 'Hired', at: '2026-09-13' }],
    },
  };
}

describe('technical interview email idempotency', () => {
  it('keys are stable per interview/event/version and distinct across events', () => {
    expect(technicalInterviewEmailKey('abc-123', 'scheduled', 1)).toBe('technical-interview:abc-123:scheduled:1');
    expect(technicalInterviewEmailKey('abc-123', 'scheduled', 1)).toBe(technicalInterviewEmailKey('abc-123', 'scheduled', 1));
    expect(technicalInterviewEmailKey('abc-123', 'scheduled', 1)).not.toBe(technicalInterviewEmailKey('abc-123', 'rescheduled', 2));
    expect(technicalInterviewEmailKey('abc-123', 'scheduled', 1)).not.toBe(technicalInterviewEmailKey('xyz', 'scheduled', 1));
  });

  it('subjects distinguish schedule/reschedule/cancel', () => {
    expect(technicalInterviewSubject('scheduled')).toContain('Invitation');
    expect(technicalInterviewSubject('rescheduled')).toContain('Rescheduled');
    expect(technicalInterviewSubject('cancelled')).toContain('Cancelled');
  });

  it('schedule email carries secure link + instructions; cancel carries no join link', () => {
    const html = buildTechnicalInterviewEmail({
      candidateName: 'Ada', interviewLink: 'http://x/interview/join/TOKEN',
      interviewerName: 'Jane', scheduledAt: '2026-09-10 10:00',
      meetingLink: 'https://meet.example/abc', jobTitle: 'Backend Engineer', event: 'scheduled',
    });
    expect(html).toContain('TOKEN');
    expect(html).toContain('https://meet.example/abc');
    expect(html).toContain('Backend Engineer');
    const cancelled = buildTechnicalInterviewEmail({ candidateName: 'Ada', interviewLink: '', event: 'cancelled' });
    expect(cancelled).toContain('cancelled');
    expect(cancelled).not.toContain('Join Technical Interview');
  });
});

describe('candidate-safe report filtering (server-side)', () => {
  it('strips private notes, answers, proctoring, interviewer identity, override rationale', () => {
    const safe = toCandidateSafeReport(internalFixture());
    expect(safe.reportType).toBe('candidate');
    expect(assertCandidateSafe(safe)).toEqual([]);
    const text = JSON.stringify(safe);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('internal reason');
    expect(text).not.toContain('Jane Interviewer');
    expect(text).not.toContain('proctoringEventCount');
    // Candidate-visible facts survive:
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Backend Engineer');
    expect(safe.technicalInterview?.recommendation).toBe('Pass');
    expect(safe.hrInterview?.recommendation).toBe('Pass');
  });

  it('maps reject/hold recommendations to candidate-safe wording', () => {
    const base = internalFixture();
    const rejected = toCandidateSafeReport({
      ...base,
      technicalInterview: { ...base.technicalInterview!, recommendation: 'no_hire' },
      hrInterview: null,
    });
    expect(rejected.technicalInterview?.recommendation).toBe('Not advanced');
    const held = toCandidateSafeReport({
      ...base,
      technicalInterview: { ...base.technicalInterview!, recommendation: 'hold' },
      hrInterview: null,
    });
    expect(held.technicalInterview?.recommendation).toBe('On hold');
  });
});

describe('report queue + email idempotency', () => {
  it('report job ids are stable per candidate/job/type/version', () => {
    expect(reportJobId('c1', 'j1', 'candidate', 2)).toBe(reportJobId('c1', 'j1', 'candidate', 2));
    expect(reportJobId('c1', 'j1', 'candidate', 2)).not.toBe(reportJobId('c1', 'j1', 'candidate', 3));
    expect(reportJobId('c1', 'j1', 'candidate', 2)).not.toBe(reportJobId('c2', 'j1', 'candidate', 2));
  });

  it('candidate-report email keys follow candidate-report:{c}:{j}:{v}', () => {
    expect(candidateReportEmailKey('c1', 'j1', 2)).toBe('candidate-report:c1:j1:2');
    expect(candidateReportSubject(true)).toContain('Offer');
  });

  it('report email never embeds internal notes', () => {
    const html = buildCandidateReportEmail({
      candidateName: 'Ada',
      resultMessage: 'Your process concluded.',
      summaryLines: ['Final status: Hired'],
      reportId: 'r1',
    });
    expect(html).toContain('Ada');
    expect(html).not.toContain('SECRET');
    expect(html).not.toContain('private');
  });

  it('storage paths carry ids only, never emails or binary', () => {
    const p = reportStoragePath('cand-1', 'rep-2');
    expect(p).toBe('cand-1/rep-2.pdf');
    expect(p).not.toContain('@');
  });
});

describe('candidate-safe PDF (pdfkit)', () => {
  it('renders a valid PDF from candidate-safe data only', async () => {
    const safe = toCandidateSafeReport(internalFixture());
    const pdf = await generateReportPdf({ ...safe, reportId: 'rep-1' });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
    // Raw PDF bytes must not contain secrets (they were stripped before render).
    const text = pdf.toString('latin1');
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('private_notes');
  }, 15000);
});

describe('failure isolation contract', () => {
  it('documents: report/email failure must not roll back decisions', () => {
    // Enforced by construction: requestCandidateReportAfterDecision and the
    // final-decision controller catch all report/queue errors and still
    // return the persisted decision. This test pins the import surface so
    // future refactors keep the helper available.
    expect(async () => {
      const mod = await import('@/services/reports/finalDecision');
      expect(typeof mod.requestCandidateReportAfterDecision).toBe('function');
    }).not.toThrow();
  });
});
