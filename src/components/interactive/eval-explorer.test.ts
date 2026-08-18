import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  CLASSIFIER_STAGE,
  CLIPS_PER_SUBSCRIBER_DEFAULT,
  CLIPS_PER_SUBSCRIBER_MAX,
  CLIPS_PER_SUBSCRIBER_MIN,
  CLIPS_PER_SUBSCRIBER_STEP,
  DEFAULT_DETAIL_ITEM_ID,
  EM_DASH,
  ITEM_ID_PREFIX,
  MOCK_ITEMS,
  SCORED_CATEGORIES,
  VIDEO_PATH_PREFIX,
  buildMetricRows,
  categoryMetrics,
  clampClipsPerSubscriber,
  confusionFor,
  describeDot,
  describeItemDetail,
  falsePositiveRateOf,
  findItem,
  formatMicroUsd,
  formatPercent,
  formatPreciseSeconds,
  formatSeconds,
  formatUsd,
  groupByPrediction,
  hasActivity,
  indexOfItem,
  isClipVolumeOutOfRange,
  isCorrect,
  mean,
  meanOfDefined,
  nextDotIndex,
  overallMetrics,
  precisionOf,
  projectCostPerSubscriber,
  recallOf,
} from './eval-explorer';
import type { Category, EvalItem } from './eval-explorer';

/**
 * A synthetic clip, for the cases the mock run deliberately does not contain
 * (an empty run, a category nobody predicted, a clip with no objects).
 */
function makeItem(overrides: Partial<EvalItem> & Pick<EvalItem, 'predicted' | 'actual'>): EvalItem {
  return {
    id: 'evt-mock-9999',
    latencySeconds: 2,
    confidence: 0.5,
    costUsd: 0.001,
    caption: 'A synthetic clip.',
    objects: [],
    videoPath: 's3://rosie-mock-videos/eval-ui-mockup/9999.mp4',
    ...overrides,
  };
}

/** The correct/incorrect pattern the post's dot field is supposed to show. */
const EXPECTED_PATTERN: ReadonlyMap<Category, readonly boolean[]> = new Map([
  ['Person', [true, true, true, true, true, false]],
  ['Vehicle', [true, true, true, true, true, true, false, true, true, true]],
  ['Animal', [true, true, false]],
  ['None', [false, true, true, true, false, true, true, true, true, true]],
]);

describe('the mock run', () => {
  it('has 29 clips', () => {
    expect(MOCK_ITEMS).toHaveLength(29);
  });

  it('gives every clip a unique, obviously fake, sequential id', () => {
    const ids = MOCK_ITEMS.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(`${ITEM_ID_PREFIX}0001`);
    expect(ids[28]).toBe(`${ITEM_ID_PREFIX}0029`);
    for (const id of ids) expect(id.startsWith(ITEM_ID_PREFIX)).toBe(true);
  });

  it('derives each clip path from its id, so the two cannot drift', () => {
    for (const item of MOCK_ITEMS) {
      const sequence = item.id.slice(ITEM_ID_PREFIX.length);
      expect(item.videoPath).toBe(`${VIDEO_PATH_PREFIX}${sequence}.mp4`);
    }
  });

  it('keeps every confidence, latency and cost in a plausible range', () => {
    for (const item of MOCK_ITEMS) {
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
      expect(item.latencySeconds).toBeGreaterThan(0);
      expect(item.costUsd).toBeGreaterThan(0);
      expect(item.caption.length).toBeGreaterThan(0);
    }
  });

  it('is already ordered by predicted category, which the dot field relies on', () => {
    const order = MOCK_ITEMS.map((item) => CATEGORIES.indexOf(item.predicted));
    expect(order).toStrictEqual([...order].sort((a, b) => a - b));
  });

  it('reproduces the exact correct/incorrect pattern the post describes', () => {
    for (const group of groupByPrediction(MOCK_ITEMS)) {
      expect(group.items.map(isCorrect)).toStrictEqual(EXPECTED_PATTERN.get(group.category));
    }
  });

  it('gets 24 of 29 right, with the five failures spread across all four groups', () => {
    expect(MOCK_ITEMS.filter(isCorrect)).toHaveLength(24);
    expect(MOCK_ITEMS.filter((item) => !isCorrect(item))).toHaveLength(5);
  });

  it('opens on a clip that exists, and on a wrong one', () => {
    const item = findItem(MOCK_ITEMS, DEFAULT_DETAIL_ITEM_ID);

    expect(item).toBeDefined();
    expect(item === undefined ? true : isCorrect(item)).toBe(false);
  });

  it('costs more to classify a clip with activity than an empty one', () => {
    const overall = overallMetrics(MOCK_ITEMS);
    expect(overall.meanCostWithActivityUsd).toBeGreaterThan(overall.meanCostWithoutActivityUsd);
  });
});

describe('isCorrect and hasActivity', () => {
  it('call a prediction correct when it matches the ground truth', () => {
    expect(isCorrect(makeItem({ predicted: 'Person', actual: 'Person' }))).toBe(true);
    expect(isCorrect(makeItem({ predicted: 'Person', actual: 'Animal' }))).toBe(false);
  });

  it('treats a None ground truth, and only that, as no activity', () => {
    expect(hasActivity(makeItem({ predicted: 'None', actual: 'None' }))).toBe(false);
    expect(hasActivity(makeItem({ predicted: 'None', actual: 'Person' }))).toBe(true);
    expect(hasActivity(makeItem({ predicted: 'Vehicle', actual: 'Vehicle' }))).toBe(true);
  });
});

describe('mean', () => {
  it('averages a list of numbers', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([4])).toBe(4);
  });

  it('is NaN for an empty list rather than 0', () => {
    // 0 would render as a real figure; NaN renders as an em dash.
    expect(Number.isNaN(mean([]))).toBe(true);
  });
});

describe('meanOfDefined', () => {
  it('ignores undefined values', () => {
    expect(meanOfDefined([1, Number.NaN, 3])).toBe(2);
  });

  it('is NaN when nothing is defined', () => {
    expect(Number.isNaN(meanOfDefined([Number.NaN, Number.POSITIVE_INFINITY]))).toBe(true);
    expect(Number.isNaN(meanOfDefined([]))).toBe(true);
  });
});

describe('confusionFor', () => {
  it('counts the four cells one-vs-rest', () => {
    const items = [
      makeItem({ predicted: 'Person', actual: 'Person' }),
      makeItem({ predicted: 'Person', actual: 'Animal' }),
      makeItem({ predicted: 'None', actual: 'Person' }),
      makeItem({ predicted: 'Vehicle', actual: 'Vehicle' }),
    ];

    expect(confusionFor(items, 'Person')).toStrictEqual({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 1,
      trueNegatives: 1,
    });
  });

  it('always accounts for every clip exactly once', () => {
    for (const category of CATEGORIES) {
      const confusion = confusionFor(MOCK_ITEMS, category);
      const total =
        confusion.truePositives +
        confusion.falsePositives +
        confusion.falseNegatives +
        confusion.trueNegatives;
      expect(total).toBe(MOCK_ITEMS.length);
    }
  });

  it('matches the mock run by hand for Person', () => {
    expect(confusionFor(MOCK_ITEMS, 'Person')).toStrictEqual({
      truePositives: 5,
      falsePositives: 1,
      falseNegatives: 2,
      trueNegatives: 21,
    });
  });

  it('is all zeroes except true negatives for a category nobody used', () => {
    const items = [makeItem({ predicted: 'None', actual: 'None' })];

    expect(confusionFor(items, 'Animal')).toStrictEqual({
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 1,
    });
  });
});

describe('precisionOf, recallOf and falsePositiveRateOf', () => {
  it('compute the textbook ratios', () => {
    const confusion = {
      truePositives: 3,
      falsePositives: 1,
      falseNegatives: 1,
      trueNegatives: 5,
    };

    expect(precisionOf(confusion)).toBe(0.75);
    expect(recallOf(confusion)).toBe(0.75);
    expect(falsePositiveRateOf(confusion)).toBeCloseTo(1 / 6, 10);
  });

  it('are NaN, not zero, when the denominator is empty', () => {
    const nothingPredicted = {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 2,
      trueNegatives: 5,
    };
    const nothingActual = {
      truePositives: 0,
      falsePositives: 2,
      falseNegatives: 0,
      trueNegatives: 5,
    };
    const everythingPositive = {
      truePositives: 3,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0,
    };

    expect(Number.isNaN(precisionOf(nothingPredicted))).toBe(true);
    expect(Number.isNaN(recallOf(nothingActual))).toBe(true);
    expect(Number.isNaN(falsePositiveRateOf(everythingPositive))).toBe(true);
  });

  it('are 1 for a perfect category and 0 for a category it always gets wrong', () => {
    expect(
      precisionOf({ truePositives: 4, falsePositives: 0, falseNegatives: 0, trueNegatives: 2 }),
    ).toBe(1);
    expect(
      recallOf({ truePositives: 0, falsePositives: 0, falseNegatives: 4, trueNegatives: 2 }),
    ).toBe(0);
  });
});

describe('categoryMetrics', () => {
  it('reports the mock run figures for each detection category', () => {
    const person = categoryMetrics(MOCK_ITEMS, 'Person');
    const vehicle = categoryMetrics(MOCK_ITEMS, 'Vehicle');
    const animal = categoryMetrics(MOCK_ITEMS, 'Animal');

    expect(person.predictedCount).toBe(6);
    expect(person.correctCount).toBe(5);
    expect(person.incorrectCount).toBe(1);
    expect(person.precision).toBeCloseTo(5 / 6, 10);
    expect(person.recall).toBeCloseTo(5 / 7, 10);
    expect(person.falsePositiveRate).toBeCloseTo(1 / 22, 10);

    expect(vehicle.predictedCount).toBe(10);
    expect(vehicle.precision).toBeCloseTo(0.9, 10);
    expect(vehicle.recall).toBeCloseTo(0.9, 10);

    expect(animal.predictedCount).toBe(3);
    expect(animal.precision).toBeCloseTo(2 / 3, 10);
    expect(animal.recall).toBeCloseTo(2 / 3, 10);
  });

  it('averages latency and cost over the clips the model put in the group', () => {
    const items = [
      makeItem({ predicted: 'Person', actual: 'Person', latencySeconds: 1, costUsd: 0.002 }),
      makeItem({ predicted: 'Person', actual: 'Animal', latencySeconds: 3, costUsd: 0.004 }),
      makeItem({ predicted: 'None', actual: 'None', latencySeconds: 9, costUsd: 0.009 }),
    ];
    const person = categoryMetrics(items, 'Person');

    expect(person.meanLatencySeconds).toBe(2);
    expect(person.meanCostUsd).toBe(0.003);
  });

  it('splits the run cost into shares that add up to one', () => {
    const total = CATEGORIES.map(
      (category) => categoryMetrics(MOCK_ITEMS, category).costShare,
    ).reduce((sum, share) => sum + share, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it('degrades to NaN for a category with no predictions instead of inventing a zero', () => {
    const items = [makeItem({ predicted: 'None', actual: 'None' })];
    const animal = categoryMetrics(items, 'Animal');

    expect(animal.predictedCount).toBe(0);
    expect(Number.isNaN(animal.precision)).toBe(true);
    expect(Number.isNaN(animal.recall)).toBe(true);
    expect(Number.isNaN(animal.meanLatencySeconds)).toBe(true);
    expect(Number.isNaN(animal.meanCostUsd)).toBe(true);
  });
});

describe('overallMetrics', () => {
  it('macro-averages the three detection categories, ignoring None', () => {
    const overall = overallMetrics(MOCK_ITEMS);
    const scored = SCORED_CATEGORIES.map((category) => categoryMetrics(MOCK_ITEMS, category));

    expect(overall.precision).toBeCloseTo(
      scored.reduce((sum, metrics) => sum + metrics.precision, 0) / scored.length,
      10,
    );
    expect(overall.recall).toBeCloseTo(
      scored.reduce((sum, metrics) => sum + metrics.recall, 0) / scored.length,
      10,
    );
    expect(overall.falsePositiveRate).toBeCloseTo(
      scored.reduce((sum, metrics) => sum + metrics.falsePositiveRate, 0) / scored.length,
      10,
    );
  });

  it('is not the same as a micro average — a small bad category still counts', () => {
    // Animal is 3 clips of 29. Micro-averaging would bury it; macro does not.
    const overall = overallMetrics(MOCK_ITEMS);
    const correctFraction = overall.correctCount / overall.itemCount;

    expect(correctFraction).toBeGreaterThan(overall.precision);
  });

  it('counts every clip once as correct or incorrect', () => {
    const overall = overallMetrics(MOCK_ITEMS);
    expect(overall.correctCount + overall.incorrectCount).toBe(overall.itemCount);
  });

  it('averages latency and cost across the whole run', () => {
    const overall = overallMetrics(MOCK_ITEMS);

    expect(overall.meanLatencySeconds).toBeCloseTo(
      mean(MOCK_ITEMS.map((item) => item.latencySeconds)),
      10,
    );
    expect(overall.meanCostUsd).toBeCloseTo(mean(MOCK_ITEMS.map((item) => item.costUsd)), 10);
  });

  it('splits cost by whether the clip contained anything', () => {
    const overall = overallMetrics(MOCK_ITEMS);
    const withActivity = MOCK_ITEMS.filter(hasActivity);
    const withoutActivity = MOCK_ITEMS.filter((item) => !hasActivity(item));

    expect(withActivity).toHaveLength(20);
    expect(withoutActivity).toHaveLength(9);
    expect(overall.meanCostWithActivityUsd).toBeCloseTo(
      mean(withActivity.map((item) => item.costUsd)),
      10,
    );
    expect(overall.meanCostWithoutActivityUsd).toBeCloseTo(
      mean(withoutActivity.map((item) => item.costUsd)),
      10,
    );
  });

  it('degrades to NaN across the board for an empty run', () => {
    const overall = overallMetrics([]);

    expect(overall.itemCount).toBe(0);
    expect(Number.isNaN(overall.precision)).toBe(true);
    expect(Number.isNaN(overall.recall)).toBe(true);
    expect(Number.isNaN(overall.meanLatencySeconds)).toBe(true);
    expect(Number.isNaN(overall.meanCostUsd)).toBe(true);
  });

  it('drops an undefined category from the macro average rather than poisoning it', () => {
    const items = [
      makeItem({ predicted: 'Person', actual: 'Person' }),
      makeItem({ predicted: 'Vehicle', actual: 'Vehicle' }),
    ];
    // Nothing predicted or labelled Animal, so its precision is undefined.
    const overall = overallMetrics(items);

    expect(overall.precision).toBe(1);
  });
});

describe('formatters', () => {
  it('render a rate as a percentage with one decimal', () => {
    expect(formatPercent(0.7536)).toBe('75.4%');
    expect(formatPercent(1)).toBe('100.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('render latency in seconds, at summary and per-clip precision', () => {
    expect(formatSeconds(2.34)).toBe('2.3s');
    expect(formatSeconds(2)).toBe('2.0s');
    expect(formatPreciseSeconds(2.55)).toBe('2.55s');
  });

  it('render money at cents for a projection and at four places for a clip', () => {
    expect(formatUsd(4.4832)).toBe('$4.48');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatMicroUsd(0.002_379)).toBe('$0.0024');
    expect(formatMicroUsd(0.0009)).toBe('$0.0009');
  });

  it('degrade every undefined figure to the same em dash', () => {
    for (const format of [
      formatPercent,
      formatSeconds,
      formatPreciseSeconds,
      formatUsd,
      formatMicroUsd,
    ]) {
      expect(format(Number.NaN)).toBe(EM_DASH);
      expect(format(Number.POSITIVE_INFINITY)).toBe(EM_DASH);
      expect(format(Number.NEGATIVE_INFINITY)).toBe(EM_DASH);
    }
  });

  it('never emit a locale-dependent separator, whatever the host LANG is', () => {
    // The formatters pin en-US, so a decimal point is a point and a group
    // separator is a comma. A comma decimal here would mean a hydration
    // mismatch on a machine with a European locale.
    expect(formatPercent(0.5)).toBe('50.0%');
    expect(formatUsd(1_234.5)).toBe('$1,234.50');
  });
});

describe('clampClipsPerSubscriber', () => {
  it('passes legal values through unchanged', () => {
    expect(clampClipsPerSubscriber(CLIPS_PER_SUBSCRIBER_MIN)).toBe(CLIPS_PER_SUBSCRIBER_MIN);
    expect(clampClipsPerSubscriber(CLIPS_PER_SUBSCRIBER_MAX)).toBe(CLIPS_PER_SUBSCRIBER_MAX);
    expect(clampClipsPerSubscriber(CLIPS_PER_SUBSCRIBER_DEFAULT)).toBe(
      CLIPS_PER_SUBSCRIBER_DEFAULT,
    );
  });

  it('clamps out-of-range values to the nearest boundary', () => {
    expect(clampClipsPerSubscriber(0)).toBe(CLIPS_PER_SUBSCRIBER_MIN);
    expect(clampClipsPerSubscriber(-10_000)).toBe(CLIPS_PER_SUBSCRIBER_MIN);
    expect(clampClipsPerSubscriber(9_999_999)).toBe(CLIPS_PER_SUBSCRIBER_MAX);
  });

  it('rounds to the step before clamping, and never rounds past the ceiling', () => {
    expect(clampClipsPerSubscriber(1_524)).toBe(CLIPS_PER_SUBSCRIBER_DEFAULT);
    expect(clampClipsPerSubscriber(1_526)).toBe(1_550);
    expect(clampClipsPerSubscriber(CLIPS_PER_SUBSCRIBER_MAX - 1)).toBe(CLIPS_PER_SUBSCRIBER_MAX);
    expect(clampClipsPerSubscriber(CLIPS_PER_SUBSCRIBER_MAX + 1)).toBe(CLIPS_PER_SUBSCRIBER_MAX);
  });

  it('falls back to the default for a value that is not a number', () => {
    expect(clampClipsPerSubscriber(Number.NaN)).toBe(CLIPS_PER_SUBSCRIBER_DEFAULT);
    expect(clampClipsPerSubscriber(Number('abc'))).toBe(CLIPS_PER_SUBSCRIBER_DEFAULT);
    expect(clampClipsPerSubscriber(Number.POSITIVE_INFINITY)).toBe(CLIPS_PER_SUBSCRIBER_DEFAULT);
  });

  it('always returns a legal value on the step grid', () => {
    for (const input of [Number.NaN, -1, 0, 137, 1_500, 4_999, 1e12]) {
      const result = clampClipsPerSubscriber(input);

      expect(result).toBeGreaterThanOrEqual(CLIPS_PER_SUBSCRIBER_MIN);
      expect(result).toBeLessThanOrEqual(CLIPS_PER_SUBSCRIBER_MAX);
      expect(result % CLIPS_PER_SUBSCRIBER_STEP).toBe(0);
    }
  });
});

describe('isClipVolumeOutOfRange', () => {
  it('is false inside the range, including both boundaries', () => {
    expect(isClipVolumeOutOfRange(CLIPS_PER_SUBSCRIBER_MIN)).toBe(false);
    expect(isClipVolumeOutOfRange(CLIPS_PER_SUBSCRIBER_MAX)).toBe(false);
  });

  it('is true outside the range and for a non-number', () => {
    expect(isClipVolumeOutOfRange(CLIPS_PER_SUBSCRIBER_MIN - 1)).toBe(true);
    expect(isClipVolumeOutOfRange(CLIPS_PER_SUBSCRIBER_MAX + 1)).toBe(true);
    expect(isClipVolumeOutOfRange(Number.NaN)).toBe(true);
  });
});

describe('projectCostPerSubscriber', () => {
  it('multiplies mean clip cost by the monthly clip volume', () => {
    expect(projectCostPerSubscriber(0.002, 1_000)).toBeCloseTo(2, 10);
  });

  it('is linear in the volume', () => {
    const single = projectCostPerSubscriber(0.003, 1_000);
    const double = projectCostPerSubscriber(0.003, 2_000);

    expect(double).toBeCloseTo(single * 2, 10);
  });

  it('clamps the volume before projecting', () => {
    expect(projectCostPerSubscriber(0.002, 1e9)).toBeCloseTo(0.002 * CLIPS_PER_SUBSCRIBER_MAX, 10);
  });

  it('stays undefined when the cost is undefined', () => {
    expect(Number.isNaN(projectCostPerSubscriber(Number.NaN, 1_000))).toBe(true);
  });
});

describe('buildMetricRows', () => {
  const rows = buildMetricRows(MOCK_ITEMS, CLIPS_PER_SUBSCRIBER_DEFAULT);

  it('is the summary row followed by one row per detection category', () => {
    expect(rows.map((row) => row.label)).toStrictEqual(['Overall', 'Person', 'Vehicle', 'Animal']);
    expect(rows[0]?.isOverall).toBe(true);
    expect(rows.slice(1).every((row) => !row.isOverall)).toBe(true);
  });

  it('formats every cell as a display string, never a raw number', () => {
    for (const row of rows) {
      expect(row.precision.endsWith('%')).toBe(true);
      expect(row.recall.endsWith('%')).toBe(true);
      expect(row.falsePositiveRate.endsWith('%')).toBe(true);
      expect(row.latency.endsWith('s')).toBe(true);
      expect(row.meanCost.startsWith('$')).toBe(true);
      expect(row.costPerSubscriber.startsWith('$')).toBe(true);
    }
  });

  it('shows the activity cost split on the summary row only', () => {
    expect(rows[0]?.costWithActivity).toBe('$0.0030');
    expect(rows[0]?.costWithoutActivity).toBe('$0.0009');

    for (const row of rows.slice(1)) {
      expect(row.costWithActivity).toBe(EM_DASH);
      expect(row.costWithoutActivity).toBe(EM_DASH);
    }
  });

  it('reports the run figures the post quotes', () => {
    expect(rows[0]?.precision).toBe('80.0%');
    expect(rows[0]?.recall).toBe('76.0%');
    expect(rows[0]?.falsePositiveRate).toBe('4.6%');
    expect(rows[0]?.latency).toBe('2.1s');
    expect(rows[0]?.meanCost).toBe('$0.0024');
    expect(rows[0]?.costPerSubscriber).toBe('$3.57');
  });

  it('moves the projection, and only the projection, when the volume changes', () => {
    const doubled = buildMetricRows(MOCK_ITEMS, CLIPS_PER_SUBSCRIBER_DEFAULT * 2);

    expect(doubled[0]?.costPerSubscriber).toBe('$7.14');
    expect(doubled[0]?.precision).toBe(rows[0]?.precision);
    expect(doubled[0]?.latency).toBe(rows[0]?.latency);
  });

  it('clamps an illegal volume rather than rendering nonsense', () => {
    const clamped = buildMetricRows(MOCK_ITEMS, Number.NaN);
    expect(clamped[0]?.costPerSubscriber).toBe(rows[0]?.costPerSubscriber);
  });

  it('gives each category a slice of the projection, not a copy of it', () => {
    const slices = rows
      .slice(1)
      .map((row) => Number.parseFloat(row.costPerSubscriber.replace('$', '')));
    const overall = Number.parseFloat((rows[0]?.costPerSubscriber ?? '').replace('$', ''));
    const total = slices.reduce((sum, value) => sum + value, 0);

    for (const slice of slices) expect(slice).toBeLessThan(overall);
    // The three detection categories plus the unshown None group make the whole.
    expect(total).toBeLessThan(overall);
    expect(total).toBeGreaterThan(overall * 0.75);
  });

  it('degrades to em dashes end to end for an empty run', () => {
    const empty = buildMetricRows([], CLIPS_PER_SUBSCRIBER_DEFAULT);

    expect(empty[0]?.precision).toBe(EM_DASH);
    expect(empty[0]?.latency).toBe(EM_DASH);
    expect(empty[0]?.costPerSubscriber).toBe(EM_DASH);
  });
});

describe('groupByPrediction', () => {
  const groups = groupByPrediction(MOCK_ITEMS);

  it('returns one group per category, in display order', () => {
    expect(groups.map((group) => group.category)).toStrictEqual([...CATEGORIES]);
  });

  it('puts every clip in the group its prediction names', () => {
    for (const group of groups) {
      for (const item of group.items) expect(item.predicted).toBe(group.category);
    }
  });

  it('has the group sizes the dot field draws', () => {
    expect(groups.map((group) => group.items.length)).toStrictEqual([6, 10, 3, 10]);
  });

  it('numbers the groups so a flat index walks straight through them', () => {
    expect(groups.map((group) => group.startIndex)).toStrictEqual([0, 6, 16, 19]);

    for (const group of groups) {
      group.items.forEach((item, indexInGroup) => {
        expect(MOCK_ITEMS[group.startIndex + indexInGroup]).toBe(item);
      });
    }
  });

  it('concatenates back into the original run, which is what makes the indices safe', () => {
    expect(groups.flatMap((group) => [...group.items])).toStrictEqual([...MOCK_ITEMS]);
  });

  it('still returns four groups when some are empty', () => {
    const groupsOfOne = groupByPrediction([makeItem({ predicted: 'Vehicle', actual: 'Vehicle' })]);

    expect(groupsOfOne).toHaveLength(CATEGORIES.length);
    expect(groupsOfOne.map((group) => group.items.length)).toStrictEqual([0, 1, 0, 0]);
    expect(groupsOfOne.map((group) => group.startIndex)).toStrictEqual([0, 0, 1, 1]);
  });
});

describe('indexOfItem and findItem', () => {
  it('find a clip by id', () => {
    expect(indexOfItem(MOCK_ITEMS, `${ITEM_ID_PREFIX}0001`)).toBe(0);
    expect(indexOfItem(MOCK_ITEMS, `${ITEM_ID_PREFIX}0029`)).toBe(28);
    expect(findItem(MOCK_ITEMS, DEFAULT_DETAIL_ITEM_ID)?.id).toBe(DEFAULT_DETAIL_ITEM_ID);
  });

  it('report a miss rather than throwing, so a bad prop cannot break a page', () => {
    expect(indexOfItem(MOCK_ITEMS, 'evt-mock-nope')).toBe(-1);
    expect(findItem(MOCK_ITEMS, 'evt-mock-nope')).toBeUndefined();
    expect(findItem([], DEFAULT_DETAIL_ITEM_ID)).toBeUndefined();
  });
});

describe('nextDotIndex', () => {
  it('moves forward on ArrowRight and ArrowDown', () => {
    expect(nextDotIndex(0, 'ArrowRight', 29)).toBe(1);
    expect(nextDotIndex(0, 'ArrowDown', 29)).toBe(1);
  });

  it('moves backward on ArrowLeft and ArrowUp', () => {
    expect(nextDotIndex(5, 'ArrowLeft', 29)).toBe(4);
    expect(nextDotIndex(5, 'ArrowUp', 29)).toBe(4);
  });

  it('wraps at both ends', () => {
    expect(nextDotIndex(28, 'ArrowRight', 29)).toBe(0);
    expect(nextDotIndex(0, 'ArrowLeft', 29)).toBe(28);
  });

  it('walks straight across a group boundary', () => {
    // Person ends at 5, Vehicle starts at 6; Animal ends at 18, None starts at 19.
    expect(nextDotIndex(5, 'ArrowRight', 29)).toBe(6);
    expect(nextDotIndex(6, 'ArrowLeft', 29)).toBe(5);
    expect(nextDotIndex(18, 'ArrowRight', 29)).toBe(19);
    expect(nextDotIndex(19, 'ArrowLeft', 29)).toBe(18);
  });

  it('jumps to the ends on Home and End', () => {
    expect(nextDotIndex(13, 'Home', 29)).toBe(0);
    expect(nextDotIndex(13, 'End', 29)).toBe(28);
  });

  it('returns null for a key it does not own, so the event is left alone', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'PageDown', 'a']) {
      expect(nextDotIndex(3, key, 29)).toBeNull();
    }
  });

  it('returns null for an empty field', () => {
    expect(nextDotIndex(0, 'ArrowRight', 0)).toBeNull();
    expect(nextDotIndex(0, 'Home', -1)).toBeNull();
  });

  it('recovers from an impossible current index instead of returning one', () => {
    expect(nextDotIndex(-4, 'ArrowRight', 29)).toBe(1);
    expect(nextDotIndex(99, 'ArrowRight', 29)).toBe(0);
    expect(nextDotIndex(Number.NaN, 'ArrowRight', 29)).toBe(1);
    expect(nextDotIndex(2.5, 'ArrowLeft', 29)).toBe(28);
  });

  it('stays put in a field of one', () => {
    expect(nextDotIndex(0, 'ArrowRight', 1)).toBe(0);
    expect(nextDotIndex(0, 'ArrowLeft', 1)).toBe(0);
    expect(nextDotIndex(0, 'End', 1)).toBe(0);
  });

  it('always returns an index inside the field', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      for (let index = 0; index < MOCK_ITEMS.length; index += 1) {
        const next = nextDotIndex(index, key, MOCK_ITEMS.length);

        expect(next).not.toBeNull();
        expect(next ?? -1).toBeGreaterThanOrEqual(0);
        expect(next ?? -1).toBeLessThan(MOCK_ITEMS.length);
      }
    }
  });
});

describe('describeDot', () => {
  it('names the clip, both labels and the verdict', () => {
    expect(describeDot(makeItem({ predicted: 'Person', actual: 'Animal' }))).toBe(
      'Clip evt-mock-9999: predicted Person, ground truth Animal, incorrect',
    );
    expect(describeDot(makeItem({ predicted: 'None', actual: 'None' }))).toBe(
      'Clip evt-mock-9999: predicted None, ground truth None, correct',
    );
  });

  it('gives every clip in the run a distinct name', () => {
    const names = MOCK_ITEMS.map(describeDot);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('describeItemDetail', () => {
  it('names the verdict in words, not only in colour', () => {
    expect(
      describeItemDetail(makeItem({ predicted: 'Person', actual: 'Person' })).resultLabel,
    ).toBe('Correct');
    expect(
      describeItemDetail(makeItem({ predicted: 'Person', actual: 'Animal' })).resultLabel,
    ).toBe('Incorrect');
  });

  it('formats the clip figures for display', () => {
    const detail = describeItemDetail(
      makeItem({
        predicted: 'Person',
        actual: 'Animal',
        latencySeconds: 2.55,
        confidence: 0.925,
        costUsd: 0.003,
      }),
    );

    expect(detail.latencyLabel).toBe('2.55s');
    expect(detail.confidenceLabel).toBe('92.5%');
    expect(detail.confidencePercent).toBe(93);
    expect(detail.costLabel).toBe('$0.0030');
    expect(detail.classifiedAt).toBe(CLASSIFIER_STAGE);
  });

  it('lists the objects, or says so when there are none', () => {
    expect(
      describeItemDetail(
        makeItem({ predicted: 'Person', actual: 'Person', objects: ['person', 'parcel'] }),
      ).objectsLabel,
    ).toBe('person, parcel');
    expect(
      describeItemDetail(makeItem({ predicted: 'None', actual: 'None', objects: [] })).objectsLabel,
    ).toBe(EM_DASH);
  });

  it('keeps the confidence bar width inside 0–100 whatever it is handed', () => {
    for (const confidence of [-1, 0, 0.5, 1, 4, Number.NaN]) {
      const detail = describeItemDetail(
        makeItem({ predicted: 'Person', actual: 'Person', confidence }),
      );

      expect(detail.confidencePercent).toBeGreaterThanOrEqual(0);
      expect(detail.confidencePercent).toBeLessThanOrEqual(100);
    }
  });

  it('renders an unusable confidence as an em dash rather than a number', () => {
    const detail = describeItemDetail(
      makeItem({ predicted: 'Person', actual: 'Person', confidence: Number.NaN }),
    );

    expect(detail.confidenceLabel).toBe(EM_DASH);
    expect(detail.confidencePercent).toBe(0);
  });
});

describe('determinism', () => {
  /**
   * These islands server-render, so the same inputs must produce the same
   * strings in Node during the build and in the browser at hydration. Anything
   * that varies between two calls in the same process would vary between those
   * two environments too.
   */
  it('produces identical metric rows on repeated calls', () => {
    expect(buildMetricRows(MOCK_ITEMS, 1_500)).toStrictEqual(buildMetricRows(MOCK_ITEMS, 1_500));
  });

  it('produces identical groups and details on repeated calls', () => {
    expect(groupByPrediction(MOCK_ITEMS)).toStrictEqual(groupByPrediction(MOCK_ITEMS));

    const item = MOCK_ITEMS[0];
    if (item === undefined) throw new Error('the mock run is empty');
    expect(describeItemDetail(item)).toStrictEqual(describeItemDetail(item));
  });

  it('exposes a dataset that is a constant, not something rebuilt per call', () => {
    expect(MOCK_ITEMS).toBe(MOCK_ITEMS);
    expect(JSON.stringify(MOCK_ITEMS)).toBe(JSON.stringify(MOCK_ITEMS));
  });
});
