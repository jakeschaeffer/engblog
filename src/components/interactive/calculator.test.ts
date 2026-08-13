import { describe, expect, it } from 'vitest';

import {
  DAYS_PER_MONTH,
  RPS_DEFAULT,
  RPS_MAX,
  RPS_MIN,
  RPS_STEP,
  SECONDS_PER_DAY,
  clampRequestsPerSecond,
  estimateThroughput,
  formatCount,
  isOutOfRange,
  requestsPerDay,
  requestsPerMonth,
} from './calculator';

describe('constants', () => {
  it('define a usable, ordered range', () => {
    expect(RPS_MIN).toBeLessThan(RPS_MAX);
    expect(RPS_STEP).toBeGreaterThan(0);
    expect(RPS_DEFAULT).toBeGreaterThanOrEqual(RPS_MIN);
    expect(RPS_DEFAULT).toBeLessThanOrEqual(RPS_MAX);
  });
});

describe('requestsPerDay', () => {
  it('converts a sustained rate to a daily total', () => {
    expect(requestsPerDay(1)).toBe(SECONDS_PER_DAY);
    expect(requestsPerDay(250)).toBe(250 * 86_400);
  });

  it('is linear in the input rate', () => {
    expect(requestsPerDay(200)).toBe(requestsPerDay(100) * 2);
  });
});

describe('requestsPerMonth', () => {
  it('is the daily total over a 30-day month', () => {
    expect(requestsPerMonth(10)).toBe(requestsPerDay(10) * DAYS_PER_MONTH);
    expect(requestsPerMonth(1)).toBe(2_592_000);
  });
});

describe('clampRequestsPerSecond — boundaries', () => {
  it('passes the minimum through unchanged', () => {
    expect(clampRequestsPerSecond(RPS_MIN)).toBe(RPS_MIN);
  });

  it('passes the maximum through unchanged', () => {
    expect(clampRequestsPerSecond(RPS_MAX)).toBe(RPS_MAX);
  });

  it('passes an ordinary in-range value through unchanged', () => {
    expect(clampRequestsPerSecond(RPS_DEFAULT)).toBe(RPS_DEFAULT);
  });
});

describe('clampRequestsPerSecond — out of range', () => {
  it('clamps below the minimum up to the minimum', () => {
    expect(clampRequestsPerSecond(0)).toBe(RPS_MIN);
    expect(clampRequestsPerSecond(-5_000)).toBe(RPS_MIN);
  });

  it('clamps above the maximum down to the maximum', () => {
    expect(clampRequestsPerSecond(RPS_MAX + 1)).toBe(RPS_MAX);
    expect(clampRequestsPerSecond(9_999_999)).toBe(RPS_MAX);
  });

  it('rounds to the nearest step before clamping', () => {
    expect(clampRequestsPerSecond(250.4)).toBe(250);
    expect(clampRequestsPerSecond(250.6)).toBe(251);
  });

  it('never rounds its way past the ceiling', () => {
    expect(clampRequestsPerSecond(RPS_MAX - 0.4)).toBe(RPS_MAX);
    expect(clampRequestsPerSecond(RPS_MAX + 0.4)).toBe(RPS_MAX);
  });
});

describe('clampRequestsPerSecond — non-finite input', () => {
  it('falls back to the default for NaN', () => {
    expect(clampRequestsPerSecond(Number.NaN)).toBe(RPS_DEFAULT);
  });

  it('falls back to the default for infinities', () => {
    expect(clampRequestsPerSecond(Number.POSITIVE_INFINITY)).toBe(RPS_DEFAULT);
    expect(clampRequestsPerSecond(Number.NEGATIVE_INFINITY)).toBe(RPS_DEFAULT);
  });

  it('falls back to the default for a value parsed from empty text', () => {
    // `Number('')` is 0, but `Number('abc')` is NaN — the number field can
    // produce either while the reader is typing.
    expect(clampRequestsPerSecond(Number('abc'))).toBe(RPS_DEFAULT);
    expect(clampRequestsPerSecond(Number(''))).toBe(RPS_MIN);
  });

  it('always returns a finite number in range', () => {
    for (const input of [Number.NaN, -1, 0, RPS_MIN, RPS_DEFAULT, RPS_MAX, 1e12]) {
      const result = clampRequestsPerSecond(input);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(RPS_MIN);
      expect(result).toBeLessThanOrEqual(RPS_MAX);
    }
  });
});

describe('isOutOfRange', () => {
  it('is false inside the range, including at both boundaries', () => {
    expect(isOutOfRange(RPS_MIN)).toBe(false);
    expect(isOutOfRange(RPS_MAX)).toBe(false);
    expect(isOutOfRange(RPS_DEFAULT)).toBe(false);
  });

  it('is true outside the range and for non-finite input', () => {
    expect(isOutOfRange(RPS_MIN - 1)).toBe(true);
    expect(isOutOfRange(RPS_MAX + 1)).toBe(true);
    expect(isOutOfRange(Number.NaN)).toBe(true);
  });
});

describe('formatCount', () => {
  it('groups a large number with the pinned en-US locale', () => {
    expect(formatCount(1_234_567)).toBe('1,234,567');
    expect(formatCount(864_000_000)).toBe('864,000,000');
  });

  it('leaves small numbers ungrouped', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(250)).toBe('250');
  });

  it('renders whole numbers only', () => {
    expect(formatCount(1_234.56)).toBe('1,235');
  });

  it('degrades non-finite input to an em dash', () => {
    expect(formatCount(Number.NaN)).toBe('—');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('estimateThroughput', () => {
  it('reports the clamped rate and both derived figures', () => {
    const estimate = estimateThroughput(100);
    expect(estimate.requestsPerSecond).toBe(100);
    expect(estimate.perDay).toBe(8_640_000);
    expect(estimate.perMonth).toBe(259_200_000);
    expect(estimate.wasClamped).toBe(false);
  });

  it('formats every figure with the pinned locale', () => {
    const estimate = estimateThroughput(100);
    expect(estimate.requestsPerSecondLabel).toBe('100');
    expect(estimate.perDayLabel).toBe('8,640,000');
    expect(estimate.perMonthLabel).toBe('259,200,000');
  });

  it('flags a clamped input and still returns usable figures', () => {
    const estimate = estimateThroughput(RPS_MAX * 10);
    expect(estimate.wasClamped).toBe(true);
    expect(estimate.requestsPerSecond).toBe(RPS_MAX);
    expect(estimate.perDay).toBe(RPS_MAX * SECONDS_PER_DAY);
  });

  it('flags non-finite input and falls back to the default', () => {
    const estimate = estimateThroughput(Number.NaN);
    expect(estimate.wasClamped).toBe(true);
    expect(estimate.requestsPerSecond).toBe(RPS_DEFAULT);
    expect(estimate.perDayLabel).toBe(formatCount(RPS_DEFAULT * SECONDS_PER_DAY));
  });

  it('agrees with the standalone conversion helpers', () => {
    const estimate = estimateThroughput(RPS_DEFAULT);
    expect(estimate.perDay).toBe(requestsPerDay(RPS_DEFAULT));
    expect(estimate.perMonth).toBe(requestsPerMonth(RPS_DEFAULT));
  });

  it('is deterministic — the same input always yields the same output', () => {
    expect(estimateThroughput(777)).toEqual(estimateThroughput(777));
  });
});
