import { beforeEach, describe, expect, it } from 'vitest';

import { base64Url, challengeFor, isClientId, takePendingAuthorization } from './spotifyAuth';

describe('PKCE helpers', () => {
  it('encodes base64url without padding or URL hostile characters', () => {
    expect(base64Url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
    expect(base64Url(new Uint8Array([1]))).toBe('AQ');
  });

  it('derives the RFC 7636 example challenge', async () => {
    // Appendix B of RFC 7636.
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('accepts only 32 hex character client IDs', () => {
    expect(isClientId('0123456789abcdef0123456789ABCDEF')).toBe(true);
    expect(isClientId(' 0123456789abcdef0123456789abcdef ')).toBe(true);
    expect(isClientId('not-a-client-id')).toBe(false);
  });
});

describe('takePendingAuthorization', () => {
  beforeEach(() => sessionStorage.clear());

  it('hands back what was stored once, and only for the matching state', () => {
    sessionStorage.setItem('crimson:spotify-verifier', 'v');
    sessionStorage.setItem('crimson:spotify-state', 's');
    sessionStorage.setItem('crimson:spotify-client', 'c');
    expect(takePendingAuthorization('s')).toEqual({ verifier: 'v', clientId: 'c' });
    expect(() => takePendingAuthorization('s')).toThrow(/did not start in this tab/);
  });

  it('refuses a callback with the wrong state', () => {
    sessionStorage.setItem('crimson:spotify-verifier', 'v');
    sessionStorage.setItem('crimson:spotify-state', 's');
    sessionStorage.setItem('crimson:spotify-client', 'c');
    expect(() => takePendingAuthorization('other')).toThrow(/did not match/);
  });
});
