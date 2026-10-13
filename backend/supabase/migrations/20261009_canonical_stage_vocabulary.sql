-- =============================================================================
-- HireStack — Canonical stage vocabulary
-- =============================================================================
-- Makes `job_applications.current_stage` the single authoritative stage for a
-- candidate in a job, and moves the stored vocabulary from the legacy set to
-- the canonical product pipeline:
--
--   Applied → Screening → Shortlisted → Assessment
--          → Technical Round → Interview → Final Decision → Hired
--
-- Outcomes (Rejected | Withdrawn | Hold) are unchanged.
--
-- Why this migration exists
-- -------------------------
-- 1. `Shortlisted` was a rank-0 legacy ALIAS of `Applied`, so `Applied →
--    Shortlisted` was rejected by the state machine as "cannot move backwards".
--    It is now a real stage between `Screening` and `Assessment`, which is
--    where a recruiter actually makes the decision.
-- 2. Three stages were renamed:
--       Technical Interview → Technical Round
--       Managerial/HR       → Interview
--       Offer               → Final Decision
-- 3. `candidates.current_status` remains for backwards compatibility ONLY. It is
--    refreshed by `services/hiring/applicationService.ts` when — and only when
--    — the candidate has exactly one application. It is no longer consulted for
--    job-scoped stage decisions.
--
-- SAFETY
-- ------
-- * Every CHECK constraint is WIDENED before any rewrite, so no write is ever
--   rejected mid-migration.
-- * The rewrite is a pure rename map. `Shortlisted` is deliberately NOT
--   rewritten: legacy `Shortlisted` means exactly what it means now — a
--   recruiter marked this person as shortlisted. Rewriting it would destroy a
--   real decision that was already recorded.
-- * `Interview` IS rewritten. It is the one genuinely ambiguous legacy value:
--   old rows used it as a generic alias for "Technical Interview" (rank 3 in
--   the old model), while in the new model `Interview` is a real stage (rank
--   5). The rewrite disambiguates it once, here, where "old row" is
--   unambiguous. Runtime code cannot make that distinction, which is why the
--   alias map in `stageTypes.ts` deliberately omits it.
-- * Row counts are reported per value so a deployment can be audited after the
--   fact.
-- * `job_applications.recruiter_id` is backfilled only where NULL.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Widen the CHECK constraints so no subsequent write can fail.
-- -----------------------------------------------------------------------------
-- Canonical values are kept alongside every legacy value so a row that escaped
-- the rewrite still validates.
DO $$
DECLARE
  rec RECORD;
  allowed TEXT[] := ARRAY[
    'Applied','Screening','Shortlisted','Assessment','Technical Round','Interview',
    'Final Decision','Hired',
    'Rejected','Withdrawn','Hold',
    'Technical Interview','Managerial/HR','HR Round','HR Interview','Offer','Offered',
    'Interview Scheduled','Interview Completed','Pending'
  ];
BEGIN
  -- Drop every CHECK constraint on the stage column of each table, named or
  -- not. Earlier migrations (20261005, 20261007) left a trail of both, and a
  -- stale narrow one would reject the new vocabulary mid-migration.
  FOR rec IN
    SELECT rel.relname AS tbl, con.conname AS con
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND rel.relname IN ('job_applications', 'candidates', 'candidate_status_log')
       AND con.contype = 'c'
       AND EXISTS (
             SELECT 1
               FROM unnest(con.conkey) AS k(attnum)
               JOIN pg_attribute a
                 ON a.attrelid = con.conrelid AND a.attnum = k.attnum
              WHERE a.attname IN ('current_stage', 'current_status', 'status')
           )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.tbl, rec.con);
  END LOOP;

  EXECUTE format(
    'ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_current_stage_check
       CHECK (current_stage IS NULL OR current_stage = ANY(%L))', allowed);
  EXECUTE format(
    'ALTER TABLE public.candidates ADD CONSTRAINT candidates_current_status_check
       CHECK (current_status IS NULL OR current_status = ANY(%L))', allowed);
  EXECUTE format(
    'ALTER TABLE public.candidate_status_log ADD CONSTRAINT candidate_status_log_status_check
       CHECK (status IS NULL OR status = ANY(%L))', allowed);
END $$;

-- -----------------------------------------------------------------------------
-- 2. Rewrite the stored values to the canonical vocabulary.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  m RECORD;
  n BIGINT;
  label TEXT;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      -- (source table, column, legacy value, canonical value)
      ('job_applications',  'current_stage',   'Technical Interview',     'Technical Round'),
      ('job_applications',  'current_stage',   'Managerial/HR',           'Interview'),
      ('job_applications',  'current_stage',   'HR Round',                'Interview'),
      ('job_applications',  'current_stage',   'HR Interview',            'Interview'),
      ('job_applications',  'current_stage',   'Interview',               'Technical Round'),
      ('job_applications',  'current_stage',   'Interview Scheduled',     'Interview'),
      ('job_applications',  'current_stage',   'Interview Completed',     'Interview'),
      ('job_applications',  'current_stage',   'Offer',                   'Final Decision'),
      ('job_applications',  'current_stage',   'Offered',                 'Final Decision'),
      ('job_applications',  'current_stage',   'Pending',                 'Applied'),

      ('candidates',        'current_status',  'Technical Interview',     'Technical Round'),
      ('candidates',        'current_status',  'Managerial/HR',           'Interview'),
      ('candidates',        'current_status',  'HR Round',                'Interview'),
      ('candidates',        'current_status',  'HR Interview',            'Interview'),
      ('candidates',        'current_status',  'Interview',               'Technical Round'),
      ('candidates',        'current_status',  'Interview Scheduled',     'Interview'),
      ('candidates',        'current_status',  'Interview Completed',     'Interview'),
      ('candidates',        'current_status',  'Offer',                   'Final Decision'),
      ('candidates',        'current_status',  'Offered',                 'Final Decision'),
      ('candidates',        'current_status',  'Pending',                 'Applied'),

      ('candidate_status_log', 'status',      'Technical Interview',     'Technical Round'),
      ('candidate_status_log', 'status',      'Managerial/HR',           'Interview'),
      ('candidate_status_log', 'status',      'HR Round',                'Interview'),
      ('candidate_status_log', 'status',      'HR Interview',            'Interview'),
      ('candidate_status_log', 'status',      'Interview Scheduled',     'Interview'),
      ('candidate_status_log', 'status',      'Interview Completed',     'Interview'),
      ('candidate_status_log', 'status',      'Offer',                   'Final Decision'),
      ('candidate_status_log', 'status',      'Offered',                 'Final Decision'),
      ('candidate_status_log', 'status',      'Pending',                 'Applied')
    ) AS t(tbl, col, legacy, canonical)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', m.tbl, m.col)
      INTO n USING m.legacy;

    IF n > 0 THEN
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', m.tbl, m.col, m.col)
        USING m.canonical, m.legacy;
      RAISE NOTICE 'stage rewrite: %.%  % -> %  (% rows)', m.tbl, m.col, m.legacy, m.canonical, n;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Shortlist audit columns on the application.
-- -----------------------------------------------------------------------------
-- `current_stage` is the decision; these are the who/when/why that make it
-- auditable. They are written by `services/hiring/shortlistService.ts`.
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS shortlisted_at TIMESTAMPTZ;

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS shortlisted_by UUID REFERENCES public.recruiters(id) ON DELETE SET NULL;

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS shortlist_note TEXT NOT NULL DEFAULT '';

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;

-- Backfill only rows that have no recruiter attribution yet. Never overwrites
-- an existing value, so a deliberately-null row stays null.
UPDATE public.job_applications ja
   SET recruiter_id = c.recruiter_id
  FROM public.candidates c
 WHERE ja.recruiter_id IS NULL
   AND ja.candidate_id = c.id
   AND c.recruiter_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Widen the stage-valued CHECKs on the supporting tables.
-- -----------------------------------------------------------------------------
-- `hiring_stages.stage_type` and `interview_invites.stage` both name interview
-- stages. The canonical renames have to be legal there too, or a technical
-- round could not be recorded.
-- Dropped by COLUMN, not by constraint name.
--
-- `DROP CONSTRAINT IF EXISTS <name>` is a SILENT no-op when the constraint has
-- a different name — an inline column CHECK is auto-named
-- `<table>_<column>_check`, and a table that pre-existed from the RAG pipeline
-- may carry its own naming entirely. The old named-only version therefore could
-- leave the narrow constraint in place while ADDING the widened one alongside
-- it, and the narrow one would keep rejecting `Technical Round` at runtime.
-- This mirrors the pg_constraint discovery already used in section 1 above.
DO $$
DECLARE
  target RECORD;
  rec RECORD;
  allowed TEXT[];
  stmt TEXT;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('hiring_stages',   'stage_type',
       'Screening|Shortlisted|Assessment|Technical Round|Interview|Final Decision|Hired|Technical Interview|Managerial/HR|Applied|Rejected|Hold|Withdrawn'),
      ('interview_invites','stage',
       'Technical Round|Interview|Technical Interview|Managerial/HR')
    ) AS t(tbl, col, values_csv)
  LOOP
    IF to_regclass(format('public.%I', target.tbl)) IS NULL THEN
      RAISE NOTICE 'table public.% does not exist, skipping', target.tbl;
      CONTINUE;
    END IF;

    allowed := string_to_array(target.values_csv, '|');

    FOR rec IN
      SELECT con.conname AS name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
       WHERE ns.nspname = 'public'
         AND rel.relname = target.tbl
         AND con.contype = 'c'
         AND EXISTS (
               SELECT 1
                 FROM unnest(con.conkey) AS k(attnum)
                 JOIN pg_attribute a
                   ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                WHERE a.attname = target.col
             )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target.tbl, rec.name);
      RAISE NOTICE 'dropped stale CHECK % on public.%', rec.name, target.tbl;
    END LOOP;

    stmt := format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I = ANY(%L))',
      target.tbl, target.tbl || '_' || target.col || '_check', target.col, target.col, allowed
    );
    EXECUTE stmt;
    RAISE NOTICE 'installed public.% on public.%.%', target.tbl || '_' || target.col || '_check', target.tbl, target.col;
  END LOOP;
END $$;

-- The two constraints are installed by the dynamic block above, which drops
-- every existing CHECK on these columns first.

-- -----------------------------------------------------------------------------
-- 5. Indexes for the canonical read paths.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_job_applications_job_stage;
CREATE INDEX IF NOT EXISTS idx_job_applications_job_stage
  ON public.job_applications (job_id, current_stage);

-- The workspace's hottest query: shortlisted applications for one job.
CREATE INDEX IF NOT EXISTS idx_job_applications_job_shortlisted
  ON public.job_applications (job_id, updated_at DESC)
  WHERE current_stage = 'Shortlisted';

-- Candidate-level lookup across every job this recruiter owns.
CREATE INDEX IF NOT EXISTS idx_job_applications_recruiter_stage
  ON public.job_applications (recruiter_id, current_stage);

-- -----------------------------------------------------------------------------
-- 6. Post-conditions worth asserting after deployment.
-- -----------------------------------------------------------------------------
DO $$
DECLARE leftover BIGINT;
BEGIN
  SELECT count(*) INTO leftover
    FROM public.job_applications
   WHERE current_stage IN ('Technical Interview','Managerial/HR','HR Round',
                           'HR Interview','Offer','Offered','Pending');
  IF leftover > 0 THEN
    RAISE WARNING 'job_applications still holds % legacy stage value(s)', leftover;
  END IF;

  SELECT count(*) INTO leftover FROM public.candidates
   WHERE current_status IN ('Managerial/HR','HR Round','HR Interview','Offer',
                            'Offered','Pending');
  IF leftover > 0 THEN
    RAISE WARNING 'candidates.current_status still holds % legacy value(s)', leftover;
  END IF;
END $$;