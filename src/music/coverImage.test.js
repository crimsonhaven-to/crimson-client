import { describe, expect, it } from 'vitest';

import { fitWithin } from './coverImage';

describe('fitWithin', () => {
  it('shrinks the longer side to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 640)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(1080, 1920, 640)).toEqual({ width: 360, height: 640 });
  });

  it('never enlarges a small picture', () => {
    expect(fitWithin(300, 200, 640)).toEqual({ width: 300, height: 200 });
  });
});
