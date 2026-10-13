/**
 * Canonical hiring pipeline — the single source of truth for hiring state.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ PIPELINE (ordered, rank = array index)                           │
 * │   0 Applied → 1 Screening → 2 Shortlisted → 3 Assessment        │
 * │   → 4 Technical Round → 5 Interview → 6 Final Decision → 7 Hired│
 * └──────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ OUTCOMES (NOT pipeline stages — they end or park the pipeline)   │
 * │   Rejected | Withdrawn | Hold                                   │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Operational states (scheduled / in progress / no-show) are deliberately
 * NOT hiring stages. They live on `interviews.status` and
 * `assessment_attempts.status`. Being "invited to an assessment" is not the
 * same hiring state as "passed an assessment".
 *
 * WHY THIS FILE CHANGED
 * ---------------------
 * `Shortlisted` used to be a rank-0 legacy alias of `Applied`, so the
 * shortlist action could never be expressed as a forward transition
 * (`Applied → Shortlisted` was rejected as "cannot move backwards"). It is
 * now a real stage between `Screening` and `Assessment`, because a
 * shortlist is a recruiter decision made *after* a candidate has been
 * screened and *before* they can be invited to an assessment.
 *
 * Three stages were renamed to match the product vocabulary. The rename is
 * deliberately read-compatible: every legacy value is mapped through
 * `LEGACY_STAGE_ALIASES` by `normalizeStage`, and migration
 * `20261009_canonical_stage_vocabulary.sql` rewrites the stored rows so the
 * database and the code agree.
 *
 *   Technical Interview → Technical Round
 *   Managerial/HR       → Interview
 *   Offer               → Final Decision
 *
 * STATE-TRANSITION MATRIX
 * -----------------------
 * `from` rows are canonical stages. `to` columns mirror the pipeline. A blank
 * cell is an INVALID transition and is rejected server-side.
 *
 *   →  Applied  Screening  Shortl.  Assess.  Tech.Rnd  Interv.  Fin.Dec  Hired
 *   Applied      ✗         ✓        ✗        ✗        ✗        ✗       ✗      ✗
 *   Screening    ✗         ✗        ✓        ✗        ✗        ✗       ✗      ✗
 *   Shortlisted  ✗         ✗        ✗        ✗        ✗        ✗       ✗      ✗
 *   Assessment   ✗         ✗        ✗        ✗        ✓        ✗       ✗      ✗
 *   Tech. Round  ✗         ✗        ✗        ✗        ✗        ✓       ✗      ✗
 *   Interview    ✗         ✗        ✗        ✗        ✗        ✗       ✓      ✗
 *   Final Dec.   ✗         ✗        ✗        ✗        ✗        ✗       ✗      ✗ (recruiter-only)
 *   Hired        terminal — no outbound transitions
 *
 * `Applied → Shortlisted` is additionally allowed as an explicit recruiter
 * override (see `RECRUITER_ONLY_TRANSITIONS`) so a recruiter is never blocked
 * by a missing screening record. Automation can never take it.
 *
 * From ANY non-terminal stage a candidate may move to any outcome:
 *   Rejected | Withdrawn | Hold
 *
 * Rules enforced by `isValidTransition`:
 *   1. Stages never move backwards.
 *   2. Stages are never skipped — `Screening → Assessment` is invalid.
 *   3. `Hired` is terminal.
 *   4. `Final Decision → Hired` is recruiter-only. `advanceCandidate`
 *      hard-blocks it so no automation (and no high AI score) can hire someone.
 *   5. Legacy values are normalized before ranking, so pre-migration rows
 *      still transition correctly.
 */

export const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Shortlisted',
  'Assessment',
  'Technical Round',
  'Interview',
  'Final Decision',
  'Hired',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_OUTCOMES = ['Rejected', 'Withdrawn', 'Hold'] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];

/**
 * Legacy values that may still appear in rows written before migration
 * `20261009_canonical_stage_vocabulary.sql`. Maps to the canonical stage.
 *
 * NOTE: `Interview` is deliberately absent. It is now a canonical stage (rank
 * 5), so it normalises to itself. Legacy rows that stored the *generic*
 * `Interview` value meaning "technical round" are rewritten by the migration,
 * which can distinguish them by timestamp; runtime code cannot.
 */
export const LEGACY_STAGE_ALIASES: Record<string, PipelineStage> = {
  'Technical Interview': 'Technical Round',
  'Managerial/HR': 'Interview',
  'HR Round': 'Interview',
  'HR Interview': 'Interview',
  Offer: 'Final Decision',
  Offered: 'Final Decision',
  'Interview Scheduled': 'Interview',
  'Interview Completed': 'Interview',
  Pending: 'Applied',
};

/**
 * Stages whose outgoing transition may only ever be taken by a recruiter
 * acting deliberately — never by automation, never on the strength of an AI
 * score alone.
 *
 * `Screening → Shortlisted` is deliberately NOT here: it is the ordinary path
 * (rank 1 → 2, no gap), and flagging it would mark every normal shortlist as an
 * override in the audit trail.
 *
 * `Applied → Shortlisted` IS here because it crosses the `Screening` rank. A
 * recruiter shortlisting someone off an unscreened CV is a legitimate decision,
 * but it is an override and the service records it as one.
 */
export const RECRUITER_ONLY_TRANSITIONS: Array<[string, string]> = [
  ['Applied', 'Shortlisted'],
  ['Final Decision', 'Hired'],
];

const RECRUITER_ONLY_SET = new Set(
  RECRUITER_ONLY_TRANSITIONS.map(([from, to]) => `${from}→${to}`),
);

export function isRecruiterOnlyTransition(from: string, to: string): boolean {
  return RECRUITER_ONLY_SET.has(`${from}→${to}`);
}

/** Canonical ordering key. Legacy values resolve through the alias map. */
export function stageRank(stage: string): number {
  const direct = PIPELINE_STAGES.indexOf(stage as PipelineStage);
  if (direct >= 0) return direct;

  const legacy = LEGACY_STAGE_ALIASES[stage];
  if (legacy) return PIPELINE_STAGES.indexOf(legacy);

  const outcome = STAGE_OUTCOMES.indexOf(stage as StageOutcome);
  if (outcome >= 0) return 99;

  return -1;
}

/**
 * Maps any stored stage value onto the canonical vocabulary.
 * Returns null for empty input and for values it does not recognise, so
 * callers can decide between "unknown" and "legitimately unset".
 */
export function normalizeStage(
  value: string | null | undefined,
): PipelineStage | StageOutcome | null {
  if (!value) return null;
  if (isPipelineStage(value) || isStageOutcome(value)) return value;
  return LEGACY_STAGE_ALIASES[value] ?? null;
}

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isStageOutcome(value: unknown): value is StageOutcome {
  return typeof value === 'string' && (STAGE_OUTCOMES as readonly string[]).includes(value);
}

/** True when the candidate has reached a state that accepts no further moves. */
export function isTerminalStage(stage: string): boolean {
  return normalizeStage(stage) === 'Hired';
}

export interface TransitionCheck {
  valid: boolean;
  reason?: string;
  /** True when the transition is legal but only a recruiter may take it. */
  recruiterOnly?: boolean;
}

/**
 * Server-side transition validation.
 *
 * The previous implementation trusted `fromStage` and `toStage` from the
 * caller with no validation at all, so any endpoint could move a candidate
 * from `Rejected` to `Hired`, or skip straight from `Applied` to `Assessment`.
 */
export function isValidTransition(
  from: string | null | undefined,
  to: string | null | undefined,
): TransitionCheck {
  if (!to) {
    return { valid: false, reason: 'A target stage is required' };
  }

  // `to` must already be canonical. Callers are responsible for running
  // `normalizeStage` on stored values before calling this.
  const toIsOutcome = isStageOutcome(to);
  const toIsStage = isPipelineStage(to);
  if (!toIsOutcome && !toIsStage) {
    return { valid: false, reason: `'${to}' is not a recognised hiring stage or outcome` };
  }

  // An unknown/unset source can only enter the very first stage, so legacy
  // rows without history still have a legal entry point.
  if (!from) {
    return toIsStage && to === 'Applied'
      ? { valid: true }
      : { valid: false, reason: `Cannot enter '${to}' without an existing pipeline history` };
  }

  const fromRank = stageRank(from);
  const toRank = stageRank(to);

  if (fromRank < 0) {
    return { valid: false, reason: `Unrecognised source stage '${from}'` };
  }

  // Check terminality after normalization so a legacy 'Offer' row is still
  // recognized as pre-Hired rather than something unrankable.
  if (fromRank === PIPELINE_STAGES.indexOf('Hired')) {
    return { valid: false, reason: 'Hired is a terminal stage' };
  }

  // Any non-terminal stage may end in an outcome.
  if (toIsOutcome) return { valid: true };

  // Recruiter-only transitions are checked BEFORE the skip rule and are allowed
  // to cross a rank gap. Two pairs need this:
  //   Applied → Shortlisted    a recruiter shortlisting off an unscreened CV
  //   Final Decision → Hired   the hire itself
  // Both are explicit human decisions recorded as overrides, not automation
  // shortcuts, so the "never skip" rule does not apply to them.
  //
  // Matching is done on CANONICAL values so a legacy source row behaves the
  // same as a migrated one.
  const canonicalFrom = normalizeStage(from);
  const canonicalTo = normalizeStage(to);
  if (canonicalFrom && canonicalTo && isRecruiterOnlyTransition(canonicalFrom, canonicalTo)) {
    if (toRank > fromRank) {
      return { valid: true, recruiterOnly: true };
    }
    return { valid: false, reason: `Cannot move backwards from '${from}' to '${to}'` };
  }

  if (toRank <= fromRank) {
    return { valid: false, reason: `Cannot move backwards from '${from}' to '${to}'` };
  }
  if (toRank > fromRank + 1) {
    return { valid: false, reason: `Cannot skip stages: '${from}' → '${to}' skips ${toRank - fromRank - 1} stage(s)` };
  }

  return { valid: true };
}

/**
 * Next pipeline stage after a successful stage completion, or null when the
 * stage has no automated successor.
 *
 * `Applied → Screening` IS included: passing screening is what moves a
 * candidate out of Applied. Omitting it (as this function previously did)
 * made `evaluateStage` return `toStage: null`, which the progression worker
 * reads as a TERMINAL outcome — so a candidate who PASSED screening would have
 * been routed into `rejectCandidate`.
 *
 * `Screening → Shortlisted` is absent: shortlisting is a recruiter decision
 * made by looking at the candidate, never a consequence of an AI score.
 * `Shortlisted → Assessment` is likewise recruiter-driven (sending the
 * invitation), so it is absent too.
 */
export function nextStageAfter(from: string): PipelineStage | null {
  switch (normalizeStage(from)) {
    case 'Applied':
      return 'Screening';
    case 'Assessment':
      return 'Technical Round';
    case 'Technical Round':
      return 'Interview';
    case 'Interview':
      return 'Final Decision';
    case 'Final Decision':
      // Present for completeness; `isValidTransition` marks it recruiter-only
      // and `advanceCandidate` hard-throws if it is ever reached.
      return 'Hired';
    default:
      return null;
  }
}