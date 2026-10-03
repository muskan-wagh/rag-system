import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import {
  getGmailCredentials,
  updateGmailAccessToken,
  touchGmailLastUsed,
  markGmailNeedsReauth,
  getGmailConnection,
} from './store';
import { refreshGmailAccessToken, isAccessTokenStale } from './oauth';
import { getSupabaseClient } from '@/services/supabase/client';
import { isValidEmail } from './send';

/**
 * Central Gmail sending service. All app code sends via Gmail through here —
 * Google API details stay isolated in this module.
 *
 * - Multipart text/plain + text/html via MailComposer, optional Reply-To.
 * - Event-specific idempotency keys (NOT content hashes) so identical
 *   legitimate emails remain possible while accidental double-sends don't.
 * - Refresh only when expired/close to expiry; on 401 refresh once + retry once.
 */

export interface SendGmailEmailInput {
  recruiterId: string;
  to: string;
  subject: string;
  /** Plain-text fallback. At least one of text/html required. */
  text?: string;
  html?: string;
  replyTo?: string;
  candidateId?: string;
  emailType?: string;
  /**
   * Event-specific key, e.g. `interview:<interviewId>` or
   * `outreach:<candidateId>:<attemptId>`. Same key + same recruiter =
   * one send. Different events MUST use different keys even if the
   * content is identical.
   */
  idempotencyKey?: string;
}

/** Build an event-specific idempotency key. eventId is required. */
export function buildGmailIdempotencyKey(parts: {
  recruiterId: string;
  emailType: string;
  candidateId?: string;
  eventId: string;
}): string {
  const cand = parts.candidateId || 'bulk';
  return `gmail:${parts.recruiterId}:${parts.emailType}:${cand}:${parts.eventId}`;
}

function gmailError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  return Object.assign(new Error(message), { statusCode, code });
}

async function buildRawMessage(input: {
  from: string; to: string; subject: string; text: string; html?: string; replyTo?: string;
}): Promise<string> {
  const mail = new MailComposer({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo || undefined,
    // MailComposer handles RFC 2047 subject encoding + UTF-8 + address parsing.
  });
  const buffer: Buffer = await mail.compile().build();
  return buffer.toString('base64url');
}

function isAuthFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid_grant') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid_client') ||
    lower.includes('unauthorized') ||
    lower.includes('insufficient') ||
    lower.includes('reauth')
  );
}

function isTransient(message: string, status?: number): boolean {
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  const lower = message.toLowerCase();
  return lower.includes('rate limit') || lower.includes('ratelimitexceeded') || lower.includes('backend error');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function logGmailResult(input: {
  recruiterId: string;
  candidateId?: string;
  emailType: string;
  subject: string;
  // Never store full HTML bodies in logs beyond a bounded preview.
  bodyPreview: string;
  provider: 'gmail';
  messageId: string | null;
  status: 'sent' | 'failed';
  error?: string;
  idempotencyKey?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('email_logs').insert({
      candidate_id: input.candidateId || null,
      recruiter_id: input.recruiterId,
      email_type: input.emailType,
      subject: input.subject,
      body: input.bodyPreview.slice(0, 2000),
      provider: input.provider,
      gmail_message_id: input.messageId,
      status: input.status,
      error: input.error || null,
      idempotency_key: input.idempotencyKey || null,
    });
    if (error) logger.warn('gmail email log failed', { error: error.message });
  } catch (err) {
    logger.warn('gmail email log exception', { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function sendGmailEmail(input: SendGmailEmailInput): Promise<{ messageId: string }> {
  const recruiterId = input.recruiterId;
  if (!recruiterId) throw gmailError(401, 'VALIDATION_ERROR', 'Authentication required.');
  const to = (input.to || '').trim();
  const subject = (input.subject || '').trim();
  const text = (input.text || '').trim();
  const html = (input.html || '').trim();
  if (!isValidEmail(to)) throw gmailError(400, 'INVALID_EMAIL', 'Invalid recipient email address.');
  if (!subject) throw gmailError(400, 'VALIDATION_ERROR', 'Subject is required.');
  if (!text && !html) throw gmailError(400, 'VALIDATION_ERROR', 'Email body is required.');
  if (input.replyTo && !isValidEmail(input.replyTo.trim())) {
    throw gmailError(400, 'INVALID_EMAIL', 'Invalid Reply-To email address.');
  }

  const emailType = input.emailType || 'gmail_outreach';
  const bodyPreview = text || html.replace(/<[^>]*>/g, ' ').slice(0, 2000);

  // Idempotency: event key only. No content-hash fallback by design.
  if (input.idempotencyKey) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('email_logs')
        .select('gmail_message_id, status')
        .eq('recruiter_id', recruiterId)
        .eq('idempotency_key', input.idempotencyKey)
        .eq('status', 'sent')
        .limit(1)
        .maybeSingle();
      const existing = data as { gmail_message_id?: string | null } | null;
      if (existing?.gmail_message_id) {
        logger.info('gmail duplicate suppressed by idempotency key');
        return { messageId: existing.gmail_message_id };
      }
    } catch (err) {
      logger.warn('gmail idempotency check failed (proceeding to send)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const creds = await getGmailCredentials(recruiterId);
  if (!creds) {
    const state = await getGmailConnection(recruiterId);
    if (state.status === 'error') {
      throw gmailError(401, 'REAUTH_REQUIRED', 'Gmail authorization expired. Please reconnect Gmail.');
    }
    throw gmailError(409, 'GMAIL_NOT_CONNECTED', 'Gmail is not connected. Please connect Gmail first.');
  }

  // Refresh only when missing/expired/close to expiry — not on every send.
  let accessToken = creds.accessToken;
  let refreshed = false;
  if (isAccessTokenStale(accessToken, creds.expiry)) {
    try {
      const { accessToken: fresh, expiry } = await refreshGmailAccessToken(creds.refreshToken);
      accessToken = fresh;
      refreshed = true;
      await updateGmailAccessToken(recruiterId, fresh, expiry).catch((err) => {
        logger.warn('gmail access token cache update failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gmail authorization failed.';
      await markGmailNeedsReauth(recruiterId);
      await logGmailResult({
        recruiterId, candidateId: input.candidateId, emailType, subject, bodyPreview,
        provider: 'gmail', messageId: null, status: 'failed', error: message,
        idempotencyKey: input.idempotencyKey,
      });
      throw gmailError(401, 'REAUTH_REQUIRED', 'Gmail authorization expired. Please reconnect Gmail.');
    }
  }
  void refreshed;

  const raw = await buildRawMessage({
    from: creds.email, to, subject,
    text: text || html.replace(/<[^>]*>/g, ' '),
    html: html || undefined,
    replyTo: input.replyTo?.trim(),
  });

  const doSend = async (token: string): Promise<string> => {
    const client = new google.auth.OAuth2(
      config.google.clientId, config.google.clientSecret, config.google.redirectUri,
    );
    client.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: 'v1', auth: client });
    const { data } = await gmail.users.messages.send({
      userId: 'me', requestBody: { raw },
    });
    if (!data.id) throw new Error('Gmail send returned no message ID.');
    return data.id;
  };

  // Limited retries: transient 429/5xx with backoff (max 2 tries), auth refresh+retry once.
  let lastError: unknown = null;
  let tokenInUse = accessToken as string;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const messageId = await doSend(tokenInUse);
      await touchGmailLastUsed(recruiterId);
      await logGmailResult({
        recruiterId, candidateId: input.candidateId, emailType, subject, bodyPreview,
        provider: 'gmail', messageId, status: 'sent', idempotencyKey: input.idempotencyKey,
      });
      logger.info('Gmail message sent');
      return { messageId };
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : 'Gmail send failed.';
      const status = (err as { code?: number; status?: number; response?: { status?: number } }).response?.status
        ?? (err as { code?: number; status?: number }).code
        ?? (err as { status?: number }).status;
      const statusNum = typeof status === 'number' ? status : undefined;

      if (isAuthFailure(message) && attempt === 0) {
        // Refresh once, retry once.
        try {
          const { accessToken: fresh, expiry } = await refreshGmailAccessToken(creds.refreshToken);
          tokenInUse = fresh;
          await updateGmailAccessToken(recruiterId, fresh, expiry).catch(() => undefined);
          continue;
        } catch (refreshErr) {
          await markGmailNeedsReauth(recruiterId);
          const msg = refreshErr instanceof Error ? refreshErr.message : 'Gmail authorization failed.';
          await logGmailResult({
            recruiterId, candidateId: input.candidateId, emailType, subject, bodyPreview,
            provider: 'gmail', messageId: null, status: 'failed', error: msg,
            idempotencyKey: input.idempotencyKey,
          });
          throw gmailError(401, 'REAUTH_REQUIRED', 'Gmail authorization expired. Please reconnect Gmail.');
        }
      }
      if (isAuthFailure(message)) {
        await markGmailNeedsReauth(recruiterId);
        await logGmailResult({
          recruiterId, candidateId: input.candidateId, emailType, subject, bodyPreview,
          provider: 'gmail', messageId: null, status: 'failed', error: message,
          idempotencyKey: input.idempotencyKey,
        });
        throw gmailError(401, 'REAUTH_REQUIRED', 'Gmail authorization expired. Please reconnect Gmail.');
      }
      if (isTransient(message, statusNum) && attempt === 0) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      logger.error('Gmail send failed', { error: message });
      await logGmailResult({
        recruiterId, candidateId: input.candidateId, emailType, subject, bodyPreview,
        provider: 'gmail', messageId: null, status: 'failed', error: message,
        idempotencyKey: input.idempotencyKey,
      });
      throw gmailError(502, 'GMAIL_SEND_FAILED', 'Gmail send failed. Please try again.');
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'Gmail send failed.';
  throw gmailError(502, 'GMAIL_SEND_FAILED', message);
}
