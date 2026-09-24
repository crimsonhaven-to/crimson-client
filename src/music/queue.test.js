import { describe, expect, it } from 'vitest';

import {
  REPEAT_ALL, REPEAT_OFF, REPEAT_ONE, cycleRepeat, formatTime, identityOrder, nextPosition,
  previousPosition, shuffledOrder,
} from './queue';

describe('nextPosition', () => {
  it('walks forward and stops at the end with repeat off', () => {
    expect(nextPosition(0, 3, REPEAT_OFF)).toBe(1);
    expect(nextPosition(2, 3, REPEAT_OFF)).toBe(-1);
  });

  it('wraps with repeat all', () => {
    expect(nextPosition(2, 3, REPEAT_ALL)).toBe(0);
  });

  it('repeats one track on its own end, but a press of next still moves on', () => {
    expect(nextPosition(1, 3, REPEAT_ONE)).toBe(1);
    expect(nextPosition(1, 3, REPEAT_ONE, true)).toBe(2);
  });

  it('has nowhere to go in an empty queue', () => {
    expect(nextPosition(0, 0, REPEAT_ALL)).toBe(-1);
  });
});

describe('previousPosition', () => {
  it('restarts the track after a few seconds, steps back before that', () => {
    expect(previousPosition(2, 3, 10, REPEAT_OFF)).toBe(2);
    expect(previousPosition(2, 3, 1, REPEAT_OFF)).toBe(1);
  });

  it('stays on the first track, or wraps with repeat all', () => {
    expect(previousPosition(0, 3, 0, REPEAT_OFF)).toBe(0);
    expect(previousPosition(0, 3, 0, REPEAT_ALL)).toBe(2);
  });
});

describe('shuffledOrder', () => {
  it('is a permutation that starts with the current track', () => {
    const order = shuffledOrder(20, 7, () => 0.42);
    expect(order[0]).toBe(7);
    expect([...order].sort((a, b) => a - b)).toEqual(identityOrder(20));
  });

  it('shuffles everything when nothing is playing', () => {
    expect(shuffledOrder(5, -1).length).toBe(5);
  });
});

describe('cycleRepeat and formatTime', () => {
  it('cycles off, all, one', () => {
    expect(cycleRepeat(REPEAT_OFF)).toBe(REPEAT_ALL);
    expect(cycleRepeat(REPEAT_ALL)).toBe(REPEAT_ONE);
    expect(cycleRepeat(REPEAT_ONE)).toBe(REPEAT_OFF);
  });

  it('formats seconds, hours and junk', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(202.4)).toBe('3:22');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
