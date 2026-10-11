/**
 * Canonical hiring pipeline — the single source of truth for hiring state.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ PIPELINE (ordered)                                              │
 * │   Applied → Screening → Assessment → Technical Interview       │
 * │          → Managerial/HR → Offer → Hired                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ OUTCOMES (NOT pipeline stages — they end or park the pipeline)  │
 * │   Rejected | Withdrawn | Hold                                  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Operational states (scheduled / in progress / no-show) are deliberately
 * NOT hiring stages. They live on `interviews.status` and
 * `assessment_attempts.status`. Being "invited to an assessment" is not the
 * same hiring state as "passed an assessment".
 *
 * STATE-TRANSITION MATRIX
 * -----------------------
 * `from` rows are canonical stages plus the legacy `Interview` value that
 * older rows still contain. `to` columns mirror the pipeline. A blank cell is
 * an INVALID transition and is rejected server-side.
 *
 *              → Applied  Screening  Assessment  Tech.Int.  HR/Offer  Offer  Hired
 *   Applied        ✗          ✓           ✗           ✗          ✗       ✗      ✗
 *   Screening      ✗          ✗           ✓           ✗          ✗       ✗      ✗
 *   Assessment     ✗          ✗           ✗           ✓          ✗       ✗      ✗
 *   Technical Int. ✗          ✗           ✗           ✗          ✓       ✗      ✗
 *   Managerial/HR  ✗          ✗           ✗           ✗          ✗       ✓      ✗
 *   Offer          ✗          ✗           ✗           ✗          ✗       ✗      ✗ (recruiter-only)
 *   Hired          terminal — no outbound transitions
 *
 * From ANY non-terminal stage a candidate may move to any outcome:
 *   Rejected | Withdrawn | Hold
 *
 * Rules enforced by `isValidTransition`:
 *   1. Stages never move backwards.
 *   2. Stages are never skipped — `Applied → Assessment` is invalid.
 *   3. `Hired` is terminal.
 *   4. `Offer → Hired` is recruiter-only. `advanceCandidate` hard-blocks it so
 *      no automation (and no high AI score) can hire someone.
 *   5. Legacy `Interview` maps onto `Technical Interview` for read purposes.
 */

export const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Assessment',
  'Technical Interview',
  'Managerial/HR',
  'Offer',
  'Hired',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_OUTCOMES = ['Rejected', 'Withdrawn', 'Hold'] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];

/** Legacy generic value kept only for reading old rows. Never write it. */
export const LEGACY_INTERVIEW_STAGE = 'Interview';

export const STAGE_ORDER: Record<string, number> = {
  Applied: 0,
  // Legacy synonym for Applied. Without a rank here it was unrankable and
  // every transition out of it was rejected as an unknown source stage.
  Shortlisted: 0,
  Screening: 1,
  Assessment: 2,
  'Technical Interview': 3,
  'Managerial/HR': 4,
  Offer: 5,
  Hired: 6,
  // Legacy stage occupies the Technical Interview slot.
  Interview: 3,
  Rejected: 99,
  Withdrawn: 99,
  Hold: 99,
};

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isStageOutcome(value: unknown): value is StageOutcome {
  return typeof value === 'string' && (STAGE_OUTCOMES as readonly string[]).includes(value);
}

/** Canonical ordering key. Legacy `Interview` reads as `Technical Interview`. */
export function stageRank(stage: string): number {
  const rank = STAGE_ORDER[stage];
  return typeof rank === 'number' ? rank : -1;
}

/** True when the candidate has reached a state that accepts no further moves. */
export function isTerminalStage(stage: string): boolean {
  return stage === 'Hired';
}

export interface TransitionCheck {
  valid: boolean;
  reason?: string;
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

  if (isTerminalStage(from)) {
    return { valid: false, reason: 'Hired is a terminal stage' };
  }

  // Any non-terminal stage may end in an outcome.
  if (toIsOutcome) return { valid: true };

  // Legacy rows: treat generic 'Interview' as the Technical Interview stage.
  const fromRank = stageRank(from);
  const toRank = stageRank(to);

  if (fromRank < 0) {
    return { valid: false, reason: `Unrecognised source stage '${from}'` };
  }
  if (toRank <= fromRank) {
    return { valid: false, reason: `Cannot move backwards from '${from}' to '${to}'` };
  }
  if (toRank > fromRank + 1) {
    return { valid: false, reason: `Cannot skip stages: '${from}' → '${to}' skips ${toRank - fromRank - 1} stage(s)` };
  }

  // Offer → Hired is the only legal forward step that automation may not take.
  if (from === 'Offer' && to === 'Hired') {
    return { valid: false, reason: 'Hiring is a recruiter decision and cannot be automated' };
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
 * `Screening → Assessment` is deliberately absent: moving a candidate into
 * the Assessment stage happens when the recruiter invites them, not
 * automatically on a screening result.
 */
export function nextStageAfter(from: string): PipelineStage | null {
  switch (from) {
    case 'Applied':
    case 'Shortlisted':
      return 'Screening';
    case 'Assessment':
      return 'Technical Interview';
    case 'Technical Interview':
    case 'Interview': // legacy rows advance to HR
      return 'Managerial/HR';
    case 'Managerial/HR':
      return 'Offer';
    case 'Offer':
      // Present for completeness; `isValidTransition` blocks automated use and
      // `advanceCandidate` hard-throws if it is ever reached.
      return 'Hired';
    default:
      return null;
  }
}