import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  getRecruiterGmailState,
  setRecruiterGmail,
  clearRecruiterGmail,
} from '@/services/supabase/database';
import {
  isGmailConfigured,
  getGmailAuthUrl,
  verifyGmailAuthState,
  exchangeGmailCode,
} from '@/services/gmail/oauth';

export const gmailStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) {
    throw new AppError('Authentication required', 401, ErrorCodes.VALIDATION_ERROR);
  }
  if (!isGmailConfigured()) {
    res.status(200).json({ success: true, data: { connected: false, email: '', configured: false } });
    return;
  }
  const state = await getRecruiterGmailState(recruiter.id);
  res.status(200).json({ success: true, data: { ...state, configured: true } });
});

export const gmailAuthUrlHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) {
    throw new AppError('Authentication required', 401, ErrorCodes.VALIDATION_ERROR);
  }
  if (!isGmailConfigured()) {
    throw new AppError('Gmail is not configured on the server.', 503, ErrorCodes.INTERNAL_ERROR);
  }
  const url = getGmailAuthUrl(recruiter.id);
  res.status(200).json({ success: true, data: { url } });
});

export const gmailCallbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  const clientUrl = config.clientUrl.replace(/\/+$/, '');

  if (error || !code || !state) {
    logger.warn('Gmail OAuth callback missing params', { hasCode: Boolean(code), hasState: Boolean(state), error });
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=${encodeURIComponent(error || 'missing_params')}`);
    return;
  }

  const verified = verifyGmailAuthState(state);
  if (!verified) {
    logger.warn('Gmail OAuth callback invalid state');
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=invalid_state`);
    return;
  }

  try {
    const { refreshToken, connectedEmail } = await exchangeGmailCode(code);
    // Server-side only: refresh token stored in Supabase, never sent to browser.
    await setRecruiterGmail(verified.recruiterId, connectedEmail, refreshToken);
    logger.info('Gmail connected for recruiter');
    res.redirect(`${clientUrl}/gmail/connected?ok=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    logger.error('Gmail OAuth exchange failed', { error: message });
    res.redirect(`${clientUrl}/gmail/connected?ok=0&reason=exchange_failed`);
  }
});

export const gmailDisconnectHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) {
    throw new AppError('Authentication required', 401, ErrorCodes.VALIDATION_ERROR);
  }
  await clearRecruiterGmail(recruiter.id);
  res.status(200).json({ success: true, data: { message: 'Gmail disconnected' } });
});
