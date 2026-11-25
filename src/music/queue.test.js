import { describe, expect, it } from 'vitest';

import {
  REPEAT_ALL, REPEAT_OFF, REPEAT_ONE, cycleRepeat, formatTime, identityOrder, nextPosition,
  previousPosition, queueInsert, reorder, shuffledOrder, upcomingPositions,
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

describe('upcomingPositions', () => {
  it('lists what plays next and stops at the end with repeat off', () => {
    expect(upcomingPositions(0, 5, REPEAT_OFF, 3)).toEqual([1, 2, 3]);
    expect(upcomingPositions(3, 5, REPEAT_OFF, 3)).toEqual([4]);
  });

  it('wraps with repeat, and never lists the current track again', () => {
    expect(upcomingPositions(3, 5, REPEAT_ALL, 3)).toEqual([4, 0, 1]);
    expect(upcomingPositions(1, 3, REPEAT_ONE, 10)).toEqual([2, 0]);
  });

  it('is empty for a count of zero or a single track', () => {
    expect(upcomingPositions(0, 5, REPEAT_ALL, 0)).toEqual([]);
    expect(upcomingPositions(0, 1, REPEAT_ALL, 3)).toEqual([]);
  });
});

describe('queueInsert', () => {
  it('plays a queued song right after the current one', () => {
    expect(queueInsert([0, 1, 2, 3], 1, 0, [4])).toEqual({ order: [0, 1, 4, 2, 3], queueEnd: 3 });
  });

  it('keeps queued songs in the order they were added', () => {
    const first = queueInsert([0, 1, 2], 0, 0, [3]);
    const second = queueInsert(first.order, 0, first.queueEnd, [4, 5]);
    expect(second).toEqual({ order: [0, 3, 4, 5, 1, 2], queueEnd: 4 });
  });

  it('starts a fresh queue once the queued songs have played', () => {
    // Playing position 3, the queue ended at 2.
    expect(queueInsert([0, 1, 2, 3, 4], 3, 2, [5])).toEqual({ order: [0, 1, 2, 3, 5, 4], queueEnd: 5 });
  });
});

describe('reorder', () => {
  const noShuffle = () => 0;

  it('keeps the current song first and the queued songs behind it when shuffling', () => {
    // Playing track 1, tracks 4 and 5 queued after it.
    const { order, position, queueEnd } = reorder([0, 1, 4, 5, 2, 3], 1, 4, true, noShuffle);
    expect(order.slice(0, 3)).toEqual([1, 4, 5]);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect({ position, queueEnd }).toEqual({ position: 0, queueEnd: 3 });
  });

  it('goes back to list order around the current song, queue intact', () => {
    const { order, position, queueEnd } = reorder([2, 4, 0, 3, 1], 0, 2, false);
    expect(order).toEqual([0, 1, 2, 4, 3]);
    expect({ position, queueEnd }).toEqual({ position: 2, queueEnd: 4 });
  });

  it('marks no queue when nothing was queued', () => {
    expect(reorder([0, 1, 2], 1, 0, false)).toEqual({ order: [0, 1, 2], position: 1, queueEnd: 0 });
  });
});
