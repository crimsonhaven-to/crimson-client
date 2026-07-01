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
});
