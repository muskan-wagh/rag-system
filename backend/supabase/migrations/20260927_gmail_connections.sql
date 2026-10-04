-- ============================================================
-- Gmail connections (canonical store, replaces plaintext
-- recruiters.gmail_* columns). Idempotent — safe to re-run.
-- Tokens are AES-256-GCM encrypted by the backend before insert.
-- Never expose *_encrypted columns to the browser.
-- ============================================================

CREATE TABLE IF NOT EXISTS gmail_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  google_account_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- One row per recruiter per Google account; reconnecting the same
-- Gmail address must update/reuse, never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gmail_conn_recruiter_account
  ON gmail_connections(recruiter_id, google_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gmail_conn_recruiter_email
  ON gmail_connections(recruiter_id, email);
CREATE INDEX IF NOT EXISTS idx_gmail_conn_recruiter
  ON gmail_connections(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_gmail_conn_status
  ON gmail_connections(recruiter_id, status);

-- ============================================================
-- email_logs extensions (provider-aware, idempotent sends)
-- ============================================================
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Event-specific dedupe: same recruiter + same event key = one send.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_logs_recruiter_idem
  ON email_logs(recruiter_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_recruiter_provider
  ON email_logs(recruiter_id, provider);
CREATE INDEX IF NOT EXISTS idx_email_logs_gmail_msg
  ON email_logs(gmail_message_id)
  WHERE gmail_message_id IS NOT NULL;

-- ============================================================
-- Legacy plaintext columns on recruiters are DEPRECATED.
-- The backend lazily migrates any existing gmail_refresh_token into
-- gmail_connections (encrypted) on next status/send call, then NULLs
-- the legacy columns. Do NOT write to them from new code.
-- Manual cleanup after verifying migration (optional, run once):
--   UPDATE recruiters
--   SET gmail_connected_email = NULL,
--       gmail_refresh_token = NULL
--   WHERE id IN (SELECT recruiter_id FROM gmail_connections);
-- ============================================================

ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_connected_email TEXT DEFAULT '';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT DEFAULT '';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMPTZ;
