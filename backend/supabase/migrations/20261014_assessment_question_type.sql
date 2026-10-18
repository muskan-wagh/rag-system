-- =============================================================================
-- HireStack — Reconcile the legacy `assessment_questions.question_type` column
-- =============================================================================
-- WHY
-- ---
-- `assessment_questions` pre-exists this repository. It carries a legacy
-- column `question_type TEXT NOT NULL`, and migration 20261001 added the
-- canonical `type TEXT` alongside it, backfilling `type` from `question_type`.
--
-- Since then the ENTIRE application writes only `type`. Nothing writes
-- `question_type`. It is still NOT NULL, so every insert fails:
--
--   null value in column "question_type" of relation "assessment_questions"
--   violates not-null constraint
--
-- This breaks the highest-priority feature in the product:
--   • POST /api/assessments/generate      (AI questions never reach the DB)
--   • POST /api/assessments/:id/questions (manual question creation)
-- Both surfaced as HTTP 500 even though the AI had already generated valid,
-- job-relevant questions — the data was produced and then thrown away.
--
-- WHY THE CODE IS NOT "FIXED" INSTEAD
-- -----------------------------------
-- Writing both columns from the application would entrench the duplicate
-- forever and leave two sources of truth. The single canonical column is
-- `type`; this migration makes the legacy one derive from it and stops
-- rejecting valid writes.
--
-- WHAT THIS DOES
-- --------------
-- 1. Backfills `question_type` from `type` on any row written since 20261001
--    that the backfill could not reach at the time.
-- 2. Drops the NOT NULL so a `type`-only insert is legal again.
-- 3. Installs a trigger that keeps `question_type` mirroring `type`, so a
--    legacy reader (an old dashboard query, a report built before 20261001)
--    keeps seeing a value instead of NULL.
--
-- The trigger only ever copies `type` -> `question_type`. It never derives the
-- canonical column from the legacy one, so `type` remains the single source of
-- truth.
--
-- IDEMPOTENT: safe on a fresh database and on a repaired one. Re-running is a
-- no-op apart from re-syncing drifted rows.
-- =============================================================================

-- -- 1. Backfill --------------------------------------------------------------
UPDATE public.assessment_questions
   SET question_type = type
 WHERE question_type IS NULL
   AND type IS NOT NULL;

-- -- 2. Stop rejecting type-only writes --------------------------------------
ALTER TABLE public.assessment_questions
  ALTER COLUMN question_type DROP NOT NULL;

-- -- 3. Keep the legacy column mirroring the canonical one -------------------
CREATE OR REPLACE FUNCTION public.sync_assessment_question_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.type IS NOT NULL AND (NEW.question_type IS NULL OR NEW.question_type IS DISTINCT FROM NEW.type) THEN
    NEW.question_type := NEW.type;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_assessment_questions_sync_type ON public.assessment_questions;

CREATE TRIGGER trg_assessment_questions_sync_type
  BEFORE INSERT OR UPDATE OF type, question_type
  ON public.assessment_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_assessment_question_type();

-- -----------------------------------------------------------------------------
-- Verification:
--
--   -- legacy column is populated and tracks the canonical one
--   SELECT count(*) FILTER (WHERE question_type IS DISTINCT FROM type) AS drifted
--     FROM public.assessment_questions;
--   -- must be 0
--
--   -- an insert that names only `type` must now succeed
--   INSERT INTO public.assessment_questions (assessment_id, type, position, title, prompt, payload, marks)
--   VALUES (<assessment>, 'mcq', 999, 'probe', 'probe', '{}'::jsonb, 1)
--   RETURNING question_type;   -- expect 'mcq'
-- -----------------------------------------------------------------------------