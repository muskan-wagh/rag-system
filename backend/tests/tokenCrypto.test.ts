import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, looksEncrypted, isTokenCryptoConfigured } from '@/utils/tokenCrypto';

describe('tokenCrypto (AES-256-GCM)', () => {
  it('is configured in test env', () => {
    expect(isTokenCryptoConfigured()).toBe(true);
  });

  it('round-trips a refresh token', () => {
    const plaintext = '1//09test-refresh-token-abc123';
    const enc = encryptToken(plaintext);
    expect(enc).not.toContain(plaintext);
    expect(looksEncrypted(enc)).toBe(true);
    expect(decryptToken(enc)).toBe(plaintext);
  });

  it('produces unique ciphertexts (random IV)', () => {
    const a = encryptToken('same-token');
    const b = encryptToken('same-token');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe('same-token');
    expect(decryptToken(b)).toBe('same-token');
  });

  it('rejects tampered payloads', () => {
    const enc = encryptToken('secret');
    const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA');
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptToken('not-encrypted-plaintext')).toThrow();
  });

  it('does not mistake plaintext for encrypted', () => {
    expect(looksEncrypted('1//plaintext-refresh-token')).toBe(false);
  });
});
