import { describe, expect, it } from 'vitest';
import { MESSAGE, checkOrder, scoreFor, seededShuffle, split, starsFor } from './reassemble';

describe('reassemble challenge', () => {
  const pkts = split(MESSAGE);
  it('splits the message into numbered packets that rebuild it', () => {
    expect(pkts).toHaveLength(4);
    expect(pkts.map((p) => p.payload).join('')).toBe(MESSAGE);
  });
  it('shuffle is deterministic and never the original order', () => {
    const a = seededShuffle(pkts), b = seededShuffle(pkts);
    expect(a).toEqual(b);
    expect(checkOrder(a, pkts).correct).toBe(false);
  });
  it('validates answers and reports wrong positions', () => {
    expect(checkOrder(pkts, pkts).correct).toBe(true);
    const swapped = [pkts[1], pkts[0], pkts[2], pkts[3]];
    expect(checkOrder(swapped, pkts)).toEqual({ correct: false, wrongPositions: [1, 2] });
  });
  it('awards fewer points for retries', () => {
    expect([scoreFor(1), scoreFor(2), scoreFor(9)]).toEqual([100, 75, 25]);
    expect([starsFor(100), starsFor(75), starsFor(25)]).toEqual([3, 2, 1]);
  });
});
