import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { enqueueScreeningJob } from '@/services/queue/screeningQueue';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { computeSkillScore } from '@/services/ranking/skillMatcher';
import { computeExperienceScore } from '@/services/ranking/experienceMatcher';
import { computeEducationScore } from '@/services/ranking/educationMatcher';
import { generateExplanations } from '@/services/llm/explainability';

/**
 * Job-scoped RAG screening with persistence (agreed + correction #12).
 * Reuses parseJD/embedding/Qdrant/ranking/explainability — no new
 * screening service. Bulk runs go through BullMQ (no HTTP blocking).
 * Recruiter override preserves the original AI result (ai_overall/
 * ai_status immutable; overall/status = effective values).
 */

async function computeScreening(jobId: string, candidateId: string, jdText: string) {
  const supabase = getSupabaseClient();
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, full_name, total_experience_years, parsed_json, raw_resume_text')
    .eq('id', candidateId)
    .maybeSingle();
  if (!candidate) throw new Error('Candidate not found');
  const c = candidate as {
    full_name: string;
    total_experience_years: number;
    parsed_json: { skills?: string[]; education?: string } | null;
    raw_resume_text: string;
  };

  const jd = await parseJD(jdText);
  const embedding = await generateEmbedding(jdText);
  const hits = await searchByEmbedding(embedding, 100).catch(() => []);
  const hit = (hits as Array<{ id?: string; score?: number; candidate?: { id?: string }; scoreValue?: number } | { candidate: { id: string }; score: number }>).find((h) => {
    const hid = (h as { id?: string }).id ?? (h as { candidate?: { id?: string } }).candidate?.id ?? '';
    return String(hid) === candidateId;
  });
  const rawScore = (hit as { score?: number } | undefined)?.score ?? 0.5;
  const semantic = Math.max(0, Math.min(1, Number(rawScore) || 0.5)) * 100;

  const candidateSkills = c.parsed_json?.skills || [];
  const rankCandidate = {
    id: candidateId,
    name: c.full_name || 'Candidate',
    skills: candidateSkills,
    experience: c.total_experience_years || 0,
    education: { level: c.parsed_json?.education || '', field: '' },
    summary: (c.raw_resume_text || '').slice(0, 500),
  };
  const skills = computeSkillScore(rankCandidate, jd) * 100;
  const experience = computeExperienceScore(rankCandidate, jd) * 100;
  const education = computeEducationScore(rankCandidate, jd) * 100;
  const overall = Math.round((semantic * 0.35 + skills * 0.3 + experience * 0.2 + education * 0.15) * 100) / 100;

  const jdSkills = new Set((jd.skills || []).map((s: string) => s.toLowerCase()));
  const matched = candidateSkills.filter((s) => jdSkills.has(s.toLowerCase()));
  const missing = (jd.skills || []).filter(
    (s: string) => !candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()),
  );

  let explanation = '';
  try {
    const explanations = await generateExplanations(jdText, [
      {
        id: candidateId,
        name: c.full_name || 'Candidate',
        skills: candidateSkills,
        experience: c.total_experience_years || 0,
        summary: (c.raw_resume_text || '').slice(0, 500),
      },
    ]);
    const first = explanations[candidateId];
    explanation = first
      ? `Strengths: ${first.strengths.join('; ')}. Recommendation: ${first.recommendation}. Tip: ${first.interview_tip}`
      : '';
  } catch {
    explanation = `Semantic ${Math.round(semantic)}%, skills ${Math.round(skills)}%, experience ${Math.round(experience)}%, education ${Math.round(education)}%.`;
  }
  if (!explanation) {
    explanation = `Semantic ${Math.round(semantic)}%, skills ${Math.round(skills)}%, experience ${Math.round(experience)}%, education ${Math.round(education)}%.`;
  }

  return { semantic, skills, experience, education, overall, matched, missing, explanation };
}

export async function runScreeningForCandidate(jobId: string, candidateId: string, jdText: string, passThreshold = 60) {
  const supabase = getSupabaseClient();
  const r = await computeScreening(jobId, candidateId, jdText);
  const aiStatus = r.overall >= passThreshold ? 'passed' : 'failed';
  const { error } = await supabase.from('screening_results').upsert(
    {
      job_id: jobId,
      candidate_id: candidateId,
      semantic_score: r.semantic,
      skills_score: r.skills,
      experience_score: r.experience,
      education_score: r.education,
      ai_overall: r.overall,
      ai_status: aiStatus,
      overall: r.overall,
      status: aiStatus,
      matched_skills: r.matched,
      missing_skills: r.missing,
      explanation: r.explanation,
      recruiter_override: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'job_id,candidate_id' },
  );
  if (error) throw new Error(`Failed to persist screening: ${error.message}`);
  return { candidateId, ...r, aiStatus };
}

// POST /jobs/:jobId/screening/run — enqueue bulk (non-blocking).
export const runScreeningHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const jobId = String((req.params as Record<string, unknown>).jobId || "");
  const { candidateIds, jdText } = req.body || {};

  const supabase = getSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('id, title, description, recruiter_id').eq('id', jobId).maybeSingle();
  if (!job || (job as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  const jd = String(jdText || (job as { description?: string }).description || (job as { title?: string }).title || '');
  if (!jd.trim()) throw new AppError('jdText or job description is required', 400, ErrorCodes.VALIDATION_ERROR);

  const { jobId: queuedId } = await enqueueScreeningJob({
    jobId,
    recruiterId: recruiter.id,
    candidateIds: Array.isArray(candidateIds) ? candidateIds : undefined,
    jdText: jd,
  });

  // Ensure Screening stage row exists (progression source of truth).
  await supabase.from('hiring_stages').upsert(
    { job_id: jobId, recruiter_id: recruiter.id, stage_type: 'Screening', position: 1, config: {} },
    { onConflict: 'job_id,stage_type' },
  );

  res.status(202).json({ success: true, data: { queued: true, bullmqJobId: queuedId } });
});

// GET /jobs/:jobId/screening/results
export const listScreeningResultsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const jobId = String((req.params as Record<string, unknown>).jobId || "");
  const supabase = getSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('id, recruiter_id').eq('id', jobId).maybeSingle();
  if (!job || (job as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  const { data } = await supabase
    .from('screening_results')
    .select('*, candidates(id, full_name, email)')
    .eq('job_id', jobId)
    .order('overall', { ascending: false });
  res.json({ success: true, data: data || [] });
});

// GET /jobs/:jobId/screening/results/:candidateId
export const getScreeningResultHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const jobId = String((req.params as Record<string, unknown>).jobId || ""); const candidateId = String((req.params as Record<string, unknown>).candidateId || "");
  const supabase = getSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('id, recruiter_id').eq('id', jobId).maybeSingle();
  if (!job || (job as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  const { data } = await supabase
    .from('screening_results')
    .select('*')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (!data) throw new AppError('Screening result not found', 404, ErrorCodes.NOT_FOUND);
  res.json({ success: true, data });
});

// POST /jobs/:jobId/screening/:candidateId/advance|reject — override preserving AI result.
async function overrideScreening(req: Request, res: Response, advance: boolean) {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const jobId = String((req.params as Record<string, unknown>).jobId || ""); const candidateId = String((req.params as Record<string, unknown>).candidateId || "");
  const { reason } = req.body || {};
  const supabase = getSupabaseClient();
  const { data: job } = await supabase.from('jobs').select('id, recruiter_id').eq('id', jobId).maybeSingle();
  if (!job || (job as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  const { data: current } = await supabase
    .from('screening_results')
    .select('*')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (!current) throw new AppError('Screening result not found', 404, ErrorCodes.NOT_FOUND);

  const { error } = await supabase
    .from('screening_results')
    .update({
      status: 'overridden',
      overall: (current as { ai_overall: number }).ai_overall,
      recruiter_override: true,
      override_reason: String(reason || (advance ? 'Recruiter advanced candidate' : 'Recruiter rejected candidate')),
      override_by: recruiter.id,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId);
  if (error) throw new AppError(`Override failed: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);

  // Timeline audit (AI result preserved in details).
  await supabase.from('candidate_status_log').insert({
    candidate_id: candidateId,
    status: advance ? 'Screening' : 'Rejected',
    details: {
      action: advance ? 'screening_override_advance' : 'screening_override_reject',
      ai_overall: (current as { ai_overall: number }).ai_overall,
      ai_status: (current as { ai_status: string }).ai_status,
      reason: String(reason || ''),
      by: recruiter.id,
    },
  });
  if (advance) {
    await supabase.from('candidates').update({ current_status: 'Screening' }).eq('id', candidateId);
  } else {
    await supabase.from('candidates').update({ current_status: 'Rejected' }).eq('id', candidateId);
  }
  res.json({ success: true, data: { overridden: true, advanced: advance } });
}

export const advanceScreeningHandler = asyncHandler(async (req: Request, res: Response) => {
  await overrideScreening(req, res, true);
});

export const rejectScreeningHandler = asyncHandler(async (req: Request, res: Response) => {
  await overrideScreening(req, res, false);
});
