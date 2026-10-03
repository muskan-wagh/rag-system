import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import { encryptToken, decryptToken, isTokenCryptoConfigured } from '@/utils/tokenCrypto';

/**
 * Canonical Gmail connection store (gmail_connections table).
 *
 * - All queries scoped to recruiterId (multi-user safe; never trust browser IDs).
 * - Refresh tokens always AES-256-GCM encrypted; access tokens encrypted if stored.
 * - Reconnecting the same Gmail account updates/reuses the row (unique
 *   recruiter+email / recruiter+google_account_id) — never duplicates.
 * - Legacy plaintext recruiters.gmail_* columns are migrated lazily on read
 *   and then NULLED so no duplicate active storage remains.
 */

export type GmailConnectionStatus = 'active' | 'revoked' | 'error';

export interface GmailConnectionSafe {
  connected: boolean;
  email: string;
  status: GmailConnectionStatus | 'disconnected';
  googleAccountId: string;
  scopes: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
}

interface GmailRow {
  id: string;
  recruiter_id: string;
  google_account_id: string | null;
  email: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string;
  token_expiry: string | null;
  scopes: string[] | null;
  status: GmailConnectionStatus;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

function toSafe(row: GmailRow | null): GmailConnectionSafe {
  if (!row) {
    return {
      connected: false, email: '', status: 'disconnected',
      googleAccountId: '', scopes: [], connectedAt: null, lastUsedAt: null,
    };
  }
  const active = row.status === 'active';
  return {
    connected: active,
    email: active ? row.email : row.email,
    status: row.status,
    googleAccountId: row.google_account_id || '',
    scopes: row.scopes || [],
    connectedAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function requireCrypto(): void {
  if (!isTokenCryptoConfigured()) {
    throw new AppError(
      'Gmail token encryption is not configured (GMAIL_TOKEN_ENCRYPTION_KEY).',
      503,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
}

/** One-time lazy migration: plaintext legacy → encrypted canonical row, then clear legacy. */
async function migrateLegacyIfNeeded(recruiterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: legacy, error: legacyErr } = await supabase
    .from('recruiters')
    .select('gmail_connected_email, gmail_refresh_token, gmail_connected_at')
    .eq('id', recruiterId)
    .maybeSingle();
  if (legacyErr) {
    logger.warn('gmail legacy read failed', { error: legacyErr.message });
    return;
  }
  const row = legacy as {
    gmail_connected_email?: string | null;
    gmail_refresh_token?: string | null;
    gmail_connected_at?: string | null;
  } | null;
  const legacyToken = row?.gmail_refresh_token || '';
  const legacyEmail = row?.gmail_connected_email || '';
  if (!legacyToken || !legacyEmail) return;

  // Already migrated? Don't duplicate.
  const { data: existing } = await supabase
    .from('gmail_connections')
    .select('id')
    .eq('recruiter_id', recruiterId)
    .eq('email', legacyEmail)
    .maybeSingle();
  if (existing) {
    // Stale legacy left behind — clear it so plaintext is gone.
    await supabase.from('recruiters').update({
      gmail_connected_email: null, gmail_refresh_token: null, updated_at: new Date().toISOString(),
    }).eq('id', recruiterId);
    return;
  }

  try {
    requireCrypto();
  } catch {
    logger.warn('gmail legacy migration skipped — encryption key missing');
    return;
  }
  const { error: insErr } = await supabase.from('gmail_connections').insert({
    recruiter_id: recruiterId,
    google_account_id: '',
    email: legacyEmail,
    refresh_token_encrypted: encryptToken(legacyToken),
    access_token_encrypted: null,
    token_expiry: null,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    status: 'active',
  });
  if (insErr) {
    logger.warn('gmail legacy migration insert failed', { error: insErr.message });
    return;
  }
  const { error: clearErr } = await supabase.from('recruiters').update({
    gmail_connected_email: null, gmail_refresh_token: null, updated_at: new Date().toISOString(),
  }).eq('id', recruiterId);
  if (clearErr) logger.warn('gmail legacy clear failed', { error: clearErr.message });
  else logger.info('gmail legacy token migrated to encrypted store');
}

export async function getGmailConnection(recruiterId: string): Promise<GmailConnectionSafe & { rowId: string | null }> {
  await migrateLegacyIfNeeded(recruiterId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError('Failed to get Gmail status', 500, ErrorCodes.DATABASE_ERROR);
  const row = (data as GmailRow | null) || null;
  return { ...toSafe(row), rowId: row?.id || null };
}

export interface GmailCredentials {
  refreshToken: string;
  accessToken: string | null;
  expiry: Date | null;
  email: string;
  googleAccountId: string;
  scopes: string[];
  rowId: string;
}

export async function getGmailCredentials(recruiterId: string): Promise<GmailCredentials | null> {
  await migrateLegacyIfNeeded(recruiterId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError('Failed to get Gmail credentials', 500, ErrorCodes.DATABASE_ERROR);
  const row = (data as GmailRow | null) || null;
  if (!row) return null;
  let refreshToken: string;
  let accessToken: string | null = null;
  try {
    refreshToken = decryptToken(row.refresh_token_encrypted);
    if (row.access_token_encrypted) {
      try { accessToken = decryptToken(row.access_token_encrypted); } catch { accessToken = null; }
    }
  } catch (err) {
    logger.error('gmail token decrypt failed', { error: err instanceof Error ? err.message : String(err) });
    throw new AppError('Gmail credentials unreadable. Please reconnect Gmail.', 500, ErrorCodes.INTERNAL_ERROR);
  }
  return {
    refreshToken, accessToken,
    expiry: row.token_expiry ? new Date(row.token_expiry) : null,
    email: row.email, googleAccountId: row.google_account_id || '',
    scopes: row.scopes || [], rowId: row.id,
  };
}

export async function upsertGmailConnection(input: {
  recruiterId: string;
  googleAccountId: string;
  email: string;
  refreshToken: string;
  accessToken?: string | null;
  expiry?: Date | null;
  scopes?: string[];
}): Promise<void> {
  requireCrypto();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    recruiter_id: input.recruiterId,
    google_account_id: input.googleAccountId || '',
    email: input.email,
    refresh_token_encrypted: encryptToken(input.refreshToken),
    access_token_encrypted: input.accessToken ? encryptToken(input.accessToken) : null,
    token_expiry: input.expiry ? input.expiry.toISOString() : null,
    scopes: input.scopes && input.scopes.length ? input.scopes : ['https://www.googleapis.com/auth/gmail.send'],
    status: 'active',
    updated_at: now,
    last_used_at: null,
  };
  // Reconnect same account → update (match email first, then account id).
  const { data: existing } = await supabase
    .from('gmail_connections')
    .select('id')
    .eq('recruiter_id', input.recruiterId)
    .or(`email.eq.${input.email},google_account_id.eq.${input.googleAccountId || '__none__'}`)
    .limit(1)
    .maybeSingle();
  if (existing && (existing as { id: string }).id) {
    const { error } = await supabase
      .from('gmail_connections')
      .update({ ...payload, created_at: undefined })
      .eq('id', (existing as { id: string }).id)
      .eq('recruiter_id', input.recruiterId);
    if (error) throw new AppError('Failed to save Gmail connection', 500, ErrorCodes.DATABASE_ERROR);
    return;
  }
  const { error } = await supabase.from('gmail_connections').insert(payload);
  if (error) {
    // Unique race → fall back to update by email.
    if (error.message.includes('duplicate') || error.code === '23505') {
      const { error: updErr } = await supabase.from('gmail_connections').update(payload)
        .eq('recruiter_id', input.recruiterId).eq('email', input.email);
      if (updErr) throw new AppError('Failed to save Gmail connection', 500, ErrorCodes.DATABASE_ERROR);
      return;
    }
    throw new AppError('Failed to save Gmail connection', 500, ErrorCodes.DATABASE_ERROR);
  }
  // Clear any legacy plaintext left behind for this recruiter.
  await supabase.from('recruiters').update({
    gmail_connected_email: null, gmail_refresh_token: null, updated_at: now,
  }).eq('id', input.recruiterId);
}

export async function updateGmailAccessToken(
  recruiterId: string, accessToken: string, expiry: Date | null,
): Promise<void> {
  requireCrypto();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('gmail_connections').update({
    access_token_encrypted: encryptToken(accessToken),
    token_expiry: expiry ? expiry.toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('recruiter_id', recruiterId).eq('status', 'active');
  if (error) throw new AppError('Failed to update Gmail token', 500, ErrorCodes.DATABASE_ERROR);
}

export async function touchGmailLastUsed(recruiterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('gmail_connections').update({
    last_used_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('recruiter_id', recruiterId).eq('status', 'active');
}

export async function markGmailNeedsReauth(recruiterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('gmail_connections').update({
    status: 'error', access_token_encrypted: null, updated_at: new Date().toISOString(),
  }).eq('recruiter_id', recruiterId);
  if (error) logger.warn('markGmailNeedsReauth failed', { error: error.message });
}

export async function deleteGmailConnection(recruiterId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('gmail_connections')
    .select('id').eq('recruiter_id', recruiterId);
  const rows = (data as { id: string }[] | null) || [];
  if (rows.length) {
    const { error } = await supabase.from('gmail_connections')
      .delete().eq('recruiter_id', recruiterId);
    if (error) throw new AppError('Failed to disconnect Gmail', 500, ErrorCodes.DATABASE_ERROR);
  }
  // Also clear legacy plaintext (idempotent — no-op if already null).
  await supabase.from('recruiters').update({
    gmail_connected_email: null, gmail_refresh_token: null, updated_at: new Date().toISOString(),
  }).eq('id', recruiterId);
  return rows.length > 0;
}
