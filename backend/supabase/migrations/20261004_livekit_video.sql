-- ============================================================
-- HireStack LiveKit video layer (2026-10-04) — audit fields only.
-- No new tables. Room names are deterministic per interview
-- (see services/livekit/service.ts), so only factual audit
-- metadata is stored: room id, start/end timestamps, and
-- observable camera/mic signals (never a cheating verdict).
-- Video/audio bytes are NEVER recorded or stored.
-- Safe to re-run (guarded ALTERs).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interviews'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'video_room'
    ) THEN
      ALTER TABLE interviews ADD COLUMN video_room TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'video_started_at'
    ) THEN
      ALTER TABLE interviews ADD COLUMN video_started_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'video_ended_at'
    ) THEN
      ALTER TABLE interviews ADD COLUMN video_ended_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'video_signals'
    ) THEN
      ALTER TABLE interviews ADD COLUMN video_signals JSONB NOT NULL DEFAULT '[]';
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_interviews_video_started
  ON interviews(video_started_at);

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cols INT;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'interviews'
    AND column_name IN ('video_room','video_started_at','video_ended_at','video_signals');
  RAISE NOTICE 'LIVEKIT VIDEO MIGRATION OK: video_cols=%/4', v_cols;
END
$$;
