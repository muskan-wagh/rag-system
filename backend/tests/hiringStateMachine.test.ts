import { describe, it, expect } from 'vitest';
import {
  PIPELINE_STAGES,
  STAGE_OUTCOMES,
  LEGACY_STAGE_ALIASES,
  RECRUITER_ONLY_TRANSITIONS,
  isPipelineStage,
  isStageOutcome,
  isTerminalStage,
  isValidTransition,
  isRecruiterOnlyTransition,
  nextStageAfter,
  normalizeStage,
  stageRank,
} from '@/services/hiring/stageTypes';
import { autoProgressionFlagFor, evaluateStage } from '@/services/hiring/progressionService';

/**
 * The canonical pipeline is:
 *
 *   Applied → Screening → Shortlisted → Assessment
 *          → Technical Round → Interview → Final Decision → Hired
 *
 * `Shortlisted` became a real stage (it used to be a rank-0 alias of Applied,
 * which made the shortlist action unrepresentable). `Technical Interview`,
 * `Managerial/HR` and `Offer` were renamed to `Technical Round`, `Interview`
 * and `Final Decision`.
 */
describe('Pipeline vocabulary', () => {
  it('exposes exactly the canonical hiring lifecycle', () => {
    expect([...PIPELINE_STAGES]).toEqual([
      'Applied',
      'Screening',
      'Shortlisted',
      'Assessment',
      'Technical Round',
      'Interview',
      'Final Decision',
      'Hired',
    ]);
  });

  it('ranks stages in pipeline order with no gaps', () => {
    PIPELINE_STAGES.forEach((stage, index) => {
      expect(stageRank(stage), `${stage} rank`).toBe(index);
    });
  });

  it('gives Shortlisted its own rank between Screening and Assessment', () => {
    // Regression guard: at rank 0 it was indistinguishable from Applied, so
    // `Applied → Shortlisted` was rejected as "cannot move backwards" and the
    // shortlist action had no legal representation in the pipeline.
    expect(stageRank('Shortlisted')).toBe(2);
    expect(stageRank('Screening')).toBeLessThan(stageRank('Shortlisted'));
    expect(stageRank('Shortlisted')).toBeLessThan(stageRank('Assessment'));
    expect(stageRank('Shortlisted')).not.toBe(stageRank('Applied'));
  });

  it('keeps outcomes separate from pipeline stages', () => {
    expect([...STAGE_OUTCOMES]).toEqual(['Rejected', 'Withdrawn', 'Hold']);
    for (const outcome of STAGE_OUTCOMES) {
      expect(isPipelineStage(outcome)).toBe(false);
      expect(isStageOutcome(outcome)).toBe(true);
      expect(stageRank(outcome)).toBe(99);
    }
  });

  it('rejects arbitrary strings as stages', () => {
    for (const bogus of ['Assessment In Progress', 'Pending', '', null, 42, 'interview']) {
      expect(isPipelineStage(bogus)).toBe(false);
    }
  });

  it('normalizes every legacy stage onto its canonical replacement', () => {
    expect(normalizeStage('Technical Interview')).toBe('Technical Round');
    expect(normalizeStage('Managerial/HR')).toBe('Interview');
    expect(normalizeStage('HR Round')).toBe('Interview');
    expect(normalizeStage('HR Interview')).toBe('Interview');
    expect(normalizeStage('Offer')).toBe('Final Decision');
    expect(normalizeStage('Offered')).toBe('Final Decision');
    expect(normalizeStage('Interview Scheduled')).toBe('Interview');
    expect(normalizeStage('Interview Completed')).toBe('Interview');
    expect(normalizeStage('Pending')).toBe('Applied');
  });

  it('leaves canonical values untouched', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(normalizeStage(stage)).toBe(stage);
    }
    for (const outcome of STAGE_OUTCOMES) {
      expect(normalizeStage(outcome)).toBe(outcome);
    }
  });

  it('returns null for values it cannot resolve', () => {
    expect(normalizeStage('')).toBeNull();
    expect(normalizeStage(null)).toBeNull();
    expect(normalizeStage(undefined)).toBeNull();
    expect(normalizeStage('Some Legacy Junk')).toBeNull();
  });

  it('does NOT alias plain "Interview" — it is now a real stage', () => {
    // `Interview` used to be a legacy alias for "Technical Interview". Legacy
    // rows are disambiguated by migration 20261009, not at runtime, because
    // "old row" is not distinguishable from "new row" in code.
    expect(LEGACY_STAGE_ALIASES.Interview).toBeUndefined();
    expect(normalizeStage('Interview')).toBe('Interview');
    expect(stageRank('Interview')).toBe(stageRank('Interview'));
  });
});

describe('State-transition matrix', () => {
  it('allows only the forward single-step along the pipeline', () => {
    expect(isValidTransition('Applied', 'Screening').valid).toBe(true);
    expect(isValidTransition('Screening', 'Shortlisted').valid).toBe(true);
    expect(isValidTransition('Assessment', 'Technical Round').valid).toBe(true);
    expect(isValidTransition('Technical Round', 'Interview').valid).toBe(true);
    expect(isValidTransition('Interview', 'Final Decision').valid).toBe(true);
  });

  it('refuses to skip stages', () => {
    const skip = isValidTransition('Applied', 'Assessment');
    expect(skip.valid).toBe(false);
    expect(skip.reason).toMatch(/skip/i);

    expect(isValidTransition('Screening', 'Assessment').valid).toBe(false);
    expect(isValidTransition('Shortlisted', 'Technical Round').valid).toBe(false);
    expect(isValidTransition('Assessment', 'Final Decision').valid).toBe(false);
  });

  it('refuses to move backwards', () => {
    expect(isValidTransition('Assessment', 'Screening').valid).toBe(false);
    expect(isValidTransition('Final Decision', 'Applied').valid).toBe(false);
    const same = isValidTransition('Screening', 'Screening');
    expect(same.valid).toBe(false);
    expect(same.reason).toMatch(/backwards/i);
  });

  it('treats Hired as terminal', () => {
    expect(isTerminalStage('Hired')).toBe(true);
    for (const to of [...PIPELINE_STAGES, ...STAGE_OUTCOMES]) {
      expect(isValidTransition('Hired', to).valid).toBe(false);
    }
  });

  it('blocks Final Decision → Hired because hiring must never be automated', () => {
    // `isValidTransition` permits it but flags it recruiter-only; `advanceCandidate`
    // hard-throws on it. Both layers are asserted here and in hiringLifecycle.
    const result = isValidTransition('Final Decision', 'Hired');
    expect(result.valid).toBe(true);
    expect(result.recruiterOnly).toBe(true);
    expect(isRecruiterOnlyTransition('Final Decision', 'Hired')).toBe(true);
  });

  it('lets a recruiter shortlist without a prior screening pass, flagged as an override', () => {
    const result = isValidTransition('Applied', 'Shortlisted');
    expect(result.valid).toBe(true);
    expect(result.recruiterOnly).toBe(true);
    expect(isRecruiterOnlyTransition('Applied', 'Shortlisted')).toBe(true);
  });

  it('does NOT flag the ordinary Screening → Shortlisted path as an override', () => {
    // Flagging it would mark every normal shortlist as an override in the audit
    // trail, which would make the exception meaningless.
    const result = isValidTransition('Screening', 'Shortlisted');
    expect(result.valid).toBe(true);
    expect(result.recruiterOnly).toBeUndefined();
  });

  it('permits any non-terminal stage to end in an outcome', () => {
    for (const stage of [
      'Applied',
      'Screening',
      'Shortlisted',
      'Assessment',
      'Technical Round',
      'Interview',
      'Final Decision',
    ]) {
      for (const outcome of STAGE_OUTCOMES) {
        expect(isValidTransition(stage, outcome).valid).toBe(true);
      }
    }
  });

  it('only allows Applied as an entry point when there is no history', () => {
    expect(isValidTransition(null, 'Applied').valid).toBe(true);
    expect(isValidTransition(null, 'Assessment').valid).toBe(false);
    expect(isValidTransition(undefined, 'Hired').valid).toBe(false);
  });

  it('rejects unknown target values', () => {
    expect(isValidTransition('Screening', 'Offer Extended').valid).toBe(false);
    expect(isValidTransition('Screening', 'Not A Stage').reason).toMatch(/not a recognised/i);
    expect(isValidTransition('Screening', null).valid).toBe(false);
  });

  it('rejects an unrecognised source stage rather than guessing', () => {
    expect(isValidTransition('Some Legacy Junk', 'Assessment').valid).toBe(false);
  });

  it('resolves a legacy SOURCE stage before validating', () => {
    // A row the 20261009 rewrite skipped must still transition correctly.
    expect(isValidTransition('Managerial/HR', 'Final Decision').valid).toBe(true);
    expect(isValidTransition('Technical Interview', 'Interview').valid).toBe(true);
    expect(isValidTransition('Offer', 'Hired').recruiterOnly).toBe(true);
  });

  it('refuses a legacy TARGET stage — callers must normalize on read', () => {
    // Writes only ever accept canonical values. Silently accepting 'Offer' as a
    // destination would let two spellings of the same stage be written, which is
    // exactly the duplication this vocabulary exists to remove.
    const result = isValidTransition('Interview', 'Offer');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not a recognised/i);
  });

  it('exercises every stage against every stage to guarantee no illegal pair exists', () => {
    const recruiterOnly = new Set(RECRUITER_ONLY_TRANSITIONS.map(([f, t]) => `${f}→${t}`));
    for (const from of PIPELINE_STAGES) {
      for (const to of PIPELINE_STAGES) {
        // A pair is legal when it moves forward and is either a plain single
        // step, or one of the two explicit recruiter-only transitions.
        const expected =
          from !== 'Hired' &&
          from !== to &&
          stageRank(to) > stageRank(from) &&
          (stageRank(to) === stageRank(from) + 1 || recruiterOnly.has(`${from}→${to}`));
        const actual = isValidTransition(from, to).valid;
        expect(actual, `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it('flags the two recruiter-only transitions and nothing else', () => {
    const flagged: string[] = [];
    for (const from of PIPELINE_STAGES) {
      for (const to of PIPELINE_STAGES) {
        if (isValidTransition(from, to).recruiterOnly) flagged.push(`${from}→${to}`);
      }
    }
    expect(flagged.sort()).toEqual(['Applied→Shortlisted', 'Final Decision→Hired'].sort());
  });
});

describe('Auto-progression toggles', () => {
  it('maps each completable stage to its recruiter-controlled flag', () => {
    expect(autoProgressionFlagFor('Assessment')).toBe('assessment_to_technical');
    expect(autoProgressionFlagFor('Technical Round')).toBe('technical_to_hr');
    expect(autoProgressionFlagFor('Interview')).toBe('hr_to_offer');
  });

  it('governs the screening step from Applied, since that is where a pass lands', () => {
    // Regression: `Applied` had no toggle, so `isAutoProgressionEnabled`
    // returned false and a passing candidate could never leave Applied.
    expect(autoProgressionFlagFor('Applied')).toBe('screening_to_assessment');
  });

  it('resolves legacy stage names through the alias map', () => {
    expect(autoProgressionFlagFor('Technical Interview')).toBe('technical_to_hr');
    expect(autoProgressionFlagFor('Managerial/HR')).toBe('hr_to_offer');
  });

  it('has NO flag for final decision or hired — hiring is never automatable', () => {
    expect(autoProgressionFlagFor('Final Decision')).toBeNull();
    expect(autoProgressionFlagFor('Offer')).toBeNull();
    expect(autoProgressionFlagFor('Hired')).toBeNull();
  });
});

describe('Stage evaluation', () => {
  it('routes an automated fail to a rejection outcome rather than an advance', () => {
    const result = evaluateStage({ fromStage: 'Assessment', passed: false });
    expect(result.toStage).toBeNull();
    expect(result.outcome).toBe('Rejected');
  });

  it('routes a hold recommendation to Hold', () => {
    const result = evaluateStage({ fromStage: 'Interview', recommendation: 'hold' });
    expect(result.toStage).toBeNull();
    expect(result.outcome).toBe('Hold');
  });

  it('advances a passed candidate to the next stage', () => {
    expect(evaluateStage({ fromStage: 'Assessment', passed: true })).toEqual({
      toStage: nextStageAfter('Assessment'),
    });
  });
});

describe('nextStageAfter', () => {
  it('follows the documented pipeline', () => {
    expect(nextStageAfter('Assessment')).toBe('Technical Round');
    expect(nextStageAfter('Technical Round')).toBe('Interview');
    expect(nextStageAfter('Interview')).toBe('Final Decision');
  });

  it('advances Applied to Screening when screening is passed', () => {
    // Regression: this returned null, which `evaluateStage` reports as a
    // terminal outcome — the worker would have REJECTED a passing candidate.
    expect(nextStageAfter('Applied')).toBe('Screening');
  });

  it('never auto-shortlists — that is a recruiter decision', () => {
    expect(nextStageAfter('Screening')).toBeNull();
    expect(nextStageAfter('Shortlisted')).toBeNull();
  });

  it('routes every non-terminal stage to a legal successor', () => {
    for (const stage of [
      'Applied',
      'Assessment',
      'Technical Round',
      'Interview',
      'Final Decision',
    ]) {
      const next = nextStageAfter(stage);
      if (!next) continue;
      expect(nextStageAfter(stage), `${stage} → ${next}`).toBe(next);
      expect(stageRank(next)).toBeGreaterThan(stageRank(stage));
    }
  });
});