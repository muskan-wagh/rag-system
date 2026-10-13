-- =============================================================================
-- HireStack — Reconcile every stage/status CHECK constraint the app writes
-- =============================================================================
-- `supabase_setup.sql` is the documented way to provision a database, and it had
-- drifted behind the application. CHECK constraints in that file permitted fewer
-- values than the code actually writes, so a database provisioned from it alone
-- (and never touched by later migrations) failed at runtime with a 23514
-- constraint violation:
--
--   assessment_invites.status   missing 'completed'
--       candidateAssessmentController sets this after persisting an evaluated
--       attempt, so EVERY assessment submission failed. The error was swallowed
--       (no error check on that update), so the attempt scored normally while
--       the invite stayed 'sent' forever and the workspace showed a completed
--       candidate as "Invited".
--
--   candidate_status_log.status missing Assessment, Technical Round,
--                               Final Decision, Hold, Withdrawn
--       applicationService.appendStageTimeline writes the destination stage on
--       every move, so shortlisting past Screening, advancing to the technical
--       round and parking a candidate all failed.
--
--   hiring_stages.stage_type   missing Technical Round, Final Decision,
--                               Shortlisted
--       progressionService.ensureStageRow writes the destination stage, so
--       creating a technical round failed.
--
--   interviews.status          missing joined, in_progress, no_show
--       interviewLiveController writes 'joined' when a candidate connects.
--
-- `interview_invites.stage` and `assessment_attempts.status` are not drift in
-- supabase_setup.sql (neither table is created there), but they share the failure
-- mode: their CHECKs are installed by name-only drops elsewhere, so on a database
-- where the table pre-existed with differently-named constraints, a stale narrow
-- constraint can survive alongside a widened one and reject writes at runtime
-- with no error at migration time.
--
-- `job_applications.current_stage`, `candidates.current_status` and
-- `assessment_questions.type` are included for the same reason, so this migration
-- is a complete safety net rather than a partial cleanup.
--
-- Why a name-only drop is not enough
-- ----------------------------------
-- `DROP CONSTRAINT IF EXISTS <name>` is a SILENT no-op when the constraint has a
-- different name. A column-level CHECK written inline in CREATE TABLE is
-- auto-named `<table>_<column>_check`, which happens to match the hand-written
-- name in most migrations — but not when the table pre-existed with its own
-- naming, and not at all for an unnamed constraint. So the intended widening
-- sometimes did nothing at all, with no error. This migration therefore does NOT
-- rely on constraint names: it discovers every CHECK on each target column via
-- `pg_constraint`, drops them, and installs a correctly named one.
--
-- ORDERING is load-bearing, and getting it wrong is a real 23514:
--   Writing a value while a stale constraint is still attached makes THAT stale
--   constraint reject the value being written:
--       ERROR: 23514: new row for relation "jobs" violates check constraint
--              "jobs_status_check"
--   So each column is processed strictly DROP -> canonicalise -> INSTALL, in that
--   order, within a single loop.
--
-- WHY THIS IS ONE DO BLOCK
-- -------------------------
-- An earlier draft staged the target list in a TEMP table so that the drop, the
-- canonicalisation and the install could not drift apart. That failed on the
-- Supabase SQL editor with `42P01: relation "_reconcile_targets" does not exist`,
-- because the editor does not guarantee that consecutive statements share a
-- session — a TEMP table is not visible to the next statement. All four phases
-- now live inside one `DO` block, which has no cross-statement state at all and is
-- atomic: if any column fails, nothing is left half-migrated.
--
-- The target list appears exactly once and the legacy rename map exactly once.
--
-- SAFETY
-- ------
-- * Every replacement value list is a strict SUPERSET of the value list it
--   replaces, so no valid row can become invalid.
-- * The rename map only rewrites values that are NOT canonical, so a re-run can
--   never move a live row backwards.
-- * Tables that do not exist yet are skipped with a NOTICE rather than failing.
-- * Idempotent: re-running drops the constraint this file installed and
--   reinstalls it.
-- =============================================================================

DO $$
DECLARE
  r        RECORD;   -- one target column
  rec      RECORD;   -- one existing CHECK constraint
  m        RECORD;   -- one legacy -> canonical rename
  allowed  TEXT[];
  bad      TEXT;
  n        BIGINT;
  tbl      TEXT;
  col      TEXT;
  con_name TEXT;
BEGIN
  ---------------------------------------------------------------------------
  -- THE TARGET LIST. One row per column the app writes a status/stage into.
  ---------------------------------------------------------------------------
  FOR r IN
    SELECT * FROM (VALUES
      ('assessment_invites',    'status',       'sent|opened|started|expired|revoked|completed'),
      ('candidate_status_log',  'status',       'Applied|Screening|Shortlisted|Assessment|Technical Round|Interview|Final Decision|Hired|Rejected|Withdrawn|Hold|Technical Interview|Managerial/HR|HR Round|HR Interview|Offer|Offered|Interview Scheduled|Interview Completed|Pending'),
      ('hiring_stages',         'stage_type',   'Screening|Shortlisted|Assessment|Technical Round|Interview|Final Decision|Hired|Technical Interview|Managerial/HR|Applied|Rejected|Hold|Withdrawn'),
      ('interviews',            'status',       'scheduled|joined|in_progress|completed|cancelled|no_show'),
      -- Live write paths not covered by supabase_setup.sql. See the header.
      ('interview_invites',     'stage',        'Technical Round|Interview|Technical Interview|Managerial/HR'),
      ('assessment_attempts',   'status',       'in_progress|submitted|evaluated|expired'),
      ('job_applications',      'current_stage','Applied|Screening|Shortlisted|Assessment|Technical Round|Interview|Final Decision|Hired|Rejected|Withdrawn|Hold|Technical Interview|Managerial/HR|HR Round|HR Interview|Offer|Offered|Interview Scheduled|Interview Completed|Pending'),
      ('candidates',            'current_status','Applied|Screening|Shortlisted|Assessment|Technical Round|Interview|Final Decision|Hired|Rejected|Withdrawn|Hold|Technical Interview|Managerial/HR|HR Round|HR Interview|Offer|Offered|Interview Scheduled|Interview Completed|Pending'),
      ('assessment_questions',  'type',         'mcq|coding|sql|subjective')
    ) AS t(tbl, col, values_csv)
  LOOP
    tbl := r.tbl;
    col := r.col;

    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE NOTICE 'table public.% does not exist, skipping', tbl;
      CONTINUE;
    END IF;

    allowed := string_to_array(r.values_csv, '|');

    -- -----------------------------------------------------------------------
    -- A. Pre-flight: report any row that would not survive the new list.
    --    The lists are supersets, so this should always report nothing. A row
    --    is reported by VALUE so it can be investigated rather than silently
    --    deleted or coerced.
    -- -----------------------------------------------------------------------
    BEGIN
      EXECUTE format(
        'SELECT %I::text FROM public.%I WHERE %I IS NOT NULL AND NOT (%I::text = ANY(%L)) LIMIT 5',
        col, tbl, col, col, allowed
      ) INTO bad;

      IF bad IS NOT NULL THEN
        RAISE WARNING 'pre-existing value outside the target list on %.%: %', tbl, col, bad;
      END IF;
    EXCEPTION
      WHEN undefined_table OR insufficient_privilege THEN
        RAISE NOTICE 'cannot inspect public.%, skipping pre-flight', tbl;
    END;

    -- -----------------------------------------------------------------------
    -- B. Drop EVERY CHECK on this column, discovered BY COLUMN rather than by
    --    name, so an auto-named or unnamed constraint is caught just like a
    --    hand-named one. This MUST happen before C, otherwise a stale narrow
    --    constraint rejects the canonical values being written in C.
    -- -----------------------------------------------------------------------
    FOR rec IN
      SELECT con.conname AS name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
       WHERE ns.nspname = 'public'
         AND rel.relname = tbl
         AND con.contype = 'c'
         AND EXISTS (
               SELECT 1
                 FROM unnest(con.conkey) AS k(attnum)
                 JOIN pg_attribute a
                   ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                WHERE a.attname = col
             )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, rec.name);
      RAISE NOTICE 'dropped stale CHECK % on public.%', rec.name, tbl;
    END LOOP;

    -- -----------------------------------------------------------------------
    -- C. Canonicalise legacy values. `ADD CONSTRAINT` validates every existing
    --    row, so a row still holding a legacy value would fail D with the same
    --    23514 that 20261008 hit. Doing it here makes this migration independent
    --    of whether 20261009 has already run.
    --
    --    Plain `Interview` is deliberately ABSENT from this map: it is a
    --    CANONICAL stage (the HR round), so remapping it to `Technical Round`
    --    would rewrite live, correct data on every re-run. Legacy rows still
    --    carrying `Interview` are left alone — the value is canonical and is
    --    therefore valid where it stands.
    --
    --    Each mapping is a no-op on columns that never held the legacy value.
    -- -----------------------------------------------------------------------
    FOR m IN
      SELECT * FROM (VALUES
        ('Technical Interview', 'Technical Round'),
        ('technical interview', 'Technical Round'),
        ('Managerial/HR',       'Interview'),
        ('managerial/hr',       'Interview'),
        ('HR Round',            'Interview'),
        ('HR Interview',        'Interview'),
        ('Interview Scheduled', 'Interview'),
        ('Interview Completed', 'Interview'),
        ('Offer',               'Final Decision'),
        ('Offered',             'Final Decision'),
        ('offer',               'Final Decision'),
        ('Pending',             'Applied'),
        ('applied',             'Applied'),
        ('screening',           'Screening'),
        ('shortlisted',         'Shortlisted'),
        ('assessment',          'Assessment'),
        ('hired',               'Hired'),
        ('rejected',            'Rejected'),
        ('hold',                'Hold'),
        ('withdrawn',           'Withdrawn')
      ) AS t(legacy, canonical)
    LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text = $1', tbl, col)
        INTO n USING m.legacy;

      IF n > 0 THEN
        EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I::text = $2', tbl, col, col)
          USING m.canonical, m.legacy;
        RAISE NOTICE 'rewrote %.%: % -> % (% rows)', tbl, col, m.legacy, m.canonical, n;
      END IF;
    END LOOP;

    -- -----------------------------------------------------------------------
    -- D. Install the correct CHECK. Runs last, once the column holds only
    --    values this list permits.
    -- -----------------------------------------------------------------------
    con_name := tbl || '_' || col || '_check';

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I IS NULL OR %I = ANY(%L))',
      tbl, con_name, col, col, allowed
    );

    RAISE NOTICE 'installed public.% on public.%', con_name, col;
  END LOOP;
END $$;
