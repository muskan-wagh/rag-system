import { describe, it, expect, vi } from 'vitest';
import {
  STATUS_FILTER_MAP,
  AGGREGATION_STATUS_GROUPS,
  PIPELINE_STAGE_STATUS,
  STAGE_OUTCOME_STATUS,
} from '@/constants/candidateStatus';
import { buildStatusFilterParam } from '@/services/supabase/database';
import { PIPELINE_STAGES, STAGE_OUTCOMES } from '@/services/hiring/stageTypes';

/**
 * Dashboard metrics are only meaningful if clicking one actually filters to
 * the right candidates. These tests pin the filter map to the canonical
 * pipeline vocabulary used by the progression service and the DB CHECK.
 */

function capturedFilter(status?: string) {
  const calls: { op: 'eq' | 'in'; column: string; value: unknown }[] = [];
  const query: Record<string, unknown> = {
    eq: (column: string, value: unknown) => {
      calls.push({ op: 'eq', column, value });
      return query;
    },
    in: (column: string, value: unknown) => {
      calls.push({ op: 'in', column, value });
      return query;
    },
  };
  buildStatusFilterParam(status)(query);
  return calls;
}

describe('Status filter map covers the canonical pipeline', () => {
  it('has a dedicated filter for every pipeline stage', () => {
    expect(STATUS_FILTER_MAP.applied).toBe(PIPELINE_STAGE_STATUS.APPLIED);
    expect(STATUS_FILTER_MAP.screening).toBe(PIPELINE_STAGE_STATUS.SCREENING);
    expect(STATUS_FILTER_MAP.assessment).toBe(PIPELINE_STAGE_STATUS.ASSESSMENT);
    expect(STATUS_FILTER_MAP.offer).toBe(PIPELINE_STAGE_STATUS.OFFER);
    expect(STATUS_FILTER_MAP.hired).toBe(PIPELINE_STAGE_STATUS.HIRED);
    expect(STATUS_FILTER_MAP.rejected).toBe(STAGE_OUTCOME_STATUS.REJECTED);
    expect(STATUS_FILTER_MAP.hold).toBe(STAGE_OUTCOME_STATUS.HOLD);
    expect(STATUS_FILTER_MAP.withdrawn).toBe(STAGE_OUTCOME_STATUS.WITHDRAWN);
  });

  it('groups technical and HR separately as well as jointly', () => {
    expect(STATUS_FILTER_MAP.technical).toContain(PIPELINE_STAGE_STATUS.TECHNICAL);
    expect(STATUS_FILTER_MAP.technical).not.toContain(PIPELINE_STAGE_STATUS.HR);
    expect(STATUS_FILTER_MAP.hr).toContain(PIPELINE_STAGE_STATUS.HR);
    expect(STATUS_FILTER_MAP.hr).not.toContain(PIPELINE_STAGE_STATUS.TECHNICAL);
    expect(STATUS_FILTER_MAP.interview).toContain(PIPELINE_STAGE_STATUS.TECHNICAL);
    expect(STATUS_FILTER_MAP.interview).toContain(PIPELINE_STAGE_STATUS.HR);
  });

  it('includes every in-flight stage in the "open" bucket', () => {
    const open = STATUS_FILTER_MAP.open as string[];
    for (const stage of ['Applied', 'Screening', 'Assessment', 'Technical Interview', 'Managerial/HR', 'Offer']) {
      expect(open).toContain(stage);
    }
    // Terminal outcomes are NOT open.
    expect(open).not.toContain('Hired');
    expect(open).not.toContain('Rejected');
    expect(open).not.toContain('Withdrawn');
  });

  it('excludes every canonical stage from the rejected bucket', () => {
    expect(AGGREGATION_STATUS_GROUPS.rejected).toEqual(['Rejected']);
  });

  it('no longer maps a filter to an empty array (which was a silent no-op)', () => {
    for (const [key, value] of Object.entries(STATUS_FILTER_MAP)) {
      if (Array.isArray(value)) {
        expect(value.length, `${key} must not be an empty array`).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildStatusFilterParam reaches the database', () => {
  it('emits an equality filter for a single stage', () => {
    expect(capturedFilter('assessment')).toEqual([
      { op: 'eq', column: 'current_status', value: 'Assessment' },
    ]);
  });

  it('emits an IN filter covering legacy and canonical technical statuses', () => {
    const calls = capturedFilter('technical');
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('in');
    expect(calls[0].column).toBe('current_status');
    expect(calls[0].value).toContain('Technical Interview');
    expect(calls[0].value).toContain('Technical Round');
  });

  it('applies no filter when no status is requested', () => {
    expect(capturedFilter(undefined)).toEqual([]);
    expect(capturedFilter('')).toEqual([]);
  });

  it('unions multiple comma-separated filters', () => {
    const calls = capturedFilter('hired,offer');
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('in');
    expect(calls[0].value).toEqual(expect.arrayContaining(['Hired', 'Offer']));
  });

  it('covers every pipeline stage through a working filter key', () => {
    // Each canonical stage must be reachable from the UI's filter vocabulary,
    // otherwise its dashboard tile would link to an unfiltered list.
    const reachable = new Set<string>();
    for (const value of Object.values(STATUS_FILTER_MAP)) {
      for (const entry of Array.isArray(value) ? value : [value]) reachable.add(entry);
    }
    for (const stage of PIPELINE_STAGES) {
      expect(reachable.has(stage), `${stage} is not reachable via any status filter`).toBe(true);
    }
    for (const outcome of STAGE_OUTCOMES) {
      expect(reachable.has(outcome), `${outcome} is not reachable via any status filter`).toBe(true);
    }
  });
});

describe('Stage buckets are mutually exclusive', () => {
  it('assigns each stage to exactly one current-stage bucket', () => {
    const currentStageBuckets = [
      STATUS_FILTER_MAP.applied,
      STATUS_FILTER_MAP.screening,
      STATUS_FILTER_MAP.assessment,
      STATUS_FILTER_MAP.technical,
      STATUS_FILTER_MAP.hr,
      STATUS_FILTER_MAP.offer,
      STATUS_FILTER_MAP.hired,
      STATUS_FILTER_MAP.rejected,
      STATUS_FILTER_MAP.hold,
      STATUS_FILTER_MAP.withdrawn,
    ].map((v) => (Array.isArray(v) ? v : [v]));

    for (const stage of PIPELINE_STAGES) {
      const bucketsContainingStage = currentStageBuckets.filter((b) => b.includes(stage));
      // A candidate has one `current_status`, so it can only be in one bucket.
      expect(bucketsContainingStage.length, `${stage} appears in multiple buckets`).toBeLessThanOrEqual(1);
    }
  });
});