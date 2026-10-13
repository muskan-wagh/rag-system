-- =============================================================================
-- HireStack — Job lifecycle (Open / Closed)
-- =============================================================================
-- Adds an explicit lifecycle to `jobs`. HireStack previously had NO job status
-- column at all: every job was implicitly open forever, nothing gated new
-- applications, invitations or progression, and a recruiter had no way to stop
-- intake for a filled role short of deleting the job.
--
-- ⚠  LIVE-DATABASE TRAP — this migration failed on its first run
-- ────────────────────────────────────────────────────────────
-- `jobs` ALREADY EXISTS on the live database, created outside this repository
-- (like `assessments`, `assessment_invites` and `job_applications`). It already
-- has its OWN `status` column, with a legacy value set.
--
-- That makes `ADD COLUMN IF NOT EXISTS status ...` a SILENT NO-OP: the column
-- keeps its existing type, nullability and values, and a DEFAULT only applies to
-- rows inserted afterwards. Adding the CHECK then failed with:
--
--     ERROR: 23514: check constraint "jobs_status_check" of relation "jobs"
--            is violated by some row
--
-- This version NORMALISES the existing values before adding the constraint, and
-- archives the originals into `jobs.previous_status` so the mapping is
-- reversible and auditable. See section 0.
--
-- Design notes
-- ------------
-- * Every pre-existing job is OPEN after this migration, which is exactly the
--   behaviour it had before the column existed — the change is inert on a live
--   database unless a value clearly meaning "not recruiting" is present.
-- * Closing NEVER deletes anything. Candidates, applications, screening
--   results, assessment snapshots, invites, attempts, interviews and reports
--   all remain in place and remain readable; only *new* recruitment activity
--   is refused. The gate lives in application code
--   (`services/hiring/jobLifecycleService.ts`) so it can return a typed 409
--   with a human-readable reason and honour an authorized override.
-- * `closed_by` / `closed_at` are audit fields, not authorisation. The
--   authorized override for invitations on a closed job is
--   `progression_config.allow_invites_when_closed` (added below), which is
--   explicit and off by default.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ============================================================================
-- 0. Take ownership of a PRE-EXISTING `jobs.status`.
-- ============================================================================
-- `jobs` pre-exists on the live database, created outside this repository, and
-- it already has its OWN `status` column, its own value vocabulary (observed:
-- `draft`) and its own CHECK constraint NAMED `jobs_status_check`.
--
-- Two distinct failures came from that, both fixed here:
--
--   a) `ADD COLUMN IF NOT EXISTS status ...` is a SILENT no-op against an
--      existing column, so legacy values survive and the new CHECK then fails:
--          ERROR: 23514: check constraint "jobs_status_check" ... is violated
--
--   b) ORDERING. Normalising values while the OLD constraint is still attached
--      makes that old constraint reject the NEW values:
--          ERROR: 23514: new row for relation "jobs" violates check constraint
--                 "jobs_status_check"
--      The DROP must happen BEFORE any value is written, not after.
--
-- Sequence is strictly: drop every CHECK on the column -> write values ->
-- install the correct constraint.

-- Archive whatever is there, verbatim, so the mapping is reversible and auditable.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- -- 0a. Drop EVERY CHECK constraint on jobs.status, discovered by column -------
-- Not dropped by name: a column CHECK is auto-named `<table>_<column>_check`
-- only when written inline, and a pre-existing table may name it anything.
DO $$
DECLARE
  rec RECORD;
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT con.conname AS name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND rel.relname = 'jobs'
       AND con.contype = 'c'
       AND EXISTS (
             SELECT 1
               FROM unnest(con.conkey) AS k(attnum)
               JOIN pg_attribute a
                 ON a.attrelid = con.conrelid AND a.attnum = k.attnum
              WHERE a.attname = 'status'
           )
  LOOP
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', rec.name);
    RAISE NOTICE 'dropped pre-existing CHECK on jobs.status: %', rec.name;
  END LOOP;
END $$;

-- -- 0b. Normalise and archive the legacy values (now unconstrained) ---------
DO $$
DECLARE
  v_exists BOOLEAN;
  v_nullable BOOLEAN;
  v_type TEXT;
  v_distinct TEXT;
BEGIN
  IF to_regclass('public.jobs') IS NULL THEN
    RAISE NOTICE 'public.jobs does not exist; nothing to normalise';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'status'
  ) INTO v_exists;

  IF NOT v_exists THEN
    -- Genuinely new column: the ADD COLUMN below creates it fully populated
    -- with the DEFAULT, so there is nothing to normalise.
    RETURN;
  END IF;

  SELECT is_nullable = 'YES', data_type
    INTO v_nullable, v_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'status';

  IF v_type <> 'text' THEN
    -- The CASE below compares against text literals; anything else would raise a
    -- type error here instead of failing later with something cryptic.
    RAISE EXCEPTION
      'jobs.status exists with type "%" but this migration expects TEXT. Map the legacy values manually before re-running.',
      v_type;
  END IF;

  SELECT string_agg(format('%s=%s', COALESCE(quote_literal(status), '(null)'), n), ', ' ORDER BY COALESCE(status, ''))
    INTO v_distinct
    FROM (SELECT status, COUNT(*) AS n FROM public.jobs GROUP BY status) t;

  RAISE NOTICE 'jobs.status already existed (type=%, nullable=%). Current distribution: %',
    v_type, v_nullable, v_distinct;

  -- A NULL legacy value is archived as the literal '(null)' sentinel: writing
  -- `previous_status = status` would store NULL, which is indistinguishable
  -- from "never archived" and would silently drop those rows from the audit.
  UPDATE public.jobs
     SET previous_status = COALESCE(status, '(null)')
   WHERE (status IS NULL
          OR (status IS DISTINCT FROM 'open' AND status IS DISTINCT FROM 'closed'))
     AND previous_status IS NULL;

  -- Conservative mapping.
  --   * Values that unambiguously mean "not recruiting" become 'closed'.
  --     Getting this wrong the other way would let a filled or archived role keep
  --     accepting real candidates and send real invitations.
  --   * EVERYTHING else - including NULL, `draft`, and any unrecognised legacy
  --     value - becomes 'open', which is exactly this migration's stated promise:
  --     it changes no behaviour on a live database, where every job was
  --     implicitly open before this column existed.
  UPDATE public.jobs
     SET status = CASE
                     WHEN LOWER(BTRIM(status)) IN (
                       'closed','archive','archived','inactive','disabled',
                       'deleted','expired','filled','filled_up','on_hold'
                     ) THEN 'closed'
                     ELSE 'open'
                   END
   WHERE status IS NULL
      OR status NOT IN ('open', 'closed');

  SELECT string_agg(format('%s=%s', COALESCE(quote_literal(status), '(null)'), n), ', ' ORDER BY COALESCE(status, ''))
    INTO v_distinct
    FROM (SELECT status, COUNT(*) AS n FROM public.jobs GROUP BY status) t;

  RAISE NOTICE 'jobs.status normalised. New distribution: %', v_distinct;

  IF v_nullable THEN
    -- Only now is it safe: there are no NULLs left to reject.
    EXECUTE 'ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT ''open''';
    EXECUTE 'ALTER TABLE public.jobs ALTER COLUMN status SET NOT NULL';
    RAISE NOTICE 'jobs.status is now NOT NULL DEFAULT ''open''';
  END IF;
END $$;

-- Now genuinely additive: a no-op when the column already exists.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.recruiters(id) ON DELETE SET NULL;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

-- The CHECK is installed in section 2 below, AFTER the legacy values have been
-- normalised. Installing it earlier is what made the first two runs fail.

-- -- 1. Install the constraint (values are already normalised) ----------------
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_status_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check CHECK (status IN ('open', 'closed'));

-- Authorized override: a recruiter may still invite candidates to an already
-- published assessment for a closed job when this is explicitly enabled.
-- Fail-closed — absent means false. Guarded because `progression_config` is
-- added by 20261004_job_workflow_slice.sql; a database provisioned before that
-- migration must still be able to run this file.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'progression_config'
  ) THEN
    EXECUTE $sql$
      UPDATE public.jobs
         SET progression_config = COALESCE(progression_config, '{}'::jsonb)
                               || '{"allow_invites_when_closed": false}'::jsonb
       WHERE NOT (COALESCE(progression_config, '{}'::jsonb) ? 'allow_invites_when_closed')
    $sql$;
  ELSE
    RAISE NOTICE 'jobs.progression_config absent; skipping allow_invites_when_closed default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_status
  ON public.jobs (recruiter_id, status, created_at DESC);

-- ============================================================================
-- Verification. Re-run this block by hand if you want the numbers:
--
--   SELECT status, COUNT(*) FROM jobs GROUP BY status;
--   SELECT previous_status, COUNT(*) FROM jobs
--    WHERE previous_status IS NOT NULL GROUP BY previous_status;
--   -- '(null)' in that output means the legacy value was NULL.
--
-- If the second query shows a legacy value mapped to 'closed' that should
-- actually be 'open', correct it directly — `previous_status` still holds the
-- original:
--
--   UPDATE jobs SET status = 'open' WHERE previous_status = 'draft';
-- ============================================================================
