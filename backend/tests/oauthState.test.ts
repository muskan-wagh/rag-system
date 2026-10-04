import { describe, it, expect } from 'vitest';
import {
  buildGmailAuthState,
  verifyGmailAuthState,
  getGmailAuthUrl,
  isGmailConfigured,
  isAccessTokenStale,
} from '@/services/gmail/oauth';

describe('Gmail OAuth state (CSRF)', () => {
  it('round-trips a valid state bound to the recruiter', () => {
    const state = buildGmailAuthState('recruiter-123');
    const verified = verifyGmailAuthState(state);
    expect(verified).toEqual({ recruiterId: 'recruiter-123' });
  });

  it('rejects tampered state', () => {
    const state = buildGmailAuthState('recruiter-123');
    const raw = Buffer.from(state, 'base64url').toString('utf-8');
    const tampered = Buffer.from(raw.replace('recruiter-123', 'recruiter-999'), 'utf-8').toString('base64url');
    expect(verifyGmailAuthState(tampered)).toBeNull();
  });

  it('rejects garbage/empty state', () => {
    expect(verifyGmailAuthState('')).toBeNull();
    expect(verifyGmailAuthState('!!!not-base64!!!')).toBeNull();
    expect(verifyGmailAuthState(Buffer.from('a.b.c', 'utf-8').toString('base64url'))).toBeNull();
  });

  it('rejects expired state', () => {
    // Craft an old timestamp manually (same HMAC scheme as buildGmailAuthState).
    // Instead of duplicating HMAC, assert the TTL path via a real state that we
    // artificially age: verification must fail once Date.now is far ahead.
    const state = buildGmailAuthState('recruiter-123');
    expect(verifyGmailAuthState(state)).not.toBeNull();
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 11 * 60 * 1000; // past 10-min TTL
      expect(verifyGmailAuthState(state)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('Gmail OAuth URL + scopes', () => {
  it('is configured in test env', () => {
    expect(isGmailConfigured()).toBe(true);
  });

  it('requests minimal scopes only (send + identity, no inbox/calendar/drive)', () => {
    const url = getGmailAuthUrl('recruiter-123');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.send'));
    for (const forbidden of [
      'gmail.readonly', 'gmail.modify', 'gmail.compose', 'gmail.metadata',
      'calendar', 'drive', 'contacts', 'userinfo.profile',
    ]) {
      expect(url).not.toContain(forbidden);
    }
    expect(url).toContain('access_type=offline');
    expect(url).toContain('state=');
  });
});

describe('isAccessTokenStale', () => {
  it('treats missing token/expiry as stale (refresh needed)', () => {
    expect(isAccessTokenStale(null, null)).toBe(true);
    expect(isAccessTokenStale('tok', null)).toBe(true);
  });

  it('does not refresh a fresh token (avoids refresh-on-every-send)', () => {
    const farFuture = new Date(Date.now() + 60 * 60 * 1000);
    expect(isAccessTokenStale('tok', farFuture)).toBe(false);
  });

  it('refreshes when expired or within 5 min of expiry', () => {
    expect(isAccessTokenStale('tok', new Date(Date.now() - 1000))).toBe(true);
    expect(isAccessTokenStale('tok', new Date(Date.now() + 4 * 60 * 1000))).toBe(true);
    expect(isAccessTokenStale('tok', new Date(Date.now() + 6 * 60 * 1000))).toBe(false);
  });
});
