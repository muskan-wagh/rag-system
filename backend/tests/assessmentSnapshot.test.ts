import { describe, it, expect } from 'vitest';
import {
  buildSnapshot,
  isValidSnapshot,
  persistSnapshot,
  resolveQuestionsForAttempt,
  aggregateSkillBreakdown,
  type SnapshotCapableAssessment,
  type RawQuestion,
} from '@/services/assessments/snapshot';

/**
 * Assessment snapshotting.
 *
 * Before this, scoring read `assessment_questions` live at submit time. A
 * recruiter could unpublish, edit and republish between two candidates opening
 * the same link, and the two would be graded against different papers under the
 * same URL. These tests pin the fix: an attempt is graded against the exact
 * published version it was issued against, forever.
 */

const QUESTION_V1: RawQuestion[] = [
  {
    id: 'q1',
    assessment_id: 'a-1',
    type: 'mcq',
    position: 0,
    title: 'Event loop',
    prompt: 'Which queue does setImmediate use?',
    // The answer key. This must be captured in the snapshot.
    payload: { options: [{ id: 'o1', text: 'check' }, { id: 'o2', text: 'immediate' }], correct_option_id: 'o2' },
    marks: 2,
    skill_tag: 'Node.js',
    is_required: true,
  },
  {
    id: 'q2',
    assessment_id: 'a-1',
    type: 'coding',
    position: 1,
    title: 'Debounce',
    prompt: 'Implement debounce.',
    payload: {
      language: 'javascript',
      starter_code: 'function debounce() {}',
      test_cases: [
        { input: '1,2', expected_output: '2', is_hidden: true },
        { input: '3,4,5', expected_output: '5', is_hidden: true },
      ],
    },
    marks: 8,
    skill_tag: 'JavaScript',
    is_required: true,
  },
];

function assessment(overrides: Partial<SnapshotCapableAssessment> = {}): SnapshotCapableAssessment {
  return {
    id: 'a-1',
    recruiter_id: 'rec-1',
    job_id: 'job-1',
    name: 'Backend Engineer — Assessment',
    duration_minutes: 60,
    passing_score: 60,
    settings: { randomize_questions: false },
    status: 'published',
    snapshot_version: 1,
    published_snapshot: null,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('captures every grading-critical field, not just the prompt', () => {
    const snapshot = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });

    // The answer key and hidden test expectations must survive, or grading
    // against this version would be impossible.
    const mcq = snapshot.questions.find((q) => q.id === 'q1');
    expect(mcq?.payload.correct_option_id).toBe('o2');

    const coding = snapshot.questions.find((q) => q.id === 'q2');
    expect(coding?.payload).toMatchObject({
      language: 'javascript',
      starter_code: 'function debounce() {}',
    });
    expect((coding?.payload.test_cases as Array<Record<string, unknown>>)[0]).toMatchObject({
      expected_output: '2',
      is_hidden: true,
    });
  });

  it('orders questions by position regardless of input order', () => {
    const shuffled = [...QUESTION_V1].reverse();
    const snapshot = buildSnapshot({ assessment: assessment(), questions: shuffled, nextVersion: 1 });
    expect(snapshot.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('records the grading configuration alongside the questions', () => {
    const snapshot = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 3 });
    expect(snapshot.version).toBe(3);
    expect(snapshot.duration_minutes).toBe(60);
    expect(snapshot.passing_score).toBe(60);
    expect(snapshot.total_marks).toBe(10);
    expect(snapshot.settings).toEqual({ randomize_questions: false });
    expect(typeof snapshot.published_at).toBe('string');
  });

  it('produces a structurally valid snapshot', () => {
    const snapshot = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });
    expect(isValidSnapshot(snapshot)).toBe(true);
  });
});

describe('isValidSnapshot', () => {
  const good = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });

  it('accepts a well-formed snapshot', () => {
    expect(isValidSnapshot(good)).toBe(true);
  });

  it('rejects null, undefined and non-objects', () => {
    expect(isValidSnapshot(null)).toBe(false);
    expect(isValidSnapshot(undefined)).toBe(false);
    expect(isValidSnapshot('v1')).toBe(false);
    expect(isValidSnapshot(42)).toBe(false);
  });

  it('rejects version 0 and negative versions', () => {
    expect(isValidSnapshot({ ...good, version: 0 })).toBe(false);
    expect(isValidSnapshot({ ...good, version: -1 })).toBe(false);
  });

  it('rejects an empty question set', () => {
    expect(isValidSnapshot({ ...good, questions: [] })).toBe(false);
  });

  it('rejects a question missing its payload or marks', () => {
    const broken = { ...good, questions: [{ id: 'q1', type: 'mcq', prompt: 'x', marks: 1 }] };
    expect(isValidSnapshot(broken)).toBe(false);
  });
});

describe('resolveQuestionsForAttempt', () => {
  const v1 = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });
  const withSnapshot = assessment({ published_snapshot: v1, snapshot_version: 1 });

  it('grades a pinned attempt against its snapshot, not the live questions', () => {
    // The recruiter has since edited the live questions.
    const edited: RawQuestion[] = [
      { ...QUESTION_V1[0], prompt: 'COMPLETELY DIFFERENT PROMPT', payload: { options: [], correct_option_id: 'o1' } },
      { ...QUESTION_V1[1], marks: 1 },
    ];

    const resolved = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 1 },
      assessment({ published_snapshot: v1, snapshot_version: 2 }),
      edited,
    );

    expect(resolved.source).toBe('snapshot');
    expect(resolved.version).toBe(1);
    expect(resolved.questions[0].prompt).toBe('Which queue does setImmediate use?');
    expect(resolved.questions[0].payload.correct_option_id).toBe('o2');
    expect(resolved.questions[1].marks).toBe(8);
  });

  it('never returns a second candidate live questions for a pinned attempt', () => {
    const resolved = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 1 },
      withSnapshot,
      [],
    );
    expect(resolved.questions).toHaveLength(2);
  });

  it('THROWS rather than silently falling back when a pinned snapshot is missing', () => {
    // Grading a candidate against a question set they never saw is worse than
    // refusing to score.
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: 2 },
        assessment({ published_snapshot: v1, snapshot_version: 2 }),
        QUESTION_V1,
      ),
    ).toThrow(/cannot be loaded|mismatched/i);
  });

  it('THROWS when a pinned snapshot is structurally corrupt', () => {
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: 1 },
        assessment({ published_snapshot: { version: 1, questions: [] } as never }),
        QUESTION_V1,
      ),
    ).toThrow(/cannot be loaded/i);
  });

  it('refuses to grade when the assessment only holds a DIFFERENT version', () => {
    // The mismatch is detected before grading rather than silently accepted.
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: 1 },
        assessment({ published_snapshot: { ...v1, version: 4 }, snapshot_version: 4 }),
        QUESTION_V1,
      ),
    ).toThrow(/cannot be loaded/i);
  });

  it('refuses to grade when the history row carries the wrong version', () => {
    // Defence in depth: a history table that somehow returned a different
    // version must never be used for grading.
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: 1 },
        withSnapshot,
        QUESTION_V1,
        { ...v1, version: 7 },
      ),
    ).toThrow(/mismatched question set/i);
  });

  it('THROWS when a pinned attempt has no recorded version', () => {
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: null },
        withSnapshot,
        QUESTION_V1,
      ),
    ).toThrow(/no version was recorded/i);
  });

  it('falls back to live questions for a pre-migration attempt, and says so', () => {
    const resolved = resolveQuestionsForAttempt(
      { snapshot_source: 'live', snapshot_version: null },
      assessment({ published_snapshot: null, snapshot_version: 0 }),
      QUESTION_V1,
    );
    expect(resolved.source).toBe('live');
    expect(resolved.version).toBeNull();
    expect(resolved.questions).toHaveLength(2);
    expect(resolved.limitation).toMatch(/not recoverable/i);
  });

  it('treats a missing snapshot_source as the legacy path', () => {
    const resolved = resolveQuestionsForAttempt({}, assessment({ published_snapshot: null }), QUESTION_V1);
    expect(resolved.source).toBe('live');
    expect(resolved.limitation).toBeTruthy();
  });
});

describe('the version-1 / version-2 lifecycle', () => {
  it('keeps a v1 attempt on v1 questions after a v2 publish', () => {
    // The key scenario: after republishing, `assessments.published_snapshot`
    // holds v2. The v1 attempt must still be graded from the immutable history.
    const v1 = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });
    const attempt = { snapshot_source: 'snapshot', snapshot_version: 1 };

    // Recruiter edits: deletes q2, rewrites q1, republishes.
    const editedLive: RawQuestion[] = [
      {
        ...QUESTION_V1[0],
        prompt: 'Rewritten prompt for v2',
        payload: { options: [{ id: 'o1', text: 'a' }], correct_option_id: 'o1' },
      },
    ];
    const v2 = buildSnapshot({ assessment: assessment(), questions: editedLive, nextVersion: 2 });
    const afterRepublish = assessment({ published_snapshot: v2, snapshot_version: 2 });

    // The existing v1 attempt, resolved from history.
    const old = resolveQuestionsForAttempt(attempt, afterRepublish, editedLive, v1);
    expect(old.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(old.questions[0].prompt).toBe('Which queue does setImmediate use?');
    expect(old.version).toBe(1);

    // A NEW invitation after the republish gets v2.
    const fresh = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 2 },
      afterRepublish,
      editedLive,
    );
    expect(fresh.questions.map((q) => q.id)).toEqual(['q1']);
    expect(fresh.version).toBe(2);
  });

  it('survives a reorder without changing the graded set', () => {
    const v1 = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });
    const reorderedLive = [...QUESTION_V1].reverse();
    const v2 = buildSnapshot({ assessment: assessment(), questions: reorderedLive, nextVersion: 2 });

    const old = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 1 },
      assessment({ published_snapshot: v2, snapshot_version: 2 }),
      reorderedLive,
      v1,
    );
    expect(old.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    // The snapshot's own ordering is authoritative for the old attempt.
    expect(old.questions[0].position).toBe(0);
  });
});

describe('aggregateSkillBreakdown', () => {
  const questions = [
    { id: 'q1', skill_tag: 'Node.js', marks: 2 },
    { id: 'q2', skill_tag: 'Node.js', marks: 4 },
    { id: 'q3', skill_tag: 'SQL', marks: 4 },
    { id: 'q4', skill_tag: '', marks: 2 },
  ];

  it('derives strengths and gaps only from persisted scores', () => {
    const result = aggregateSkillBreakdown(questions, [
      { question_id: 'q1', score: 2, max_score: 2 },
      { question_id: 'q2', score: 1, max_score: 4 },
      { question_id: 'q3', score: 4, max_score: 4 },
    ]);
    const bySkill = Object.fromEntries(result.map((r) => [r.skill, r]));

    expect(bySkill['Node.js'].percentage).toBeCloseTo(50);
    expect(bySkill['Node.js'].verdict).toBe('neutral');
    expect(bySkill['SQL'].percentage).toBe(100);
    expect(bySkill['SQL'].verdict).toBe('strength');
    expect(bySkill['Untagged'].earned).toBeNull();
  });

  it('flags a genuinely weak skill as a gap', () => {
    const result = aggregateSkillBreakdown(questions, [
      { question_id: 'q1', score: 0, max_score: 2 },
      { question_id: 'q2', score: 0, max_score: 4 },
    ]);
    expect(result.find((r) => r.skill === 'Node.js')?.verdict).toBe('gap');
  });

  it('never counts an unscored subjective question as a zero', () => {
    // Subjective answers persist with score = NULL and are marked manual review.
    // Treating them as zeros would fabricate a "gap" the candidate did not earn.
    const result = aggregateSkillBreakdown(questions, [
      { question_id: 'q1', score: 2, max_score: 2 },
      { question_id: 'q4', score: null, max_score: null },
    ]);
    const untagged = result.find((r) => r.skill === 'Untagged');
    expect(untagged?.scored).toBe(0);
    expect(untagged?.verdict).toBe('needs_review');
    expect(untagged?.percentage).toBeNull();
  });

  it('reports an unanswered question as unscored, not as a wrong answer', () => {
    const result = aggregateSkillBreakdown(questions, [
      { question_id: 'q1', score: 2, max_score: 2 },
    ]);
    const untagged = result.find((r) => r.skill === 'Untagged');
    expect(untagged?.questions).toBe(1);
    expect(untagged?.scored).toBe(0);
  });

  it('sorts strongest first', () => {
    const result = aggregateSkillBreakdown(questions, [
      { question_id: 'q1', score: 0, max_score: 2 },
      { question_id: 'q3', score: 4, max_score: 4 },
    ]);
    expect(result[0].percentage).toBe(100);
  });

  it('returns an empty list for no questions', () => {
    expect(aggregateSkillBreakdown([], [])).toEqual([]);
  });
});

describe('version history is required to grade an old attempt', () => {
  const v1 = buildSnapshot({ assessment: assessment(), questions: QUESTION_V1, nextVersion: 1 });

  it('throws when the assessment holds only a NEWER version and history is missing', () => {
    // Regression guard: `assessments.published_snapshot` only ever holds the
    // latest version, so relying on it alone would make every attempt older
    // than the current publish ungradeable — or silently regraded.
    const v2 = buildSnapshot({ assessment: assessment(), questions: [], nextVersion: 2 });
    expect(() =>
      resolveQuestionsForAttempt(
        { snapshot_source: 'snapshot', snapshot_version: 1 },
        assessment({ published_snapshot: v2, snapshot_version: 2 }),
        QUESTION_V1,
        null,
      ),
    ).toThrow(/cannot be loaded/i);
  });

  it('falls back to the assessment snapshot when it IS the pinned version', () => {
    // No republish yet, so the history lookup may legitimately come back empty
    // on a database provisioned mid-migration; the assessment's own copy of the
    // same version is equally authoritative.
    const resolved = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 1 },
      assessment({ published_snapshot: v1, snapshot_version: 1 }),
      [],
      null,
    );
    expect(resolved.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('prefers history over the assessment copy when they disagree on version', () => {
    const v3 = buildSnapshot({ assessment: assessment(), questions: [], nextVersion: 3 });
    const resolved = resolveQuestionsForAttempt(
      { snapshot_source: 'snapshot', snapshot_version: 1 },
      assessment({ published_snapshot: v3, snapshot_version: 3 }),
      [],
      v1,
    );
    expect(resolved.version).toBe(1);
    expect(resolved.questions).toHaveLength(2);
  });
});
