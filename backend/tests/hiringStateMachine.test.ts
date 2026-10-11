import { describe, it, expect } from 'vitest';
import {
  PIPELINE_STAGES,
  STAGE_OUTCOMES,
  isPipelineStage,
  isStageOutcome,
  isTerminalStage,
  isValidTransition,
  nextStageAfter,
  stageRank,
} from '@/services/hiring/stageTypes';
import { autoProgressionFlagFor, evaluateStage } from '@/services/hiring/progressionService';

describe('Pipeline vocabulary', () => {
  it('exposes exactly the canonical hiring lifecycle', () => {
    expect([...PIPELINE_STAGES]).toEqual([
      'Applied',
      'Screening',
      'Assessment',
      'Technical Interview',
      'Managerial/HR',
      'Offer',
      'Hired',
    ]);
  });

  it('keeps outcomes separate from pipeline stages', () => {
    expect([...STAGE_OUTCOMES]).toEqual(['Rejected', 'Withdrawn', 'Hold']);
    for (const outcome of STAGE_OUTCOMES) {
      expect(isPipelineStage(outcome)).toBe(false);
      expect(isStageOutcome(outcome)).toBe(true);
    }
  });

  it('rejects arbitrary strings as stages', () => {
    for (const bogus of ['Assessment In Progress', 'Offered', '', null, 42, 'interview']) {
      expect(isPipelineStage(bogus)).toBe(false);
    }
  });

  it('maps legacy Interview onto the Technical Interview rank', () => {
    expect(stageRank('Interview')).toBe(stageRank('Technical Interview'));
  });
});

describe('State-transition matrix', () => {
  it('allows only the forward single-step along the pipeline', () => {
    expect(isValidTransition('Applied', 'Screening').valid).toBe(true);
    expect(isValidTransition('Screening', 'Assessment').valid).toBe(true);
    expect(isValidTransition('Assessment', 'Technical Interview').valid).toBe(true);
    expect(isValidTransition('Technical Interview', 'Managerial/HR').valid).toBe(true);
    expect(isValidTransition('Managerial/HR', 'Offer').valid).toBe(true);
  });

  it('refuses to skip stages', () => {
    const skip = isValidTransition('Applied', 'Assessment');
    expect(skip.valid).toBe(false);
    expect(skip.reason).toMatch(/skip/i);

    expect(isValidTransition('Screening', 'Technical Interview').valid).toBe(false);
    expect(isValidTransition('Assessment', 'Offer').valid).toBe(false);
  });

  it('refuses to move backwards', () => {
    expect(isValidTransition('Assessment', 'Screening').valid).toBe(false);
    expect(isValidTransition('Offer', 'Applied').valid).toBe(false);
    const same = isValidTransition('Screening', 'Screening');
    expect(same.valid).toBe(false);
  });

  it('treats Hired as terminal', () => {
    expect(isTerminalStage('Hired')).toBe(true);
    for (const to of [...PIPELINE_STAGES, ...STAGE_OUTCOMES]) {
      expect(isValidTransition('Hired', to).valid).toBe(false);
    }
  });

  it('blocks Offer → Hired because hiring must never be automated', () => {
    const result = isValidTransition('Offer', 'Hired');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/recruiter/i);
  });

  it('permits any non-terminal stage to end in an outcome', () => {
    for (const stage of ['Applied', 'Screening', 'Assessment', 'Technical Interview', 'Managerial/HR', 'Offer']) {
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

  it('exercises every stage against every stage to guarantee no illegal pair exists', () => {
    const legal = new Set(['Screening', 'Assessment', 'Technical Interview', 'Managerial/HR', 'Offer']);
    for (const from of PIPELINE_STAGES) {
      for (const to of PIPELINE_STAGES) {
        const expected = from !== 'Hired' && from !== to && legal.has(to) && stageRank(to) === stageRank(from) + 1;
        const actual = isValidTransition(from, to).valid;
        expect(actual, `${from} → ${to}`).toBe(expected);
      }
    }
  });
});

describe('Auto-progression toggles', () => {
  it('maps each completable stage to its recruiter-controlled flag', () => {
    expect(autoProgressionFlagFor('Screening')).toBe('screening_to_assessment');
    expect(autoProgressionFlagFor('Assessment')).toBe('assessment_to_technical');
    expect(autoProgressionFlagFor('Technical Interview')).toBe('technical_to_hr');
    expect(autoProgressionFlagFor('Managerial/HR')).toBe('hr_to_offer');
  });

  it('governs the screening step from Applied, since that is where a pass lands', () => {
    // Regression: `Applied` had no toggle, so `isAutoProgressionEnabled`
    // returned false and a passing candidate could never leave Applied.
    expect(autoProgressionFlagFor('Applied')).toBe('screening_to_assessment');
  });

  it('has NO flag for terminal stages — hiring is never automatable', () => {
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
    const result = evaluateStage({ fromStage: 'Managerial/HR', recommendation: 'hold' });
    expect(result.toStage).toBeNull();
    expect(result.outcome).toBe('Hold');
  });

  it('advances a passed candidate to the next stage', () => {
    expect(evaluateStage({ fromStage: 'Screening', passed: true })).toEqual({
      toStage: nextStageAfter('Screening'),
    });
  });
});

describe('nextStageAfter', () => {
  it('follows the documented pipeline', () => {
    expect(nextStageAfter('Assessment')).toBe('Technical Interview');
    expect(nextStageAfter('Technical Interview')).toBe('Managerial/HR');
    expect(nextStageAfter('Managerial/HR')).toBe('Offer');
  });

  it('advances Applied to Screening when screening is passed', () => {
    // Regression: this returned null, which `evaluateStage` reports as a
    // terminal outcome — the worker would have REJECTED a passing candidate.
    expect(nextStageAfter('Applied')).toBe('Screening');
    expect(nextStageAfter('Shortlisted')).toBe('Screening');
  });

  it('does not auto-advance Screening into Assessment (recruiter invites instead)', () => {
    expect(nextStageAfter('Screening')).toBeNull();
  });

  it('routes every non-terminal stage to a legal successor, except the recruiter-only hire', () => {
    // Exhaustively confirm no stage can evaluate into an illegal transition.
    // `Offer → Hired` is the single deliberate exception: hiring is never
    // automatable, so that pair must remain invalid.
    const RECRUITER_ONLY: Record<string, string> = { Offer: 'Hired' };
    for (const stage of ['Applied', 'Shortlisted', 'Screening', 'Assessment', 'Technical Interview', 'Managerial/HR', 'Offer']) {
      const next = nextStageAfter(stage);
      if (!next) continue;
      const expectedInvalid = RECRUITER_ONLY[stage] === next;
      expect(isValidTransition(stage, next).valid, `${stage} → ${next}`).toBe(!expectedInvalid);
    }
  });
});