import type { HiringReport } from './buildReport';

/**
 * SERVER-SIDE candidate-safe filtering. Produces a NEW object —
 * the internal report (private notes, hidden answers/tests, scoring
 * internals, proctoring counts) never leaves the server on the
 * candidate path. Candidate endpoints must call this before ANY
 * response, PDF render, or email attachment.
 */
export function toCandidateSafeReport(internal: HiringReport): HiringReport {
  const safe: HiringReport = {
    reportId: internal.reportId,
    reportType: 'candidate',
    version: internal.version,
    generatedAt: internal.generatedAt,
    candidate: {
      id: internal.candidate.id,
      name: internal.candidate.name,
      email: internal.candidate.email,
      phone: internal.candidate.phone,
      location: internal.candidate.location,
      currentTitle: internal.candidate.currentTitle,
      currentCompany: internal.candidate.currentCompany,
      experienceYears: internal.candidate.experienceYears,
      applicationDate: internal.candidate.applicationDate,
      currentStage: internal.candidate.currentStage,
    },
    job: internal.job ? { id: internal.job.id, title: internal.job.title } : null,
    screening: internal.screening
      ? {
          overall: internal.screening.overall,
          semantic: internal.screening.semantic,
          skills: internal.screening.skills,
          experience: internal.screening.experience,
          education: internal.screening.education,
          matchedSkills: internal.screening.matchedSkills,
          missingSkills: internal.screening.missingSkills,
          explanation: internal.screening.explanation,
          status: internal.screening.status,
          recruiterOverride: internal.screening.recruiterOverride,
          overrideReason: null, // internal rationale stays private
        }
      : null,
    assessment: internal.assessment
      ? {
          name: internal.assessment.name,
          startedAt: internal.assessment.startedAt,
          submittedAt: internal.assessment.submittedAt,
          score: internal.assessment.score,
          maxScore: internal.assessment.maxScore,
          percentage: internal.assessment.percentage,
          passed: internal.assessment.passed,
          isMockExecution: internal.assessment.isMockExecution,
          questionCount: internal.assessment.questionCount,
          answeredCount: internal.assessment.answeredCount,
          // answers / questions / proctoring counts deliberately omitted
        }
      : null,
    technicalInterview: internal.technicalInterview
      ? {
          date: internal.technicalInterview.date,
          time: internal.technicalInterview.time,
          interviewer: null, // interviewer identity stays internal
          status: internal.technicalInterview.status,
          technicalKnowledge: internal.technicalInterview.technicalKnowledge,
          problemSolving: internal.technicalInterview.problemSolving,
          communication: internal.technicalInterview.communication,
          codeQuality: internal.technicalInterview.codeQuality,
          recommendation: candidateVisibleRecommendation(internal.technicalInterview.recommendation),
          summary: candidateVisibleSummary(internal.technicalInterview.summary),
          video: internal.technicalInterview.video || null,
          // privateNotes / coding internals omitted
        }
      : null,
    hrInterview: internal.hrInterview
      ? {
          date: internal.hrInterview.date,
          interviewer: null,
          status: internal.hrInterview.status,
          recommendation: candidateVisibleRecommendation(internal.hrInterview.recommendation),
          summary: candidateVisibleSummary(internal.hrInterview.summary),
        }
      : null,
    finalOutcome: {
      currentStage: internal.finalOutcome.currentStage,
      finalDecision: internal.finalOutcome.finalDecision,
      decisionAt: internal.finalOutcome.decisionAt,
      timeline: internal.finalOutcome.timeline.map((t) => ({ status: t.status, at: t.at })),
    },
  };
  return safe;
}

function candidateVisibleRecommendation(r: string | null): string | null {
  if (!r) return null;
  // Map internal 5-way scale to a candidate-safe 3-way message.
  if (r === 'strong_hire' || r === 'hire') return 'Pass';
  if (r === 'no_hire' || r === 'strong_no_hire') return 'Not advanced';
  return 'On hold';
}

function candidateVisibleSummary(s: string | null): string | null {
  if (!s) return null;
  // Summaries may contain internal phrasing; truncate to a safe excerpt.
  return s.slice(0, 500);
}

/** Guard used in tests + PDF/email paths: no forbidden keys survive. */
const FORBIDDEN_KEYS = [
  'privateNotes',
  'private_notes',
  'answers',
  'questions',
  'token_encrypted',
  'token_hash',
  'correct_option_id',
  'expected_output',
  'reference_solution',
  'expected_query',
  'answer_key',
  'rubric',
  'proctoringEventCount',
];

export function assertCandidateSafe(report: HiringReport): string[] {
  const text = JSON.stringify(report);
  return FORBIDDEN_KEYS.filter((k) => text.includes(k));
}
