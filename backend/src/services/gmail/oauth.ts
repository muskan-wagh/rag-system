import crypto from 'crypto';
import { google } from 'googleapis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const STATE_TTL_MS = 10 * 60 * 1000;

function getOAuthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
}

export function isGmailConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

function signState(recruiterId: string, nonce: string, ts: number): string {
  // HMAC with clerk secret — never exposes tokens; binds popup flow to recruiter.
  const key = config.clerkSecretKey;
  return crypto.createHmac('sha256', key).update(`${recruiterId}.${nonce}.${ts}`).digest('hex');
}

export function buildGmailAuthState(recruiterId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now();
  const sig = signState(recruiterId, nonce, ts);
  const raw = `${recruiterId}.${nonce}.${ts}.${sig}`;
  return Buffer.from(raw, 'utf-8').toString('base64url');
}

export function verifyGmailAuthState(state: string): { recruiterId: string } | null {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf-8');
    const [recruiterId, nonce, tsStr, sig] = raw.split('.');
    if (!recruiterId || !nonce || !tsStr || !sig) return null;
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;
    const expected = signState(recruiterId, nonce, ts);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return { recruiterId };
  } catch {
    return null;
  }
}

export function getGmailAuthUrl(recruiterId: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: buildGmailAuthState(recruiterId),
  });
}

export async function exchangeGmailCode(code: string): Promise<{
  refreshToken: string;
  connectedEmail: string;
}> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Ask the recruiter to reconnect with consent.');
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email || '';
  if (!email) throw new Error('Could not determine the connected Gmail address.');
  logger.info('Gmail OAuth connected');
  return { refreshToken: tokens.refresh_token, connectedEmail: email };
}

export async function getGmailAccessToken(refreshToken: string): Promise<string> {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not refresh Gmail access token. Reconnect Gmail.');
  return token;
}

export async function getGmailProfileEmail(refreshToken: string): Promise<string> {
  const accessToken = await getGmailAccessToken(refreshToken);
  const client = getOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const { data } = await gmail.users.getProfile({ userId: 'me' });
  return data.emailAddress || '';
}
