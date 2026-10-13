import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { requireOwnedJob, type JobLifecycleRecord } from './jobLifecycleService';
import { requireOwnedJobAndCandidate, getApplicationRecord } from './applicationService';
import { readScreening } from './shortlistService';
import { normalizeStage, type PipelineStage, type StageOutcome } from './stageTypes';

/**
 * The job-scoped recruitment workspace.
 *
 * One service, one job id, one authoritative source of truth per fact:
 *
 *   stage      → job_applications.current_stage
 *   screening  → screening_results (per job + candidate)
 *   assessment → assessments.job_id + assessment_invites/attempts
 *   interview  → interviews.job_id + interview_invites
 *
 * ── Job isolation is a hard rule ──────────────────────────────────────────────
 * Every query in this file filters on the caller's `jobId`. A candidate
 * shortlisted for a Backend job never appears in a Frontend job's workspace,
 * and no candidate ever sees another candidate's assessment: every row returned
 * is scoped to `jobId`, and per-candidate assessment detail is only reachable
 * through a candidate that is itself an application on THIS job.
 *
 * ── Shortlisted is the only eligibility rule ─────────────────────────────────
 * Earlier, assessment eligibility was derived from `screening_results.status`
 * ('passed'/'overridden'). That made an AI score an implicit recruiter decision:
 * a candidate the model happened to pass was in the invitation queue whether or
 * not a human had ever looked at them. Eligibility is now exactly "a recruiter
 * put this candidate at `Shortlisted` on this job's application".
 */

export type AssessmentState =
  | 'not_created'
  | 'draft'
  | 'ready_to_send'
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'failed';

export interface WorkspaceCandidateRow {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string;
  currentTitle: string;
  currentCompany: string;
  stage: PipelineStage | StageOutcome;
  stageChangedAt: string | null;
  shortlistedAt: string | null;
  screening: {
    status: string;
    overall: number;
    overridden: boolean;
    matchedSkills: string[];
    missingSkills: string[];
  } | null;
  assessment: {
    state: AssessmentState;
    assessmentId: string | null;
    assessmentName: string | null;
    /** Published version this invite/attempt is pinned to. */
    snapshotVersion: number | null;
    inviteStatus: string | null;
    deliveryStatus: 'pending' | 'sent' | 'failed' | null;
    sentAt: string | null;
    deadline: string | null;
    attemptStatus: string | null;
    startedAt: string | null;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
    passed: boolean | null;
  } | null;
  interview: {
    interviewId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: string;
    meetingLink: string;
  } | null;
  /** Whether this candidate has a generated report for this job. */
  hasReport: boolean;
}

export interface WorkspaceCounts {
  applied: number;
  screening: number;
  shortlisted: number;
  assessment: number;
  technicalRound: number;
  interview: number;
  finalDecision: number;
  hired: number;
  rejected: number;
  hold: number;
  // Assessment sub-states, derived from real invite/attempt rows.
  notCreated: number;
  draft: number;
  readyToSend: number;
  invited: number;
  inProgress: number;
  completed: number;
  expired: number;
  failed: number;
}

export interface WorkspaceJobSummary extends JobLifecycleRecord {
  assessmentCount: number;
  publishedAssessmentCount: number;
  shortlistedCount: number;
}

export interface WorkspacePayload {
  job: WorkspaceJobSummary;
  counts: WorkspaceCounts;
  /** Job-scoped, job-filtered pipeline. */
  pipeline: WorkspaceCandidateRow[];
  assessments: Array<{
    id: string;
    name: string;
    status: string;
    durationMinutes: number;
    passingScore: number;
    snapshotVersion: number;
    totalQuestions: number;
    totalMarks: number;
    availableUntil: string | null;
    inviteCount: number;
  }>;
  /** True when this job refuses new recruitment activity. */
  readOnly: boolean;
  /** Whether an authorized invite override is configured for a closed job. */
  invitesAllowedWhenClosed: boolean;
}

function emptyCounts(): WorkspaceCounts {
  return {
    applied: 0,
    screening: 0,
    shortlisted: 0,
    assessment: 0,
    technicalRound: 0,
    interview: 0,
    finalDecision: 0,
    hired: 0,
    rejected: 0,
    hold: 0,
    notCreated: 0,
    draft: 0,
    readyToSend: 0,
    invited: 0,
    inProgress: 0,
    completed: 0,
    expired: 0,
    failed: 0,
  };
}

/**
 * Derive the per-candidate assessment state from real rows.
 *
 * `Failed` means an actual delivery failure was recorded on the invite — not
 * "we tried and gave up". `Expired` means the availability window has passed.
 * Nothing here infers success.
 */
function deriveAssessmentState(input: {
  assessmentId: string | null;
  assessmentStatus: string | null;
  availableUntil: string | null;
  inviteStatus: string | null;
  deliveryStatus: string | null;
  attemptStatus: string | null;
  now: number;
}): AssessmentState {
  if (!input.assessmentId) return 'not_created';
  if (input.assessmentStatus !== 'published') return 'draft';

  if (input.inviteStatus) {
    if (input.inviteStatus === 'revoked') {
      // A revoked invite is not an active invitation; fall through to the
      // attempt state so a revoked-but-completed candidate still reads as
      // completed rather than pretending they never started.
      if (input.attemptStatus === 'submitted' || input.attemptStatus === 'evaluated') return 'completed';
      return 'ready_to_send';
    }
    if (input.attemptStatus === 'submitted' || input.attemptStatus === 'evaluated') return 'completed';
    if (input.attemptStatus === 'in_progress') return 'in_progress';
    if (input.inviteStatus === 'expired') return 'expired';
    if (input.attemptStatus === 'expired') return 'expired';
    if (input.deliveryStatus === 'failed') return 'failed';
    return 'invited';
  }

  if (input.attemptStatus === 'submitted' || input.attemptStatus === 'evaluated') return 'completed';
  if (input.attemptStatus === 'in_progress') return 'in_progress';

  if (input.availableUntil && new Date(input.availableUntil).getTime() <= input.now) return 'expired';
  return 'ready_to_send';
}

/**
 * Load the complete workspace for one job.
 *
 * The recruiter must own the job. A job with no applications still returns a
 * well-formed payload with zeroed counts rather than an error, so the UI can
 * render an empty state instead of an error boundary.
 */
export async function loadWorkspace(input: {
  recruiterId: string;
  jobId: string;
  limit?: number;
}): Promise<WorkspacePayload> {
  const job = await requireOwnedJob(input.recruiterId, input.jobId);
  const supabase = getSupabaseClient();
  const limit = Math.min(Math.max(input.limit ?? 500, 1), 2000);
  const now = Date.now();

  // 1. Every application on THIS job. Nothing else can enter this list.
  const { data: applications, error: appError } = await supabase
    .from('job_applications')
    .select(
      'id, candidate_id, current_stage, applied_at, stage_changed_at, shortlisted_at, shortlisted_by, shortlist_note',
    )
    .eq('job_id', input.jobId)
    .order('shortlisted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (appError) {
    throw new AppError(`Failed to load pipeline: ${appError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  const rows = (applications as Array<Record<string, unknown>>) ?? [];
  const applicationIds = rows.map((r) => String(r.id));
  const candidateIds = rows.map((r) => String(r.candidate_id));

  if (candidateIds.length === 0) {
    return {
      job: {
        ...job,
        assessmentCount: await countAssessments(input.jobId),
        publishedAssessmentCount: 0,
        shortlistedCount: 0,
      },
      counts: emptyCounts(),
      pipeline: [],
      assessments: await listJobAssessments(input.jobId),
      readOnly: job.status === 'closed',
      invitesAllowedWhenClosed: job.progression_config?.allow_invites_when_closed === true,
    };
  }

  // 2. Candidates for those applications only.
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name, email, current_title, current_company')
    .in('id', candidateIds);
  const candidateById = new Map(
    ((candidates as Array<Record<string, unknown>>) ?? []).map((c) => [String(c.id), c]),
  );

  // 3. Screening for THIS job only.
  const { data: screeningRows } = await supabase
    .from('screening_results')
    .select('candidate_id, status, overall, recruiter_override, matched_skills, missing_skills')
    .eq('job_id', input.jobId)
    .in('candidate_id', candidateIds);
  const screeningByCandidate = new Map(
    ((screeningRows as Array<Record<string, unknown>>) ?? []).map((r) => [String(r.candidate_id), r]),
  );

  // 4. Assessments for THIS job only.
  const { data: assessmentRows } = await supabase
    .from('assessments')
    .select(
      'id, name, status, duration_minutes, passing_score, snapshot_version, available_until, job_id',
    )
    .eq('job_id', input.jobId)
    .order('created_at', { ascending: true });
  const assessments = (assessmentRows as Array<Record<string, unknown>>) ?? [];
  const assessmentIds = assessments.map((a) => String(a.id));
  const assessmentById = new Map(assessments.map((a) => [String(a.id), a]));

  // The assessment a candidate is currently attached to: the newest one they
  // have an invite or attempt against. Falls back to the newest published
  // assessment for this job so the workspace can still show "ready to send".
  let inviteByApplication = new Map<string, Record<string, unknown>>();
  let attemptByAssessmentCandidate = new Map<string, Record<string, unknown>>();

  if (assessmentIds.length > 0) {
    const { data: inviteRows } = await supabase
      .from('assessment_invites')
      .select(
        'id, candidate_id, job_application_id, assessment_id, status, delivery_status, sent_at, last_sent_at, send_count, available_until, snapshot_version',
      )
      .in('assessment_id', assessmentIds)
      .in('candidate_id', candidateIds);
    for (const row of (inviteRows as Array<Record<string, unknown>>) ?? []) {
      const appId = row.job_application_id
        ? String(row.job_application_id)
        : matchApplication(rows, String(row.candidate_id));
      if (appId) inviteByApplication.set(appId, row);
    }

    const { data: attemptRows } = await supabase
      .from('assessment_attempts')
      .select(
        'id, candidate_id, assessment_id, status, started_at, submitted_at, score, max_score, percentage, passed, snapshot_version',
      )
      .in('assessment_id', assessmentIds)
      .in('candidate_id', candidateIds);
    for (const row of (attemptRows as Array<Record<string, unknown>>) ?? []) {
      attemptByAssessmentCandidate.set(`${row.assessment_id}:${row.candidate_id}`, row);
    }
  }

  // 5. Interviews for THIS job only.
  const { data: interviewRows } = await supabase
    .from('interviews')
    .select('id, candidate_id, scheduled_date, scheduled_time, status, meeting_link, created_at')
    .eq('job_id', input.jobId)
    .in('candidate_id', candidateIds)
    .order('created_at', { ascending: false });
  const interviewByCandidate = new Map<string, Record<string, unknown>>();
  for (const row of (interviewRows as Array<Record<string, unknown>>) ?? []) {
    const key = String(row.candidate_id);
    if (!interviewByCandidate.has(key)) interviewByCandidate.set(key, row);
  }

  // 6. Reports for THIS job only.
  const { data: reportRows } = await supabase
    .from('candidate_reports')
    .select('id, candidate_id')
    .eq('job_id', input.jobId)
    .in('candidate_id', candidateIds);
  const reportCandidates = new Set(
    ((reportRows as Array<Record<string, unknown>>) ?? []).map((r) => String(r.candidate_id)),
  );

  const counts = emptyCounts();
  const pipeline: WorkspaceCandidateRow[] = [];

  // The assessment a candidate is currently attached to: the newest one they
  // have an invite or attempt against. Falls back to the newest published
  // assessment for this job so the workspace can still show "ready to send",
  // and to the newest draft when nothing is published yet — otherwise a job
  // with only a draft would report "Not Created" and hide work in progress.
  const byNewest = [...assessments].sort((a, b) =>
    String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
  );
  const newestPublished = byNewest.find((a) => String(a.status) === 'published');
  const newestAny = byNewest[0];
  const fallbackAssessment = newestPublished ?? newestAny;

  for (const row of rows) {
    const candidateId = String(row.candidate_id);
    const candidate = candidateById.get(candidateId);
    const stage = normalizeStage(String(row.current_stage)) ?? 'Applied';
    const screeningRow = screeningByCandidate.get(candidateId);

    const invite = inviteByApplication.get(String(row.id));
    const inviteAssessment = invite ? assessmentById.get(String(invite.assessment_id)) : null;
    const activeAssessment = inviteAssessment ?? fallbackAssessment;
    const attempt = activeAssessment
      ? attemptByAssessmentCandidate.get(`${activeAssessment.id}:${candidateId}`)
      : undefined;

    const state = deriveAssessmentState({
      assessmentId: activeAssessment ? String(activeAssessment.id) : null,
      assessmentStatus: activeAssessment ? String(activeAssessment.status) : null,
      availableUntil: activeAssessment?.available_until ? String(activeAssessment.available_until) : null,
      inviteStatus: invite ? String(invite.status) : null,
      deliveryStatus: (invite?.delivery_status as 'pending' | 'sent' | 'failed' | null) ?? null,
      attemptStatus: attempt ? String(attempt.status) : null,
      now,
    });

    bumpStageCount(counts, stage);
    bumpAssessmentCount(counts, state, stage);

    const interview = interviewByCandidate.get(candidateId);

    pipeline.push({
      applicationId: String(row.id),
      candidateId,
      fullName: String(candidate?.full_name ?? ''),
      email: String(candidate?.email ?? ''),
      currentTitle: String(candidate?.current_title ?? ''),
      currentCompany: String(candidate?.current_company ?? ''),
      stage,
      stageChangedAt: row.stage_changed_at ? String(row.stage_changed_at) : null,
      shortlistedAt: row.shortlisted_at ? String(row.shortlisted_at) : null,
      screening: screeningRow
        ? {
            status: String(screeningRow.status ?? 'pending'),
            overall: Number(screeningRow.overall ?? 0),
            overridden: Boolean(screeningRow.recruiter_override),
            matchedSkills: (screeningRow.matched_skills as string[]) ?? [],
            missingSkills: (screeningRow.missing_skills as string[]) ?? [],
          }
        : null,
      // Always populated for candidates who have reached the assessment part of
      // the pipeline, INCLUDING the `not_created` state. Returning `null` here
      // made "Not Created" indistinguishable from "the caller forgot to ask",
      // which is the exact confusion the workspace exists to remove.
      assessment: {
        state,
        assessmentId: activeAssessment ? String(activeAssessment.id) : null,
        assessmentName: activeAssessment ? String(activeAssessment.name) : null,
        snapshotVersion:
          (invite?.snapshot_version as number | null) ??
          (attempt?.snapshot_version as number | null) ??
          (activeAssessment ? Number(activeAssessment.snapshot_version ?? 0) : null),
        inviteStatus: invite ? String(invite.status) : null,
        deliveryStatus: (invite?.delivery_status as 'pending' | 'sent' | 'failed' | null) ?? null,
        sentAt: invite?.sent_at ? String(invite.sent_at) : null,
        deadline: invite?.available_until
          ? String(invite.available_until)
          : activeAssessment?.available_until
            ? String(activeAssessment.available_until)
            : null,
        attemptStatus: attempt ? String(attempt.status) : null,
        startedAt: attempt?.started_at ? String(attempt.started_at) : null,
        submittedAt: attempt?.submitted_at ? String(attempt.submitted_at) : null,
        score: attempt?.score != null ? Number(attempt.score) : null,
        maxScore: attempt?.max_score != null ? Number(attempt.max_score) : null,
        percentage: attempt?.percentage != null ? Number(attempt.percentage) : null,
        passed: attempt?.passed != null ? Boolean(attempt.passed) : null,
      },
      interview: interview
        ? {
            interviewId: String(interview.id),
            scheduledDate: String(interview.scheduled_date ?? ''),
            scheduledTime: String(interview.scheduled_time ?? ''),
            status: String(interview.status ?? 'scheduled'),
            meetingLink: String(interview.meeting_link ?? ''),
          }
        : null,
      hasReport: reportCandidates.has(candidateId),
    });
  }

  const { data: questionCounts } = assessmentIds.length
    ? await supabase
        .from('assessment_questions')
        .select('assessment_id, marks')
        .in('assessment_id', assessmentIds)
    : { data: [] };

  const questionTotals = new Map<string, { count: number; marks: number }>();
  for (const q of (questionCounts as Array<Record<string, unknown>>) ?? []) {
    const key = String(q.assessment_id);
    const entry = questionTotals.get(key) ?? { count: 0, marks: 0 };
    entry.count += 1;
    entry.marks += Number(q.marks) || 0;
    questionTotals.set(key, entry);
  }

  const { data: inviteCounts } = assessmentIds.length
    ? await supabase.from('assessment_invites').select('assessment_id').in('assessment_id', assessmentIds)
    : { data: [] };
  const invitesPerAssessment = new Map<string, number>();
  for (const inv of (inviteCounts as Array<Record<string, unknown>>) ?? []) {
    const key = String(inv.assessment_id);
    invitesPerAssessment.set(key, (invitesPerAssessment.get(key) ?? 0) + 1);
  }

  return {
    job: {
      ...job,
      assessmentCount: assessments.length,
      publishedAssessmentCount: assessments.filter((a) => String(a.status) === 'published').length,
      shortlistedCount: counts.shortlisted,
    },
    counts,
    pipeline,
    assessments: assessments.map((a) => {
      const id = String(a.id);
      const totals = questionTotals.get(id) ?? { count: 0, marks: 0 };
      return {
        id,
        name: String(a.name),
        status: String(a.status),
        durationMinutes: Number(a.duration_minutes ?? 0),
        passingScore: Number(a.passing_score ?? 0),
        snapshotVersion: Number(a.snapshot_version ?? 0),
        totalQuestions: totals.count,
        totalMarks: totals.marks,
        availableUntil: a.available_until ? String(a.available_until) : null,
        inviteCount: invitesPerAssessment.get(id) ?? 0,
      };
    }),
    readOnly: job.status === 'closed',
    invitesAllowedWhenClosed: job.progression_config?.allow_invites_when_closed === true,
  };
}

/**
 * The eligible assessment list: candidates a recruiter has SHORTLISTED on this
 * job. This is the same predicate the invitation endpoint enforces, so the UI
 * can never offer to invite someone the backend would refuse.
 */
export async function listShortlistedForAssessment(input: {
  recruiterId: string;
  jobId: string;
  limit?: number;
}): Promise<WorkspaceCandidateRow[]> {
  const workspace = await loadWorkspace({
    recruiterId: input.recruiterId,
    jobId: input.jobId,
    limit: input.limit,
  });
  return workspace.pipeline.filter((row) => row.stage === 'Shortlisted');
}

/**
 * Unified per-application journey for one candidate on one job.
 *
 * Every step carries its REAL status and timestamp, and `href` points at the
 * record it summarises rather than at an unrelated page.
 */
export interface JourneyStep {
  key: string;
  label: string;
  state: 'completed' | 'current' | 'upcoming' | 'blocked';
  at: string | null;
  detail: string | null;
  href: string | null;
}

export async function loadCandidateJourney(input: {
  recruiterId: string;
  jobId: string;
  candidateId: string;
}): Promise<{
  job: { id: string; title: string; status: string };
  application: { id: string; stage: PipelineStage | StageOutcome; stageChangedAt: string | null };
  steps: JourneyStep[];
}> {
  await requireOwnedJobAndCandidate(input.recruiterId, input.jobId, input.candidateId);

  const job = await requireOwnedJob(input.recruiterId, input.jobId);
  const application = await getApplicationRecord(input.jobId, input.candidateId);
  if (!application) {
    throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
  }

  const stage = normalizeStage(application.current_stage) ?? 'Applied';
  const supabase = getSupabaseClient();
  const screening = await readScreening(input.jobId, input.candidateId);

  const { data: timelineRows } = await supabase
    .from('candidate_status_log')
    .select('status, details, created_at')
    .eq('candidate_id', input.candidateId)
    .eq('job_id', input.jobId)
    .order('created_at', { ascending: true })
    .limit(200);

  const timeline = (timelineRows as Array<Record<string, unknown>>) ?? [];
  const firstAt = (status: string): string | null => {
    const hit = timeline.find((t) => String(t.status) === status);
    return hit?.created_at ? String(hit.created_at) : null;
  };

  const workspace = await loadWorkspace({
    recruiterId: input.recruiterId,
    jobId: input.jobId,
    limit: 2000,
  });
  const row = workspace.pipeline.find((p) => p.candidateId === input.candidateId);

  const reached = (target: PipelineStage): boolean => {
    const order: Array<PipelineStage | StageOutcome> = [
      'Applied',
      'Screening',
      'Shortlisted',
      'Assessment',
      'Technical Round',
      'Interview',
      'Final Decision',
      'Hired',
    ];
    const currentIndex = order.indexOf(stage);
    const targetIndex = order.indexOf(target);
    if (currentIndex < 0 || targetIndex < 0) return false;
    return currentIndex >= targetIndex;
  };

  const step = (
    key: string,
    label: string,
    target: PipelineStage,
    opts: { at?: string | null; detail?: string | null; href?: string | null } = {},
  ): JourneyStep => {
    const isReached = reached(target);
    const isCurrent = stage === target;
    return {
      key,
      label,
      state: isCurrent ? 'current' : isReached ? 'completed' : 'upcoming',
      at: opts.at ?? firstAt(target),
      detail: opts.detail ?? null,
      href: opts.href ?? null,
    };
  };

  const assessmentHref = row?.assessment?.assessmentId
    ? `/assessments/${row.assessment.assessmentId}`
    : null;
  const steps: JourneyStep[] = [
    step('screening', 'Screened', 'Screening', {
      detail: screening
        ? `${screening.overall}/100 · ${screening.status}${screening.overridden ? ' (recruiter override)' : ''}`
        : 'No screening result yet',
    }),
    step('shortlisted', 'Shortlisted', 'Shortlisted', {
      at: application.shortlisted_at ?? null,
      href: null,
    }),
    step('assessment', 'Assessment', 'Assessment', {
      at: row?.assessment?.sentAt ?? null,
      detail: row?.assessment
        ? `${row.assessment.state}${row.assessment.snapshotVersion ? ` · v${row.assessment.snapshotVersion}` : ''}`
        : 'Not created',
      href: assessmentHref,
    }),
    step('completed', 'Assessment completed', 'Assessment', {
      at: row?.assessment?.submittedAt ?? null,
      detail:
        row?.assessment?.percentage != null
          ? `${row.assessment.percentage}% · ${row.assessment.passed ? 'pass' : 'not passed'}`
          : null,
    }),
    step('report', 'Report reviewed', 'Technical Round', {
      detail: row?.hasReport ? 'Report available' : 'Not generated',
    }),
    step('technical', 'Technical round', 'Technical Round', {
      at: row?.interview ? `${row.interview.scheduledDate} ${row.interview.scheduledTime}` : null,
      detail: row?.interview ? row.interview.status : null,
    }),
    step('interview', 'Interview', 'Interview', {
      detail: row?.interview ? row.interview.status : null,
    }),
    step('decision', 'Final decision', 'Final Decision', {
      detail: stage === 'Hired' ? 'Hired' : stage === 'Rejected' ? 'Rejected' : null,
    }),
  ];

  return {
    job: { id: job.id, title: job.title, status: job.status },
    application: {
      id: application.id,
      stage,
      stageChangedAt: application.stage_changed_at ?? null,
    },
    steps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function matchApplication(rows: Array<Record<string, unknown>>, candidateId: string): string | null {
  const hit = rows.find((r) => String(r.candidate_id) === candidateId);
  return hit ? String(hit.id) : null;
}

function bumpStageCount(counts: WorkspaceCounts, stage: PipelineStage | StageOutcome): void {
  switch (stage) {
    case 'Applied':
      counts.applied += 1;
      break;
    case 'Screening':
      counts.screening += 1;
      break;
    case 'Shortlisted':
      counts.shortlisted += 1;
      break;
    case 'Assessment':
      counts.assessment += 1;
      break;
    case 'Technical Round':
      counts.technicalRound += 1;
      break;
    case 'Interview':
      counts.interview += 1;
      break;
    case 'Final Decision':
      counts.finalDecision += 1;
      break;
    case 'Hired':
      counts.hired += 1;
      break;
    case 'Rejected':
      counts.rejected += 1;
      break;
    case 'Hold':
    case 'Withdrawn':
      counts.hold += 1;
      break;
  }
}

/**
 * Assessment sub-state counts are only accumulated for candidates who have
 * actually reached the assessment part of the pipeline. Counting a "draft"
 * assessment for someone still in Applied would inflate the funnel with people
 * who were never offered it.
 */
function bumpAssessmentCount(
  counts: WorkspaceCounts,
  state: AssessmentState,
  stage: PipelineStage | StageOutcome,
): void {
  const relevant =
    stage === 'Shortlisted' ||
    ['Assessment', 'Technical Round', 'Interview', 'Final Decision', 'Hired'].includes(stage);
  if (!relevant) return;

  switch (state) {
    case 'not_created':
      counts.notCreated += 1;
      break;
    case 'draft':
      counts.draft += 1;
      break;
    case 'ready_to_send':
      counts.readyToSend += 1;
      break;
    case 'invited':
      counts.invited += 1;
      break;
    case 'in_progress':
      counts.inProgress += 1;
      break;
    case 'completed':
      counts.completed += 1;
      break;
    case 'expired':
      counts.expired += 1;
      break;
    case 'failed':
      counts.failed += 1;
      break;
  }
}

async function countAssessments(jobId: string): Promise<number> {
  const { count } = await getSupabaseClient()
    .from('assessments')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);
  return count ?? 0;
}

async function listJobAssessments(
  jobId: string,
): Promise<WorkspacePayload['assessments']> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('assessments')
    .select(
      'id, name, status, duration_minutes, passing_score, snapshot_version, available_until, created_at',
    )
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  const rows = (data as Array<Record<string, unknown>>) ?? [];
  const ids = rows.map((r) => String(r.id));
  if (ids.length === 0) return [];

  const { data: questions } = await supabase
    .from('assessment_questions')
    .select('assessment_id, marks')
    .in('assessment_id', ids);
  const totals = new Map<string, { count: number; marks: number }>();
  for (const q of (questions as Array<Record<string, unknown>>) ?? []) {
    const key = String(q.assessment_id);
    const entry = totals.get(key) ?? { count: 0, marks: 0 };
    entry.count += 1;
    entry.marks += Number(q.marks) || 0;
    totals.set(key, entry);
  }

  const { data: invites } = await supabase
    .from('assessment_invites')
    .select('assessment_id')
    .in('assessment_id', ids);
  const inviteCounts = new Map<string, number>();
  for (const inv of (invites as Array<Record<string, unknown>>) ?? []) {
    const key = String(inv.assessment_id);
    inviteCounts.set(key, (inviteCounts.get(key) ?? 0) + 1);
  }

  return rows.map((r) => {
    const id = String(r.id);
    const t = totals.get(id) ?? { count: 0, marks: 0 };
    return {
      id,
      name: String(r.name),
      status: String(r.status),
      durationMinutes: Number(r.duration_minutes ?? 0),
      passingScore: Number(r.passing_score ?? 0),
      snapshotVersion: Number(r.snapshot_version ?? 0),
      totalQuestions: t.count,
      totalMarks: t.marks,
      availableUntil: r.available_until ? String(r.available_until) : null,
      inviteCount: inviteCounts.get(id) ?? 0,
    };
  });
}