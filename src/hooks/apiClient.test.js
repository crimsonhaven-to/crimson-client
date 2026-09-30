import { describe, it, expect } from 'vitest';

import { extractError } from './apiClient';

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

  // api.py's http_exception_handler rewrites raised errors into
  // {success, error, message}; `detail` only survives on FastAPI's own 422s.
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
