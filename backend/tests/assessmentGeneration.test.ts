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
    });
  });
});
