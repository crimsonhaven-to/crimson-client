import { describe, it, expect } from 'vitest';

import { deviceLabel, eventLabel, when } from './securityFormat';

describe('deviceLabel', () => {
  it('names a session so its owner can recognise it', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36'))
      .toBe('Chrome on Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile Safari/604.1'))
      .toBe('Safari on iOS');
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64) Firefox/135.0'))
      .toBe('Firefox on Linux');
  });

  it('picks the specific browser when several tokens are present', () => {
    // Edge and Opera both claim Chrome, and Chrome claims Safari. A label that
    // says "Chrome" for every Edge session makes the list useless for spotting
    // the one device that is not yours.
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36 Edg/140.0'))
      .toBe('Edge on Windows');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36 OPR/118.0'))
      .toBe('Opera on Windows');
  });

  it('reads a session with no user agent as an unknown device, never as nothing', () => {
    // Rows predating the device columns carry NULLs, and that is exactly the
    // session a user most needs to see in the list.
    expect(deviceLabel(null)).toBe('Unknown device');
    expect(deviceLabel('')).toBe('Unknown device');
    expect(deviceLabel(undefined)).toBe('Unknown device');
  });

  it('still says something for an agent it cannot place', () => {
    expect(deviceLabel('curl/8.7.1')).toBe('Browser on Unknown platform');
  });
});

describe('eventLabel', () => {
  it('reads the known types in plain words', () => {
    expect(eventLabel('login_success')).toBe('Signed in');
    expect(eventLabel('account_delete_failed')).toBe('Failed attempt to delete this account');
  });

  it('shows an unknown type rather than hiding it', () => {
    // The server owns the whitelist. If it starts sending a type this build has
    // no label for, the event must still appear: a security feed that silently
    // drops entries is worse than one with an ugly label.
    expect(eventLabel('some_new_event')).toBe('some new event');
  });

  it('survives a missing type', () => {
    expect(eventLabel(undefined)).toBe('');
    expect(eventLabel(null)).toBe('');
  });
});

describe('when', () => {
  const now = Date.UTC(2026, 5, 10, 12, 0, 0);

  it('describes recent moments in relative terms', () => {
    expect(when('2026-06-10T11:59:30Z', now)).toBe('just now');
    expect(when('2026-06-10T11:30:00Z', now)).toBe('30m ago');
    expect(when('2026-06-10T06:00:00Z', now)).toBe('6h ago');
    expect(when('2026-06-05T12:00:00Z', now)).toBe('5d ago');
  });

  it('falls back to a date once relative time stops meaning anything', () => {
    expect(when('2025-01-05T12:00:00Z', now)).not.toMatch(/ago/);
  });

  it('says never for a session that has not been used since it was made', () => {
    expect(when(null, now)).toBe('never');
  });

  it('does not report a clock-skewed future timestamp as a negative age', () => {
    expect(when('2026-06-10T13:00:00Z', now)).toBe('just now');
  });

  it('says unknown for an unparseable timestamp', () => {
    expect(when('nonsense', now)).toBe('unknown');
  });
});
