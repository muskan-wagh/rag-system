import { describe, it, expect } from 'vitest';
import {
  generateAssessmentQuestions,
  normalizeGeneratedQuestion,
  buildGenerationPrompt,
  totalRequestedCount,
} from '@/services/assessments/generationService';
import { autoProgressionFlagFor } from '@/services/hiring/progressionService';
import { mergeProgressionConfig } from '@/controllers/jobWorkflowController';

const mcqLlm = async () => ({
  content: JSON.stringify({
    questions: [
      {
        type: 'mcq',
        prompt: 'Which hook manages side effects in React?',
        skill: 'React',
        difficulty: 'medium',
        marks: 2,
        options: ['useState', 'useEffect', 'useRef', 'useMemo'],
        correctOption: 1,
      },
    ],
  }),
  model: 'test-model',
});

const baseRequest = {
  jobTitle: 'Frontend Engineer',
  jobDescription: 'Build React apps.',
  requiredSkills: ['React'],
  preferredSkills: [] as string[],
  experienceLevel: 'Mid',
  educationRequirements: '',
  questionTypes: { mcq: 1 },
  difficulty: 'mixed' as const,
};

describe('assessment generation service', () => {
  it('normalizes an AI MCQ into builder payload shape', async () => {
    const result = await generateAssessmentQuestions(baseRequest, mcqLlm);
    expect(result.questions).toHaveLength(1);
    const q = result.questions[0];
    expect(q.type).toBe('mcq');
    const payload = q.payload as { options: Array<{ id: string; text: string }>; correct_option_id: string };
    expect(payload.options).toHaveLength(4);
    expect(payload.correct_option_id).toBe(payload.options[1].id);
    expect(payload.options[1].text).toBe('useEffect');
    expect(result.model).toBe('test-model');
  });

  it('drops AI questions that fail the builder gate and errors when none survive', async () => {
    const badLlm = async () => ({
      content: JSON.stringify({
        questions: [{ type: 'mcq', prompt: 'Bad?', options: ['only-one'], correctOption: 0 }],
      }),
      model: 'test-model',
    });
    await expect(generateAssessmentQuestions(baseRequest, badLlm)).rejects.toThrow();
  });

  /**
   * Regression: real Qwen output mirrors the prompt's schema template, which
   * lists every field for every question type. On a coding/SQL/subjective
   * question it therefore emits `"correctOption": null` instead of omitting
   * the key. `z.number().optional()` rejects `null`, so one stray null failed
   * the ENTIRE batch with:
   *
   *   AI returned an unexpected question format. Please try again.
   *
   * Every other question in that response was perfectly usable.
   */
  it('treats null optional fields as "not applicable" instead of failing the batch', async () => {
    const nullHeavyLlm = async () => ({
      content: JSON.stringify({
        questions: [
          {
            type: 'mcq',
            prompt: 'Which Redis type supports rank queries?',
            title: 'Redis leaderboard',
            skill: 'Redis',
            difficulty: 'medium',
            marks: 2,
            options: ['Hash', 'Sorted Set', 'List', 'Set'],
            correctOption: 1,
          },
          {
            type: 'coding',
            prompt: 'Implement paginate() with a Redis cache.',
            title: 'Paginate with Redis',
            skill: 'Redis',
            difficulty: 'medium',
            marks: null,
            language: 'javascript',
            starter_code: 'function paginate() {}',
            test_cases: [{ input: '[1,2,3],1,2', expected_output: '[1,2]' }],
            options: null,
            correctOption: null,
            rubric: null,
          },
          {
            type: 'sql',
            prompt: 'Find the top 3 customers by revenue.',
            schema_ddl: 'CREATE TABLE orders (id int, total numeric);',
            expected_query: 'SELECT id FROM orders ORDER BY total DESC LIMIT 3;',
            correctOption: null,
            expected_result: null,
          },
        ],
      }),
      model: 'test-model',
    });

    const result = await generateAssessmentQuestions(
      { ...baseRequest, questionTypes: { mcq: 1, coding: 1, sql: 1 } },
      nullHeavyLlm,
    );

    expect(result.questions).toHaveLength(3);
    expect(result.questions.map((q) => q.type)).toEqual(['mcq', 'coding', 'sql']);
    const coding = result.questions.find((q) => q.type === 'coding');
    expect((coding!.payload as { test_cases: unknown[] }).test_cases).toHaveLength(1);
  });

  it('keeps the usable questions when only some are malformed', async () => {
    const partiallyBadLlm = async () => ({
      content: JSON.stringify({
        questions: [
          { type: 'mcq', prompt: 'Valid?', options: ['a', 'b'], correctOption: 0 },
          { type: 'not-a-type', prompt: 'Invalid type' },
          { type: 'mcq', prompt: '' },
        ],
      }),
      model: 'test-model',
    });

    const result = await generateAssessmentQuestions(
      { ...baseRequest, questionTypes: { mcq: 3 } },
      partiallyBadLlm,
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].prompt).toBe('Valid?');
  });

  it('still fails when every question is unusable', async () => {
    const allBadLlm = async () => ({
      content: JSON.stringify({
        questions: [
          { type: 'nope', prompt: 'x' },
          { type: 'mcq', prompt: '' },
        ],
      }),
      model: 'test-model',
    });

    await expect(
      generateAssessmentQuestions({ ...baseRequest, questionTypes: { mcq: 2 } }, allBadLlm),
    ).rejects.toThrow(/unexpected question format/i);
  });

  it('rejects unparseable AI output', async () => {
    const garbage = async () => ({ content: 'not json at all {{{', model: 'test-model' });
    await expect(generateAssessmentQuestions(baseRequest, garbage)).rejects.toThrow();
  });

  it('rejects empty and oversized requests without calling the LLM', async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return { content: '{}', model: 'x' };
    };
    await expect(
      generateAssessmentQuestions({ ...baseRequest, questionTypes: {} }, spy),
    ).rejects.toThrow();
    await expect(
      generateAssessmentQuestions({ ...baseRequest, questionTypes: { mcq: 51 } }, spy),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  it('normalizeGeneratedQuestion defaults coding language and keeps test cases', () => {
    const q = normalizeGeneratedQuestion(
      {
        type: 'coding',
        prompt: 'Reverse a string.',
        title: '',
        skill: 'JavaScript',
        difficulty: 'easy',
        language: '',
        starter_code: 'function rev(s) {}',
        test_cases: [{ input: 'ab', expected_output: 'ba' }],
        options: [],
      } as never,
      3,
    );
    expect(q.marks).toBe(3);
    const payload = q.payload as { language: string; test_cases: Array<{ expected_output: string }> };
    expect(payload.language).toBe('javascript');
    expect(payload.test_cases[0].expected_output).toBe('ba');
  });

  it('prompt embeds role skills and counts', () => {
    const { user } = buildGenerationPrompt({
      ...baseRequest,
      questionTypes: { mcq: 8, coding: 2 },
    });
    expect(user).toContain('Frontend Engineer');
    expect(user).toContain('React');
    expect(user).toContain('- mcq: 8');
    expect(totalRequestedCount({ questionTypes: { mcq: 8, coding: 2 } } as never)).toBe(10);
  });
});

describe('progression config gating', () => {
  it('maps stages to config flags', () => {
    expect(autoProgressionFlagFor('Assessment')).toBe('assessment_to_technical');
    expect(autoProgressionFlagFor('Technical Interview')).toBe('technical_to_hr');
    expect(autoProgressionFlagFor('Managerial/HR')).toBe('hr_to_offer');
    expect(autoProgressionFlagFor('Screening')).toBe('screening_to_assessment');
    // Applied is governed by the screening toggle: a screening pass is what
    // moves a candidate out of Applied into Screening.
    expect(autoProgressionFlagFor('Applied')).toBe('screening_to_assessment');
  });

  it('mergeProgressionConfig keeps defaults and ignores unknown keys', () => {
    expect(mergeProgressionConfig({})).toEqual({
      screening_to_assessment: false,
      assessment_to_technical: false,
      technical_to_hr: false,
      hr_to_offer: false,
      assessment_auto_invite: false,
      interview_auto_invite: false,
      // 20261008: explicit, fail-closed override for inviting on a closed job.
      allow_invites_when_closed: false,
    });
    expect(
      mergeProgressionConfig({ assessment_to_technical: true, evil: true } as never),
    ).toEqual({
      screening_to_assessment: false,
      assessment_to_technical: true,
      technical_to_hr: false,
      hr_to_offer: false,
      assessment_auto_invite: false,
      interview_auto_invite: false,
      // 20261008: explicit, fail-closed override for inviting on a closed job.
      allow_invites_when_closed: false,
    });
  });
});
