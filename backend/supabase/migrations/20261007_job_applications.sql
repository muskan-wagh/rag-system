-- ============================================================
-- HireStack: explicit candidate↔job relationship (2026-10-07)
--
-- `job_applications` ALREADY EXISTS in the live database, created outside
-- this repository. Verified live schema (information_schema):
--
--     id                uuid        NOT NULL  gen_random_uuid()
--     job_id            uuid        NULL      (no FK)
--     candidate_id      uuid        NULL      (no FK)
--     current_stage     text        NOT NULL  'applied'   <-- LOWERCASE
--     current_round_id  uuid        NULL
--     rag_score         double      NULL
--     created_at        timestamptz NULL      now()
--     updated_at        timestamptz NULL      now()
--
-- Three corrections this migration makes, each after a real failure:
--
-- 1. The stage column is `current_stage`, NOT `stage`. An earlier attempt
--    added a `stage` column and failed with "column stage does not exist".
--    Adding it as a SECOND stage column would have created two competing
--    sources of truth, so this migration reuses `current_stage` and never
--    introduces `stage`.
--
-- 2. `current_stage` used a lowercase vocabulary ('applied') while the whole
--    application uses the canonical Title-Case lifecycle
--    (services/hiring/stageTypes.ts). Values are normalized to match.
--
-- 3. The live table carries its OWN check constraint on `current_stage`,
--    under an unknown name, enumerating the legacy lowercase vocabulary.
--    Dropping only our own constraint name left that one in place, so
--    writing the canonical 'Applied' failed with:
--        ERROR: 23514: new row ... violates check constraint
--                   "job_applications_current_stage_check"
--    (the legacy constraint was the one actually rejecting it). This
--    migration therefore drops EVERY check constraint on the column,
--    normalizes, then adds exactly one canonical guard.
--
-- Additive and idempotent — safe to re-run. Nothing is dropped or renamed
-- apart from superseded check constraints on `current_stage`.
--
-- ORDERING MATTERS. The legacy constraint must be dropped BEFORE any
-- statement writes `current_stage`, or those statements fail with 23514.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create only when genuinely absent (fresh installs only).
--    No-op against the existing table.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL DEFAULT 'Applied',
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'recruiter_upload',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. Add only the columns that are genuinely missing.
--    `current_stage` is intentionally NOT re-created.
-- ------------------------------------------------------------
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'recruiter_upload';
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Preserve original creation time as the application timestamp.
UPDATE job_applications SET applied_at = created_at
WHERE applied_at = NOW() AND created_at < NOW() - INTERVAL '1 second';

-- ------------------------------------------------------------
-- 3. Drop EVERY check constraint on `current_stage`.
--
--    Must run before any statement writes current_stage. Discovers the
--    legacy constraint by inspecting pg_constraint rather than guessing
--    its name, then drops it.
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'job_applications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%current_stage%'
  LOOP
    EXECUTE format('ALTER TABLE job_applications DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped legacy current_stage constraint: %', r.conname;
    n := n + 1;
  END LOOP;
  IF n = 0 THEN
    RAISE NOTICE 'No pre-existing current_stage constraint found';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Backfill job_id / recruiter_id on legacy rows (no stage writes).
--    Chain: job_applications.id <- assessment_invites.job_application_id
--            assessment_invites.assessment_id -> assessments.job_id
-- ------------------------------------------------------------
UPDATE job_applications ja
SET job_id = a.job_id
FROM assessment_invites ai
JOIN assessments a ON a.id = ai.assessment_id
WHERE ai.job_application_id = ja.id
  AND ja.job_id IS NULL
  AND a.job_id IS NOT NULL;

UPDATE job_applications ja
SET recruiter_id = j.recruiter_id
FROM jobs j
WHERE j.id = ja.job_id AND ja.recruiter_id IS NULL;

-- ------------------------------------------------------------
-- 5. Seed applications from existing evidence.
--    Safe now that no legacy stage constraint remains.
--    `ON CONFLICT DO NOTHING` (no explicit target) dedupes against
--    whatever unique constraints the table already has.
-- ------------------------------------------------------------
INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
SELECT j.id, c.id, j.recruiter_id, COALESCE(NULLIF(c.current_status, ''), 'Applied'), 'backfill_upload_session'
FROM jobs j
JOIN candidates c
  ON c.upload_session_id = j.upload_session_id
 AND j.upload_session_id IS NOT NULL
 AND c.recruiter_id = j.recruiter_id
ON CONFLICT DO NOTHING;

INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
SELECT sr.job_id, sr.candidate_id, j.recruiter_id, COALESCE(NULLIF(c.current_status, ''), 'Applied'), 'backfill_screening'
FROM screening_results sr
JOIN jobs j ON j.id = sr.job_id
JOIN candidates c ON c.id = sr.candidate_id
ON CONFLICT DO NOTHING;

INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
SELECT a.job_id, ai.candidate_id, a.recruiter_id, COALESCE(NULLIF(c.current_status, ''), 'Applied'), 'backfill_assessment_invite'
FROM assessment_invites ai
JOIN assessments a ON a.id = ai.assessment_id
JOIN candidates c ON c.id = ai.candidate_id
WHERE a.job_id IS NOT NULL AND ai.candidate_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
SELECT a.job_id, aa.candidate_id, a.recruiter_id, COALESCE(NULLIF(c.current_status, ''), 'Applied'), 'backfill_assessment_attempt'
FROM assessment_attempts aa
JOIN assessments a ON a.id = aa.assessment_id
JOIN candidates c ON c.id = aa.candidate_id
WHERE a.job_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Interviews backfill. Guarded: `interviews.job_id` is created by
-- 20261004_job_workflow_slice.sql. Without it this statement fails with an
-- opaque "column i.job_id does not exist", so skip and report instead. This
-- migration is idempotent — re-run it after 20261004 to pick the rows up.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'job_id'
  ) THEN
    EXECUTE $q$
      INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
      SELECT i.job_id, i.candidate_id, j.recruiter_id,
             COALESCE(NULLIF(c.current_status, ''), 'Applied'), 'backfill_interview'
      FROM interviews i
      JOIN jobs j ON j.id = i.job_id
      JOIN candidates c ON c.id = i.candidate_id
      WHERE i.job_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    $q$;
    RAISE NOTICE 'Backfilled applications from interviews';
  ELSE
    RAISE NOTICE 'SKIPPED interviews backfill: interviews.job_id is missing. Apply 20261004_job_workflow_slice.sql, then re-run this migration.';
  END IF;
END $$;

INSERT INTO job_applications (job_id, candidate_id, recruiter_id, current_stage, source)
SELECT pe.job_id, pe.candidate_id, j.recruiter_id,
       COALESCE(NULLIF(pe.to_stage, ''), NULLIF(c.current_status, ''), 'Applied'), 'backfill_progression'
FROM hiring_progression_events pe
JOIN jobs j ON j.id = pe.job_id
JOIN candidates c ON c.id = pe.candidate_id
WHERE pe.job_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 6. Normalize `current_stage` to the canonical Title-Case lifecycle,
--    then install exactly one guard.
--    Unrecognised values become 'Applied' rather than lingering in a
--    vocabulary nothing else in the codebase understands.
-- ------------------------------------------------------------
UPDATE job_applications
SET current_stage = CASE LOWER(TRIM(current_stage))
  WHEN ''                    THEN 'Applied'
  WHEN 'applied'             THEN 'Applied'
  WHEN 'new'                 THEN 'Applied'
  WHEN 'pending'             THEN 'Pending'
  WHEN 'shortlisted'         THEN 'Shortlisted'
  WHEN 'screening'           THEN 'Screening'
  WHEN 'assessment'          THEN 'Assessment'
  WHEN 'technical'           THEN 'Technical Interview'
  WHEN 'technical interview' THEN 'Technical Interview'
  WHEN 'technical_interview' THEN 'Technical Interview'
  WHEN 'technical round'     THEN 'Technical Round'
  WHEN 'interview'           THEN 'Interview'
  WHEN 'hr'                  THEN 'Managerial/HR'
  WHEN 'hr interview'        THEN 'Managerial/HR'
  WHEN 'hr_interview'        THEN 'Managerial/HR'
  WHEN 'managerial'          THEN 'Managerial/HR'
  WHEN 'managerial/hr'       THEN 'Managerial/HR'
  WHEN 'hr round'            THEN 'HR Round'
  WHEN 'offer'               THEN 'Offer'
  WHEN 'offered'             THEN 'Offered'
  WHEN 'hired'               THEN 'Hired'
  WHEN 'rejected'            THEN 'Rejected'
  WHEN 'withdrawn'           THEN 'Withdrawn'
  WHEN 'hold'                THEN 'Hold'
  WHEN 'on_hold'             THEN 'Hold'
  ELSE 'Applied'
END
WHERE current_stage IS DISTINCT FROM CASE LOWER(TRIM(current_stage))
  WHEN ''                    THEN 'Applied'
  WHEN 'applied'             THEN 'Applied'
  WHEN 'new'                 THEN 'Applied'
  WHEN 'pending'             THEN 'Pending'
  WHEN 'shortlisted'         THEN 'Shortlisted'
  WHEN 'screening'           THEN 'Screening'
  WHEN 'assessment'          THEN 'Assessment'
  WHEN 'technical'           THEN 'Technical Interview'
  WHEN 'technical interview' THEN 'Technical Interview'
  WHEN 'technical_interview' THEN 'Technical Interview'
  WHEN 'technical round'     THEN 'Technical Round'
  WHEN 'interview'           THEN 'Interview'
  WHEN 'hr'                  THEN 'Managerial/HR'
  WHEN 'hr interview'        THEN 'Managerial/HR'
  WHEN 'hr_interview'        THEN 'Managerial/HR'
  WHEN 'managerial'          THEN 'Managerial/HR'
  WHEN 'managerial/hr'       THEN 'Managerial/HR'
  WHEN 'hr round'            THEN 'HR Round'
  WHEN 'offer'               THEN 'Offer'
  WHEN 'offered'             THEN 'Offered'
  WHEN 'hired'               THEN 'Hired'
  WHEN 'rejected'            THEN 'Rejected'
  WHEN 'withdrawn'           THEN 'Withdrawn'
  WHEN 'hold'                THEN 'Hold'
  WHEN 'on_hold'             THEN 'Hold'
  ELSE 'Applied'
END;

ALTER TABLE job_applications ADD CONSTRAINT job_applications_current_stage_check
  CHECK (current_stage IN (
    'Applied','Screening','Assessment','Technical Interview','Managerial/HR','Offer','Hired',
    'Rejected','Hold','Withdrawn',
    'Shortlisted','Interview','Interview Scheduled','Interview Completed',
    'Technical Round','HR Round','Offered','Pending'
  ));

-- New rows default to the canonical spelling, not 'applied'.
ALTER TABLE job_applications ALTER COLUMN current_stage SET DEFAULT 'Applied';

-- ------------------------------------------------------------
-- 7. Duplicate application prevention.
--    De-duplicate BEFORE adding the constraint, otherwise the ALTER aborts
--    the whole migration. Rows with NULL job_id are untouched (NULLs are
--    distinct in Postgres, so they cannot collide).
-- ------------------------------------------------------------
DELETE FROM job_applications a
USING job_applications b
WHERE a.job_id IS NOT NULL
  AND a.job_id = b.job_id
  AND a.candidate_id = b.candidate_id
  AND a.candidate_id IS NOT NULL
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_unique_pair'
  ) THEN
    ALTER TABLE job_applications
      ADD CONSTRAINT job_applications_unique_pair UNIQUE (job_id, candidate_id);
    RAISE NOTICE 'Added UNIQUE(job_id, candidate_id)';
  ELSE
    RAISE NOTICE 'UNIQUE(job_id, candidate_id) already present - skipped';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8. Referential integrity, added only when the data permits it.
--    The legacy table has no FKs and a nullable candidate_id, so an FK is
--    attached only if every value already resolves. Otherwise it is skipped
--    and reported rather than failing the migration.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_orphans INT;
BEGIN
  SELECT COUNT(*) INTO v_orphans
  FROM job_applications ja
  WHERE ja.candidate_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.id = ja.candidate_id);

  IF v_orphans = 0 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_candidate_fk'
  ) THEN
    ALTER TABLE job_applications
      ADD CONSTRAINT job_applications_candidate_fk
      FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK job_applications.candidate_id -> candidates.id';
  ELSE
    RAISE NOTICE 'SKIPPED candidate FK: % orphan row(s) would violate it', v_orphans;
  END IF;

  SELECT COUNT(*) INTO v_orphans
  FROM job_applications ja
  WHERE ja.job_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = ja.job_id);

  IF v_orphans = 0 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_job_fk'
  ) THEN
    ALTER TABLE job_applications
      ADD CONSTRAINT job_applications_job_fk
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK job_applications.job_id -> jobs.id';
  ELSE
    RAISE NOTICE 'SKIPPED job FK: % orphan row(s) would violate it', v_orphans;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 9. Indexes.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_job_applications_job_stage
  ON job_applications (job_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate
  ON job_applications (candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_recruiter
  ON job_applications (recruiter_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_unattributed
  ON job_applications (candidate_id)
  WHERE job_id IS NULL;

-- ------------------------------------------------------------
-- 10. Convenience view: the job pipeline, one row per candidate.
--     Exposes the stage as `stage` so consumers read one consistent name.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW job_pipeline AS
SELECT
  ja.id                AS application_id,
  ja.job_id,
  ja.candidate_id,
  ja.recruiter_id,
  ja.current_stage     AS stage,
  ja.source,
  ja.applied_at,
  ja.updated_at,
  c.full_name,
  c.email,
  c.current_title,
  c.current_company,
  c.resume_file_url
FROM job_applications ja
JOIN candidates c ON c.id = ja.candidate_id
WHERE ja.job_id IS NOT NULL;

-- ------------------------------------------------------------
-- 11. Verification output.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_total INT;
  v_unattributed INT;
  v_no_candidate INT;
  v_backfilled INT;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total        FROM job_applications;
  SELECT COUNT(*) INTO v_unattributed FROM job_applications WHERE job_id IS NULL;
  SELECT COUNT(*) INTO v_no_candidate  FROM job_applications WHERE candidate_id IS NULL;
  SELECT COUNT(*) INTO v_backfilled    FROM job_applications WHERE source LIKE 'backfill_%';

  RAISE NOTICE '-------------------------------------------------';
  RAISE NOTICE 'job_applications total=% | backfilled=% | no_job_id=% | no_candidate_id=%',
    v_total, v_backfilled, v_unattributed, v_no_candidate;

  FOR rec IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'job_applications'::regclass AND contype IN ('u','f','c')
  LOOP
    RAISE NOTICE 'constraint % -> %', rec.conname, rec.def;
  END LOOP;

  FOR rec IN
    SELECT current_stage, COUNT(*) AS n FROM job_applications GROUP BY 1 ORDER BY n DESC
  LOOP
    RAISE NOTICE 'stage % : %', rec.current_stage, rec.n;
  END LOOP;
  RAISE NOTICE '-------------------------------------------------';
END $$;