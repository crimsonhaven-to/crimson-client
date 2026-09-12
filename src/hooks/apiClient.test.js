import { describe, it, expect } from 'vitest';

import { extractError } from './apiClient';

// extractError normalises a FastAPI error body into one human-readable string.
// `detail` can be a plain string, or an array of validation errors on a 422.
describe('extractError', () => {
  it('returns a string detail verbatim', () => {
    expect(extractError({ detail: 'Invite code required' })).toBe('Invite code required');
  });

  it('pulls the first message out of a 422 validation array', () => {
    expect(extractError({ detail: [{ msg: 'field required' }, { msg: 'ignored' }] }))
      .toBe('field required');
  });

  it('falls back when the array entry has no msg', () => {
    expect(extractError({ detail: [{}] }, 'Registration failed')).toBe('Registration failed');
  });

  it('uses the default fallback when there is no detail', () => {
    expect(extractError({})).toBe('Something went wrong');
    expect(extractError(null, 'Custom fallback')).toBe('Custom fallback');
  });

  // The backend rewrites everything it raises as an HTTPException into
  // {success, error, message} (api.py's http_exception_handler), so `detail` is
  // only present on FastAPI's own 422s. Reading just `detail` meant every raised
  // error reached the user as the generic fallback.
  it('reads the raised-error shape the backend actually sends', () => {
    expect(extractError({ success: false, error: 'Password is incorrect', status_code: 401 }))
      .toBe('Password is incorrect');
  });

  it('still prefers detail when both are present', () => {
    expect(extractError({ detail: 'from detail', error: 'from error' })).toBe('from detail');
  });

  it('falls back when error is present but empty', () => {
    expect(extractError({ success: false, error: '' }, 'Deletion failed')).toBe('Deletion failed');
  });
});
