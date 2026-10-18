-- =============================================================================
-- HireStack — Repair `jobs.status` column DEFAULT
-- =============================================================================
-- WHY
-- ---
-- `POST /api/jobs` failed on the live database with:
--
--   ERROR: 23514: new row for relation "jobs" violates check constraint
--          "jobs_status_check"
--
-- The constraint itself is CORRECT — `jobs_status_check` permits exactly
-- ('open','closed'). The broken part is the COLUMN DEFAULT, which is still the
-- legacy value this database carried before this repository owned the schema
-- (observed: 'draft').
--
-- Every `INSERT INTO jobs` that did not name `status` therefore wrote 'draft'
-- and was rejected. Job creation was dead: the Jobs tab, assessment creation
-- with `new_job`, and draft job relinking all returned HTTP 500.
--
--   INSERT status='open'   -> accepted
--   INSERT (no status)     -> 23514
--
-- WHY 20261008 DID NOT FIX IT
-- --------------------------
-- `20261008_job_lifecycle.sql` resets the default inside a DO block guarded by
-- its own `v_nullable` branch, and then runs
--
--   ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
--
-- which is a SILENT NO-OP on a database where the column already existed — so
-- the legacy default survived. `DROP CONSTRAINT IF EXISTS jobs_status_check` +
-- `ADD CONSTRAINT … CHECK (status IN ('open','closed'))` did run, which is why
-- the constraint is right and the default is wrong.
--
-- WHAT THIS DOES
-- --------------
-- 1. Repairs any row still holding a legacy value, archiving the original in
--    `previous_status` (already present) instead of deleting anything.
-- 2. Resets the column DEFAULT to 'open'.
-- 3. Re-installs the canonical CHECK, dropping every CHECK on the column
--    discovered through `pg_constraint` — a name-only drop is a silent no-op
--    when the constraint was named differently.
--
-- ORDERING IS LOAD-BEARING: drop -> repair values -> install. Writing values
-- while a stale constraint is still attached is exactly the 23514 this file
-- exists to remove.
--
-- IDEMPOTENT: safe to run on a fresh database and on a repaired one. Re-running
-- changes nothing. It only ever widens the accepted vocabulary to the values
-- the application actually writes.
-- =============================================================================

DO $$
DECLARE
  n TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'jobs.status absent; nothing to repair';
    RETURN;
  END IF;

  -- -- 1. Drop EVERY CHECK on jobs.status, discovered BY COLUMN ---------------
  -- `conkey` lists the attnums a CHECK references (unlike `consecond`, which
  -- only exists for foreign keys). The `pg_get_constraintdef` match is a
  -- fallback for a constraint whose conkey is NULL.
  FOR n IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = t.relnamespace
     WHERE ns.nspname = 'public'
       AND t.relname = 'jobs'
       AND c.contype = 'c'
       AND (
         EXISTS (
           SELECT 1
             FROM unnest(c.conkey) AS k(attnum)
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            WHERE a.attname = 'status'
         )
         OR (c.conkey IS NULL
             AND pg_get_constraintdef(c.oid) ~* '(^|[^a-z_])"?status"?([^a-z_]|$)')
       )
  LOOP
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS %I', n);
    RAISE NOTICE 'dropped stale CHECK % on jobs.status', n;
  END LOOP;

  -- -- 2. Archive and repair legacy values -----------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'previous_status'
  ) THEN
    UPDATE public.jobs
       SET previous_status = status
     WHERE status IS NOT NULL
       AND status <> 'open'
       AND status <> 'closed';
  ELSE
    ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS previous_status TEXT;
    UPDATE public.jobs
       SET previous_status = status
     WHERE status IS NOT NULL
       AND status <> 'open'
       AND status <> 'closed';
  END IF;

  -- Every legacy value becomes an open job: a role that existed is still a
  -- role a recruiter is hiring for. Nothing is deleted.
  UPDATE public.jobs
     SET status = 'open'
   WHERE status IS NULL
      OR status NOT IN ('open', 'closed');

  -- -- 3. Reset the DEFAULT and re-assert NOT NULL ---------------------------
  ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT 'open';
  ALTER TABLE public.jobs ALTER COLUMN status SET NOT NULL;

  -- -- 4. Install the canonical CHECK ----------------------------------------
  -- Belt and braces: if the discovery loop above somehow missed a constraint
  -- that happens to carry this name, ADD CONSTRAINT would fail on the
  -- collision. Dropping by name first makes this re-runnable.
  ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

  ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_status_check CHECK (status IN ('open', 'closed'));

  RAISE NOTICE 'jobs.status repaired: DEFAULT ''open'', CHECK (open|closed) reinstalled';
END $$;

-- -----------------------------------------------------------------------------
-- Verification — the query that proves the fix (expects `open`):
--
--   SELECT column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='jobs' AND column_name='status';
--
--   INSERT INTO jobs (recruiter_id, title) VALUES (<recruiter>, 'probe')
--   RETURNING status;   -- must be 'open', not a 23514
-- -----------------------------------------------------------------------------