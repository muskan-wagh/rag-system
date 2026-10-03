import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  getGmailConnection,
  getGmailCredentials,
  upsertGmailConnection,
  deleteGmailConnection,
} from '@/services/gmail/store';
import {
  isGmailConfigured,
  getGmailAuthUrl,
  verifyGmailAuthState,
  exchangeGmailCode,
  revokeGoogleToken,
} from '@/services/gmail/oauth';

function requireRecruiter(req: Request) {
  const recruiter = req.recruiter;
  if (!recruiter) {
    throw new AppError('Authentication required', 401, ErrorCodes.VALIDATION_ERROR);
  }
  return recruiter;
}

/** Canonical status shape — safe fields only, never tokens. */
async function buildStatus(recruiterId: string) {
  if (!isGmailConfigured()) {
    return { connected: false, configured: false } as const;
  }
  const state = await getGmailConnection(recruiterId);
  if (!state.connected) {
    return {
      connected: false as const,
      configured: true as const,
      status: state.status,
    };
  }
  return {
    connected: true as const,
    email: state.email,
    status: state.status,
    connectedAt: state.connectedAt,
    lastUsedAt: state.lastUsedAt,
    configured: true as const,
  };
}

// ---------- Canonical handlers: GET /api/integrations/gmail ----------

export const gmailGetHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  const data = await buildStatus(recruiter.id);
  res.status(200).json({ success: true, data });
});

/** Spec-compliant connect: 302 redirect straight to Google (no JSON). */
export const gmailConnectHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  if (!isGmailConfigured()) {
    throw new AppError(
      'Gmail is not configured on the server. Set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.',
      503,
      ErrorCodes.INTERNAL_ERROR,
    );
  }
  const url = getGmailAuthUrl(recruiter.id);
  res.redirect(302, url);
});

/** Canonical disconnect: idempotent DELETE, revokes at Google best-effort. */
export const gmailDeleteHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  // Fetch (decrypted, server-side only) so we can revoke before deleting.
  // Never send this token anywhere except Google's revoke endpoint.
  let refreshToken: string | null = null;
  try {
    const creds = await getGmailCredentials(recruiter.id);
    refreshToken = creds?.refreshToken || null;
  } catch {
    refreshToken = null;
  }
  if (refreshToken) {
    await revokeGoogleToken(refreshToken);
  }
  await deleteGmailConnection(recruiter.id);
  res.status(200).json({ success: true, data: { message: 'Gmail disconnected', connected: false } });
});

export const gmailCallbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  const errorDescription =
    typeof req.query.error_description === 'string' ? req.query.error_description : '';
  const clientUrl = config.clientUrl.replace(/\/+$/, '');

  if (error || !code || !state) {
    // access_denied is a normal user choice — warn, don't error.
    logger.warn('Gmail OAuth callback missing params', { hasCode: Boolean(code), hasState: Boolean(state), error });
    const reason = error || 'missing_params';
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=${encodeURIComponent(reason)}`);
    return;
  }

  const verified = verifyGmailAuthState(state);
  if (!verified) {
    logger.warn('Gmail OAuth callback invalid state');
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=invalid_state`);
    return;
  }

  try {
    const result = await exchangeGmailCode(code);
    // Encrypted server-side only via store; never sent to browser.
    await upsertGmailConnection({
      recruiterId: verified.recruiterId,
      googleAccountId: result.googleAccountId,
      email: result.connectedEmail,
      refreshToken: result.refreshToken,
      accessToken: result.accessToken,
      expiry: result.expiry,
      scopes: result.scopes,
    });
    logger.info('Gmail connected for recruiter');
    res.redirect(`${clientUrl}/gmail/connected?ok=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    // Map common OAuth failures to user-friendly reasons; never leak tokens.
    const lower = message.toLowerCase();
    const reason = lower.includes('invalid_grant')
      ? 'invalid_grant'
      : lower.includes('refresh token')
        ? 'consent_required'
        : 'exchange_failed';
    logger.error('Gmail OAuth exchange failed', { error: message, reason, errorDescription });
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=${reason}`);
  }
});

// ---------- Legacy aliases: /api/gmail/* (thin, backward-compatible) ----------

export const gmailStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  if (!isGmailConfigured()) {
    res.status(200).json({ success: true, data: { connected: false, email: '', configured: false } });
    return;
  }
  const state = await getGmailConnection(recruiter.id);
  res.status(200).json({
    success: true,
    data: {
      connected: state.connected,
      email: state.connected ? state.email : '',
      status: state.status,
      connectedAt: state.connectedAt,
      lastUsedAt: state.lastUsedAt,
      configured: true,
    },
  });
});

/** Popup flow needs the URL as JSON (modal opens it in a popup window). */
export const gmailAuthUrlHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  if (!isGmailConfigured()) {
    throw new AppError('Gmail is not configured on the server.', 503, ErrorCodes.INTERNAL_ERROR);
  }
  const url = getGmailAuthUrl(recruiter.id);
  res.status(200).json({ success: true, data: { url } });
});

export const gmailDisconnectHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = requireRecruiter(req);
  let refreshToken: string | null = null;
  try {
    const creds = await getGmailCredentials(recruiter.id);
    refreshToken = creds?.refreshToken || null;
  } catch {
    refreshToken = null;
  }
  if (refreshToken) await revokeGoogleToken(refreshToken);
  await deleteGmailConnection(recruiter.id);
  res.status(200).json({ success: true, data: { message: 'Gmail disconnected' } });
});
