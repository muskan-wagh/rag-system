import { getSupabaseClient } from '@/services/supabase/client';

export type ReportType = 'internal' | 'candidate';

export interface HiringReport {
  reportId?: string;
  reportType: ReportType;
  version: number;
  generatedAt: string;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    location: string | null;
    currentTitle: string | null;
    currentCompany: string | null;
    experienceYears: number | null;
    applicationDate: string | null;
    currentStage: string | null;
  };
  job: { id: string | null; title: string | null } | null;
  screening: {
    overall: number | null;
    semantic: number | null;
    skills: number | null;
    experience: number | null;
    education: number | null;
    matchedSkills: string[];
    missingSkills: string[];
    explanation: string | null;
    status: string | null;
    recruiterOverride: boolean;
    overrideReason: string | null;
  } | null;
  assessment: {
    name: string | null;
    startedAt: string | null;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
    passed: boolean | null;
    isMockExecution: boolean;
    questionCount: number;
    answeredCount: number;
    // Internal-only fields (stripped for candidate-safe):
    answers?: Array<Record<string, unknown>>;
    questions?: Array<Record<string, unknown>>;
    proctoringEventCount?: number;
  } | null;
  technicalInterview: {
    date: string | null;
    time: string | null;
    interviewer: string | null;
    status: string | null;
    technicalKnowledge: number | null;
    problemSolving: number | null;
    communication: number | null;
    codeQuality: number | null;
    recommendation: string | null;
    summary: string | null;
    // Factual video-session metadata only (no recordings exist; camera/mic
    // signals are neutral observations, never verdicts). Safe for candidates.
    video?: {
      startedAt: string | null;
      endedAt: string | null;
      durationSeconds: number | null;
      signalCount: number;
    } | null;
    // internal-only:
    privateNotes?: string | null;
    codingProblem?: string | null;
    codingLanguage?: string | null;
    codingRuns?: number | null;
  } | null;
  hrInterview: {
    date: string | null;
    interviewer: string | null;
    status: string | null;
    recommendation: string | null;
    summary: string | null;
    privateNotes?: string | null;
  } | null;
  finalOutcome: {
    currentStage: string | null;
    finalDecision: string | null;
    decisionAt: string | null;
    timeline: Array<{ status: string; at: string }>;
  };
}

/**
 * Build a hiring report from PERSISTED data only.
 * Never invents scores; missing sections stay null.
 * Internal report includes private notes + raw answers; the
 * candidate-safe variant is produced by filterCandidateSafe().
 */
export async function buildInternalReport(input: {
  candidateId: string;
  jobId?: string | null;
  reportType: ReportType;
  version: number;
  reportId?: string;
}): Promise<HiringReport> {
  const supabase = getSupabaseClient();
  const { candidateId, jobId } = input;
  const generatedAt = new Date().toISOString();

  const { data: cand } = await supabase.from('candidates').select('*').eq('id', candidateId).maybeSingle();
  const c = (cand || {}) as Record<string, unknown>;

  // Job: explicit jobId wins; else latest assessment job; else null.
  let resolvedJobId: string | null = jobId || null;
  let jobTitle: string | null = null;
  if (!resolvedJobId) {
    const { data: attempt } = await supabase
      .from('assessment_attempts')
      .select('assessment_id')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const aid = (attempt as { assessment_id?: string } | null)?.assessment_id;
    if (aid) {
      const { data: a } = await supabase.from('assessments').select('job_id').eq('id', aid).maybeSingle();
      resolvedJobId = ((a as { job_id?: string | null } | null)?.job_id || null) as string | null;
    }
  }
  if (resolvedJobId) {
    const { data: j } = await supabase.from('jobs').select('id, title').eq('id', resolvedJobId).maybeSingle();
    jobTitle = ((j as { title?: string } | null)?.title || null) as string | null;
  }

  // Screening (effective values post-override; ai_* preserved for internal).
  let screening: HiringReport['screening'] = null;
  {
    let q = supabase.from('screening_results').select('*').eq('candidate_id', candidateId);
    const { data } = resolvedJobId ? await q.eq('job_id', resolvedJobId).maybeSingle() : await q.limit(1).maybeSingle();
    if (data) {
      const s = data as Record<string, unknown>;
      screening = {
        overall: (s.overall as number | null) ?? null,
        semantic: (s.semantic_score as number | null) ?? null,
        skills: (s.skills_score as number | null) ?? null,
        experience: (s.experience_score as number | null) ?? null,
        education: (s.education_score as number | null) ?? null,
        matchedSkills: (s.matched_skills as string[] | null) || [],
        missingSkills: (s.missing_skills as string[] | null) || [],
        explanation: (s.explanation as string | null) || null,
        status: (s.status as string | null) || null,
        recruiterOverride: Boolean(s.recruiter_override),
        overrideReason: (s.override_reason as string | null) || null,
      };
    }
  }

  // Assessment: latest submitted/evaluated attempt + sanitized rollup.
  let assessment: HiringReport['assessment'] = null;
  {
    const { data: attempts } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1);
    const att = ((attempts || []) as Array<Record<string, unknown>>)[0];
    if (att) {
      const { data: answers } = await supabase.from('assessment_answers').select('*').eq('attempt_id', att.id);
      const ans = ((answers || []) as Array<Record<string, unknown>>);
      let assessmentName: string | null = null;
      if (att.assessment_id) {
        const { data: a } = await supabase.from('assessments').select('name').eq('id', att.assessment_id as string).maybeSingle();
        assessmentName = ((a as { name?: string } | null)?.name || null) as string | null;
      }
      let proctoringEventCount = 0;
      try {
        const { count } = await supabase
          .from('proctoring_events')
          .select('id', { count: 'exact', head: true })
          .eq('attempt_id', att.id as string);
        proctoringEventCount = count || 0;
      } catch {
        proctoringEventCount = 0;
      }
      assessment = {
        name: assessmentName,
        startedAt: (att.started_at as string | null) || null,
        submittedAt: (att.submitted_at as string | null) || null,
        score: (att.score as number | null) ?? null,
        maxScore: (att.max_score as number | null) ?? null,
        percentage: (att.percentage as number | null) ?? null,
        passed: (att.passed as boolean | null) ?? null,
        isMockExecution: Boolean(att.is_mock_execution),
        questionCount: ans.length,
        answeredCount: ans.length,
        answers: ans.map((a) => ({
          question_id: a.question_id,
          score: a.score,
          max_score: a.max_score,
          is_correct: a.is_correct,
          language: a.language,
          updated_at: a.updated_at,
        })),
        proctoringEventCount,
      };
    }
  }

  // Interviews: latest per stage (Technical vs Managerial/HR).
  async function stageInterview(stage: 'Technical Interview' | 'Managerial/HR') {
    const { data: invites } = await supabase
      .from('interview_invites')
      .select('interview_id, stage')
      .eq('candidate_id', candidateId)
      .eq('stage', stage)
      .order('created_at', { ascending: false })
      .limit(1);
    const inv = ((invites || []) as Array<{ interview_id: string }>)[0];
    if (!inv) return null;
    const { data: interview } = await supabase.from('interviews').select('*').eq('id', inv.interview_id).maybeSingle();
    const { data: evaluation } = await supabase
      .from('interview_evaluations')
      .select('*')
      .eq('interview_id', inv.interview_id)
      .maybeSingle();
    const { data: coding } = await supabase
      .from('interview_coding_sessions')
      .select('problem_id, language, session_state, version, updated_at')
      .eq('interview_id', inv.interview_id)
      .maybeSingle();
    let problemTitle: string | null = null;
    const pid = (coding as { problem_id?: string | null } | null)?.problem_id;
    if (pid) {
      const { data: p } = await supabase.from('interview_problems').select('title').eq('id', pid).maybeSingle();
      problemTitle = ((p as { title?: string } | null)?.title || null) as string | null;
    }
    return { interview: (interview as Record<string, unknown> | null), evaluation: (evaluation as Record<string, unknown> | null), coding: (coding as Record<string, unknown> | null), problemTitle };
  }

  const tech = await stageInterview('Technical Interview');
  const hr = await stageInterview('Managerial/HR');

  /** Factual video metadata (tolerates pre-migration rows lacking columns). */
  function buildVideoMetadata(interview: Record<string, unknown>): {
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    signalCount: number;
  } | null {
    const startedAt = (interview.video_started_at as string | null) || null;
    const endedAt = (interview.video_ended_at as string | null) || null;
    const signals = Array.isArray(interview.video_signals)
      ? (interview.video_signals as Array<unknown>)
      : [];
    if (!startedAt && !endedAt && signals.length === 0) return null;
    let durationSeconds: number | null = null;
    if (startedAt && endedAt) {
      const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
      if (Number.isFinite(ms) && ms >= 0) durationSeconds = Math.round(ms / 1000);
    }
    return { startedAt, endedAt, durationSeconds, signalCount: signals.length };
  }

  const technicalInterview: HiringReport['technicalInterview'] = tech?.interview
    ? {
        date: (tech.interview.scheduled_date as string | null) || null,
        time: (tech.interview.scheduled_time as string | null) || null,
        interviewer: (tech.interview.interviewer_name as string | null) || null,
        status: (tech.interview.status as string | null) || null,
        technicalKnowledge: (tech.evaluation?.technical_knowledge as number | null) ?? null,
        problemSolving: (tech.evaluation?.problem_solving as number | null) ?? null,
        communication: (tech.evaluation?.communication as number | null) ?? null,
        codeQuality: (tech.evaluation?.code_quality as number | null) ?? null,
        recommendation: (tech.evaluation?.overall_recommendation as string | null) || null,
        summary: (tech.evaluation?.summary as string | null) || null,
        privateNotes: (tech.evaluation?.private_notes as string | null) || null,
        codingProblem: tech.problemTitle,
        codingLanguage: (tech.coding?.language as string | null) || null,
        codingRuns: (tech.coding?.version as number | null) ?? null,
        video: buildVideoMetadata(tech.interview),
      }
    : null;

  const hrInterview: HiringReport['hrInterview'] = hr?.interview
    ? {
        date: (hr.interview.scheduled_date as string | null) || null,
        interviewer: (hr.interview.interviewer_name as string | null) || null,
        status: (hr.interview.status as string | null) || null,
        recommendation: (hr.evaluation?.overall_recommendation as string | null) || null,
        summary: (hr.evaluation?.summary as string | null) || null,
        privateNotes: (hr.evaluation?.private_notes as string | null) || null,
      }
    : null;

  // Timeline (candidate-safe: status + timestamp only).
  const { data: timeline } = await supabase
    .from('candidate_status_log')
    .select('status, changed_at')
    .eq('candidate_id', candidateId)
    .order('changed_at', { ascending: true })
    .limit(100);
  const tl = ((timeline || []) as Array<{ status: string; changed_at: string }>).map((t) => ({
    status: t.status,
    at: t.changed_at,
  }));

  return {
    reportId: input.reportId,
    reportType: input.reportType,
    version: input.version,
    generatedAt,
    candidate: {
      id: candidateId,
      name: String(c.full_name || ''),
      email: String(c.email || ''),
      phone: (c.phone as string | null) || null,
      location: (c.location as string | null) || null,
      currentTitle: (c.current_title as string | null) || null,
      currentCompany: (c.current_company as string | null) || null,
      experienceYears: (c.total_experience_years as number | null) ?? null,
      applicationDate: (c.created_at as string | null) || null,
      currentStage: (c.current_status as string | null) || null,
    },
    job: { id: resolvedJobId, title: jobTitle },
    screening,
    assessment,
    technicalInterview,
    hrInterview,
    finalOutcome: {
      currentStage: (c.current_status as string | null) || null,
      finalDecision: (c.current_status as string | null) || null,
      decisionAt: tl.length > 0 ? tl[tl.length - 1].at : null,
      timeline: tl,
    },
  };
}
