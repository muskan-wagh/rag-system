import { google } from 'googleapis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { getGmailAccessToken } from './oauth';

function encodeSubject(subject: string): string {
  // RFC 2047 for non-ASCII subjects; ASCII passes through untouched.
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
}

function buildMimeMessage(params: { to: string; subject: string; textBody: string }): string {
  const lines = [
    `To: ${params.to}`,
    `Subject: ${encodeSubject(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(params.textBody, 'utf-8').toString('base64'),
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export async function sendGmailMessage(params: {
  refreshToken: string;
  to: string;
  subject: string;
  textBody: string;
}): Promise<{ messageId: string }> {
  const to = params.to.trim();
  const subject = params.subject.trim();
  const textBody = params.textBody;

  if (!isValidEmail(to)) {
    throw Object.assign(new Error('Invalid recipient email address.'), { statusCode: 400, code: 'INVALID_EMAIL' });
  }
  if (!subject) {
    throw Object.assign(new Error('Subject is required.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  if (!textBody.trim()) {
    throw Object.assign(new Error('Email body is required.'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const accessToken = await getGmailAccessToken(params.refreshToken).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Gmail authorization failed.';
    throw Object.assign(new Error(message), { statusCode: 401, code: 'REAUTH_REQUIRED' });
  });

  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: client });

  try {
    const { data } = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: buildMimeMessage({ to, subject, textBody }) },
    });
    logger.info('Gmail message sent');
    return { messageId: data.id || '' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gmail send failed.';
    const lower = message.toLowerCase();
    if (lower.includes('invalid_grant') || lower.includes('invalid credentials') || lower.includes('insufficient')) {
      throw Object.assign(new Error('Gmail authorization expired. Please reconnect Gmail.'), { statusCode: 401, code: 'REAUTH_REQUIRED' });
    }
    logger.error('Gmail send failed', { error: message });
    throw Object.assign(new Error('Gmail send failed. Please try again.'), { statusCode: 502, code: 'GMAIL_SEND_FAILED' });
  }
}
