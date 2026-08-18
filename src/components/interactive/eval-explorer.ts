/**
 * Detection Eval Explorer — pure data and logic for the two eval islands.
 *
 * `EvalMetricsPanel.tsx` and `EvalDotGrid.tsx` both read from this module and
 * neither does arithmetic or formatting of its own. Everything here is a plain
 * function over plain data: no DOM, no network, no storage, no clock, no
 * randomness. That is what lets the same code run in vitest, in Astro's SSR
 * pass and in the browser after hydration and produce byte-identical output.
 *
 * Determinism rules for this file (same as `calculator.ts`):
 *   - No `Date.now()`, `Math.random()`, `fetch`, `localStorage`.
 *   - Every formatter pins its locale to `en-US`, so a machine with a
 *     different `LANG` cannot change the rendered string and therefore cannot
 *     cause a hydration mismatch.
 *   - The dataset is a module-level constant, not something built at call time.
 *
 * ---------------------------------------------------------------------------
 * THE DATA IS MOCK, ON PURPOSE
 * ---------------------------------------------------------------------------
 * The post it appears in recreates an internal tool against a made-up video
 * classification problem — the client's own tool and data are not ours to
 * share. Item ids are `evt-mock-####` and the UI says "mock data" out loud, so
 * nobody can mistake a screenshot of this for a real run.
 */

/** Locale pinned for every formatter in this module. See the note above. */
export const FORMAT_LOCALE = 'en-US' as const;

/** Rendered wherever a figure is undefined. Matches the dashboard it recreates. */
export const EM_DASH = '—' as const;

/** Prefix for every mock item id. */
export const ITEM_ID_PREFIX = 'evt-mock-' as const;

/** Prefix for the (fictional) clip location shown in the detail panel. */
export const VIDEO_PATH_PREFIX = 's3://rosie-mock-videos/eval-ui-mockup/' as const;

/** The pipeline stage that produced the label, shown in the detail panel. */
export const CLASSIFIER_STAGE = 'VLM Classifier' as const;

/** Said out loud in both islands so the numbers are never mistaken for a real run. */
export const MOCK_DATA_NOTICE = 'Mock data' as const;

/**
 * The label space.
 *
 * `None` is the negative class — the model saying "nothing happened in this
 * clip". It is a real prediction (it gets its own group of dots) but it is not
 * a detection, which is why the macro-averaged headline metrics skip it.
 */
export type Category = 'Person' | 'Vehicle' | 'Animal' | 'None';

/** Display order for groups and rows. Fixed, so SSR and client agree. */
export const CATEGORIES: readonly Category[] = ['Person', 'Vehicle', 'Animal', 'None'];

/**
 * Categories that count towards the macro-averaged overall row.
 *
 * Precision and recall of "the model correctly said nothing" is a different
 * question from detection quality, and folding it into the average would
 * flatter the run — `None` is the largest single group. The `None` group still
 * gets its own metric strip on the dot grid, where it is labelled.
 */
export const SCORED_CATEGORIES: readonly Category[] = ['Person', 'Vehicle', 'Animal'];

/** One clip in the eval run. */
export interface EvalItem {
  /** `evt-mock-0001` … stable, sequential, obviously not a real event id. */
  readonly id: string;
  /** What the classifier said. Determines which group the dot sits in. */
  readonly predicted: Category;
  /** What a human said. */
  readonly actual: Category;
  /** End-to-end time for this clip, in seconds. */
  readonly latencySeconds: number;
  /** The model's own confidence, 0–1. */
  readonly confidence: number;
  /** What this clip cost to classify, in US dollars. */
  readonly costUsd: number;
  /** The caption the model produced for the clip. */
  readonly caption: string;
  /** Objects the model reported. Empty for clips it called `None`. */
  readonly objects: readonly string[];
  /** Where the clip would live. Displayed as text; nothing fetches it. */
  readonly videoPath: string;
}

/** The dataset before ids and paths are stamped on. */
interface MockSeed {
  readonly predicted: Category;
  readonly actual: Category;
  readonly latencySeconds: number;
  readonly confidence: number;
  readonly costUsd: number;
  readonly caption: string;
  readonly objects: readonly string[];
}

/**
 * The run: 29 clips, ordered by predicted category (Person, Vehicle, Animal,
 * None) and then by id. That order is also the reading order of the dot field
 * and the order the roving-tabindex arithmetic walks, so the flat array *is*
 * the navigation order.
 *
 * Costs follow the pipeline rather than the label: a clip with real activity
 * runs the full VLM pass (~$0.003), a clip with nothing in it exits early
 * (~$0.0009). That is what makes the two cost columns worth showing.
 */
const MOCK_SEEDS: readonly MockSeed[] = [
  // --- Predicted: Person (6 clips, 1 wrong) -------------------------------
  {
    predicted: 'Person',
    actual: 'Person',
    latencySeconds: 2.11,
    confidence: 0.94,
    costUsd: 0.0031,
    caption: 'A delivery courier walks up the driveway and leaves a parcel by the door.',
    objects: ['person', 'parcel', 'door'],
  },
  {
    predicted: 'Person',
    actual: 'Person',
    latencySeconds: 1.84,
    confidence: 0.89,
    costUsd: 0.0029,
    caption: 'Two people cross the lawn towards the side gate.',
    objects: ['person', 'gate'],
  },
  {
    predicted: 'Person',
    actual: 'Person',
    latencySeconds: 2.46,
    confidence: 0.97,
    costUsd: 0.0033,
    caption: 'A person in a hooded jacket paces at the end of the driveway.',
    objects: ['person', 'driveway'],
  },
  {
    predicted: 'Person',
    actual: 'Person',
    latencySeconds: 3.02,
    confidence: 0.71,
    costUsd: 0.0034,
    caption: 'Someone kneels beside the porch light, partly out of frame.',
    objects: ['person', 'porch light'],
  },
  {
    predicted: 'Person',
    actual: 'Person',
    latencySeconds: 1.62,
    confidence: 0.92,
    costUsd: 0.0028,
    caption: 'A child runs across the front path chasing a ball.',
    objects: ['person', 'ball'],
  },
  {
    predicted: 'Person',
    actual: 'Animal',
    latencySeconds: 2.55,
    confidence: 0.925,
    costUsd: 0.003,
    caption: 'An upright figure moves along the fence line in low light.',
    objects: ['person', 'fence'],
  },

  // --- Predicted: Vehicle (10 clips, 1 wrong) -----------------------------
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.05,
    confidence: 0.96,
    costUsd: 0.003,
    caption: 'A silver hatchback reverses out of the driveway.',
    objects: ['car', 'driveway'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 1.77,
    confidence: 0.93,
    costUsd: 0.0028,
    caption: 'A delivery van pulls up at the kerb and stops.',
    objects: ['van', 'kerb'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.63,
    confidence: 0.88,
    costUsd: 0.0032,
    caption: 'A motorbike passes the gate and continues down the street.',
    objects: ['motorbike', 'gate'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.21,
    confidence: 0.9,
    costUsd: 0.0031,
    caption: 'A pickup truck idles across the road with its lights on.',
    objects: ['truck', 'headlights'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 1.95,
    confidence: 0.95,
    costUsd: 0.0029,
    caption: 'A car turns into the driveway and parks.',
    objects: ['car'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.38,
    confidence: 0.84,
    costUsd: 0.0031,
    caption: 'A bicycle leans against a car as the car pulls away.',
    objects: ['car', 'bicycle'],
  },
  {
    predicted: 'Vehicle',
    actual: 'None',
    latencySeconds: 2.72,
    confidence: 0.61,
    costUsd: 0.0009,
    caption: 'Headlights sweep across the garage wall as something moves past.',
    objects: ['vehicle'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 1.68,
    confidence: 0.97,
    costUsd: 0.0028,
    caption: 'A white SUV drives slowly past the front of the house.',
    objects: ['suv'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.9,
    confidence: 0.79,
    costUsd: 0.0033,
    caption: 'A parked estate car rolls forward a few feet and stops.',
    objects: ['car'],
  },
  {
    predicted: 'Vehicle',
    actual: 'Vehicle',
    latencySeconds: 2.14,
    confidence: 0.91,
    costUsd: 0.003,
    caption: 'A courier van reverses towards the garage.',
    objects: ['van', 'garage'],
  },

  // --- Predicted: Animal (3 clips, 1 wrong) -------------------------------
  {
    predicted: 'Animal',
    actual: 'Animal',
    latencySeconds: 1.89,
    confidence: 0.87,
    costUsd: 0.0029,
    caption: 'A cat crosses the patio and jumps onto the fence.',
    objects: ['cat', 'fence'],
  },
  {
    predicted: 'Animal',
    actual: 'Animal',
    latencySeconds: 2.34,
    confidence: 0.9,
    costUsd: 0.0031,
    caption: 'A deer grazes at the edge of the lawn.',
    objects: ['deer', 'lawn'],
  },
  {
    predicted: 'Animal',
    actual: 'Person',
    latencySeconds: 2.61,
    confidence: 0.58,
    costUsd: 0.0032,
    caption: 'A crouched shape moves quickly across the grass on all fours.',
    objects: ['animal'],
  },

  // --- Predicted: None (10 clips, 2 wrong) --------------------------------
  {
    predicted: 'None',
    actual: 'Person',
    latencySeconds: 2.48,
    confidence: 0.66,
    costUsd: 0.0031,
    caption: 'An empty driveway with tree shadows moving across it.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.55,
    confidence: 0.98,
    costUsd: 0.0008,
    caption: 'Empty driveway, no movement beyond the foliage.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.6,
    confidence: 0.96,
    costUsd: 0.0009,
    caption: 'Rain streaks across the lens; the path stays empty.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.49,
    confidence: 0.97,
    costUsd: 0.0008,
    caption: 'An empty porch at dusk.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'Vehicle',
    latencySeconds: 2.27,
    confidence: 0.63,
    costUsd: 0.003,
    caption: 'Headlight glare washes out the far end of the street.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.72,
    confidence: 0.94,
    costUsd: 0.001,
    caption: 'Wind moves the hedge along the boundary.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.58,
    confidence: 0.99,
    costUsd: 0.0008,
    caption: 'Static view of the garage door; nothing enters the frame.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.66,
    confidence: 0.95,
    costUsd: 0.0009,
    caption: 'A cloud shadow crosses the lawn.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.81,
    confidence: 0.92,
    costUsd: 0.0011,
    caption: 'Insects drift past the lens at night.',
    objects: [],
  },
  {
    predicted: 'None',
    actual: 'None',
    latencySeconds: 1.53,
    confidence: 0.98,
    costUsd: 0.0008,
    caption: 'An empty side path, triggered by the gate light coming on.',
    objects: [],
  },
];

/** Zero-padded sequence number for an item's position in the run. */
function sequenceLabel(index: number): string {
  return String(index + 1).padStart(4, '0');
}

/**
 * The eval run, as the islands see it. Ids and clip paths are derived from
 * position, so the dataset above stays readable and the two can never drift
 * apart.
 */
export const MOCK_ITEMS: readonly EvalItem[] = MOCK_SEEDS.map((seed, index) => ({
  id: `${ITEM_ID_PREFIX}${sequenceLabel(index)}`,
  videoPath: `${VIDEO_PATH_PREFIX}${sequenceLabel(index)}.mp4`,
  ...seed,
}));

/**
 * The clip the dot grid has open before anyone touches it — and therefore the
 * one in the server-rendered HTML.
 *
 * It is the `Person` group's single wrong prediction, on purpose: the panel's
 * whole argument is that a failure should be one click from the aggregate, so
 * the pre-hydration state shows a complete, honest example instead of an empty
 * shell. `eval-explorer.test.ts` asserts the id exists in the run.
 */
export const DEFAULT_DETAIL_ITEM_ID = `${ITEM_ID_PREFIX}0006`;

/* ===========================================================================
 * Formatting
 *
 * One formatter instance per shape, built once. Every one is constructed from
 * literals, so they are as deterministic as the arithmetic they format.
 * ======================================================================== */

const PERCENT_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const SECONDS_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const PRECISE_SECONDS_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MICRO_USD_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * Every formatter in this module, by name.
 *
 * Exported for one reason: so a test can ask each one what locale it resolved
 * to. The pin is the load-bearing hydration guarantee here — the server and the
 * browser must agree on where the decimal point and the group separator go —
 * and it cannot be checked through the formatting functions, because a CI box
 * running `en-US` produces identical output whether the locale is pinned or
 * left to the host. Nothing else should read this.
 */
export const NUMBER_FORMATTERS: Readonly<Record<string, Intl.NumberFormat>> = Object.freeze({
  percent: PERCENT_FORMATTER,
  seconds: SECONDS_FORMATTER,
  preciseSeconds: PRECISE_SECONDS_FORMATTER,
  usd: USD_FORMATTER,
  microUsd: MICRO_USD_FORMATTER,
});

/**
 * A rate as a percentage: `0.7536` -> `"75.4%"`.
 *
 * Undefined rates — precision with no predictions, recall with no ground-truth
 * examples — arrive here as `NaN` and render as an em dash. That is the whole
 * degradation strategy: the arithmetic never special-cases an empty category,
 * it produces `NaN` and the formatter turns it into the same dash the
 * dashboard uses for "not applicable".
 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return PERCENT_FORMATTER.format(value);
}

/** Latency for a summary row: `2.34` -> `"2.3s"`. */
export function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return `${SECONDS_FORMATTER.format(value)}s`;
}

/** Latency for a single clip, where the extra digit is real: `"2.55s"`. */
export function formatPreciseSeconds(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return `${PRECISE_SECONDS_FORMATTER.format(value)}s`;
}

/** A dollars-and-cents figure: `4.4832` -> `"$4.48"`. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return USD_FORMATTER.format(value);
}

/** A per-clip cost, where cents are useless: `0.00238` -> `"$0.0024"`. */
export function formatMicroUsd(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return MICRO_USD_FORMATTER.format(value);
}

/* ===========================================================================
 * Aggregation
 * ======================================================================== */

/** Arithmetic mean. Empty input is `NaN`, which formats as an em dash. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

/**
 * Mean of the finite values only, `NaN` if there are none.
 *
 * Used for macro-averaging, where a category with no predictions contributes
 * an undefined precision. Dropping it is the standard reading of a macro
 * average over the categories that exist; letting one `NaN` poison the
 * headline would be worse than useless.
 */
export function meanOfDefined(values: readonly number[]): number {
  return mean(values.filter((value) => Number.isFinite(value)));
}

/** True when the classifier agreed with the human on this clip. */
export function isCorrect(item: EvalItem): boolean {
  return item.predicted === item.actual;
}

/** True when the clip actually contained something — the cost split turns on this. */
export function hasActivity(item: EvalItem): boolean {
  return item.actual !== 'None';
}

/** One category's confusion matrix cell counts, one-vs-rest. */
export interface Confusion {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly trueNegatives: number;
}

/** One-vs-rest confusion matrix for a single category. */
export function confusionFor(items: readonly EvalItem[], category: Category): Confusion {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;

  for (const item of items) {
    const predictedIt = item.predicted === category;
    const actuallyIt = item.actual === category;

    if (predictedIt && actuallyIt) truePositives += 1;
    else if (predictedIt) falsePositives += 1;
    else if (actuallyIt) falseNegatives += 1;
    else trueNegatives += 1;
  }

  return { truePositives, falsePositives, falseNegatives, trueNegatives };
}

/**
 * Precision: of the clips called `X`, how many were `X`.
 *
 * Undefined (`NaN`) when the category was never predicted — dividing by zero
 * predictions is not "0% precision", it is "no answer", and the two must not
 * look the same on screen.
 */
export function precisionOf(confusion: Confusion): number {
  const predicted = confusion.truePositives + confusion.falsePositives;
  return predicted === 0 ? Number.NaN : confusion.truePositives / predicted;
}

/** Recall: of the clips that were `X`, how many were found. `NaN` when there were none. */
export function recallOf(confusion: Confusion): number {
  const actual = confusion.truePositives + confusion.falseNegatives;
  return actual === 0 ? Number.NaN : confusion.truePositives / actual;
}

/**
 * False positive rate: of the clips that were *not* `X`, how many were called
 * `X` anyway. `NaN` when every clip was `X`.
 */
export function falsePositiveRateOf(confusion: Confusion): number {
  const negatives = confusion.falsePositives + confusion.trueNegatives;
  return negatives === 0 ? Number.NaN : confusion.falsePositives / negatives;
}

/** Everything one category contributes to the two islands. */
export interface CategoryMetrics {
  readonly category: Category;
  readonly confusion: Confusion;
  /** How many clips the model put in this group. */
  readonly predictedCount: number;
  /** How many of those the model got right. */
  readonly correctCount: number;
  /** How many of those it got wrong. */
  readonly incorrectCount: number;
  readonly precision: number;
  readonly recall: number;
  readonly falsePositiveRate: number;
  /** Mean latency across the clips in this group. `NaN` when the group is empty. */
  readonly meanLatencySeconds: number;
  /** Mean cost across the clips in this group. `NaN` when the group is empty. */
  readonly meanCostUsd: number;
  /**
   * This group's share of the run's total classification spend, 0–1. Multiplied
   * by the run's overall `$/Sub/Mo` projection it gives the group's slice of
   * that projection, and the slices add up to the overall figure. (Multiplying
   * it by the clip volume instead would give a count of clips, not a cost.)
   */
  readonly costShare: number;
}

/** Metrics for one category across a run. */
export function categoryMetrics(items: readonly EvalItem[], category: Category): CategoryMetrics {
  const confusion = confusionFor(items, category);
  const group = items.filter((item) => item.predicted === category);
  const totalCost = items.reduce((sum, item) => sum + item.costUsd, 0);
  const groupCost = group.reduce((sum, item) => sum + item.costUsd, 0);

  return {
    category,
    confusion,
    predictedCount: group.length,
    correctCount: group.filter(isCorrect).length,
    incorrectCount: group.filter((item) => !isCorrect(item)).length,
    precision: precisionOf(confusion),
    recall: recallOf(confusion),
    falsePositiveRate: falsePositiveRateOf(confusion),
    meanLatencySeconds: mean(group.map((item) => item.latencySeconds)),
    meanCostUsd: mean(group.map((item) => item.costUsd)),
    costShare: totalCost === 0 ? Number.NaN : groupCost / totalCost,
  };
}

/** The headline row: macro-averaged detection quality plus the cost split. */
export interface OverallMetrics {
  readonly itemCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  /** Macro-averaged over `SCORED_CATEGORIES`. */
  readonly precision: number;
  readonly recall: number;
  readonly falsePositiveRate: number;
  readonly meanLatencySeconds: number;
  readonly meanCostUsd: number;
  /** Mean cost of the clips that contained something. */
  readonly meanCostWithActivityUsd: number;
  /** Mean cost of the clips that did not. */
  readonly meanCostWithoutActivityUsd: number;
}

/**
 * Macro-average, not micro: every category counts the same regardless of how
 * many clips it has. A single accuracy number, or a micro-average, would let
 * the large `Vehicle` group hide what is happening to `Animal` — which is the
 * exact failure the post argues a dashboard should make visible.
 */
export function overallMetrics(items: readonly EvalItem[]): OverallMetrics {
  const scored = SCORED_CATEGORIES.map((category) => categoryMetrics(items, category));

  return {
    itemCount: items.length,
    correctCount: items.filter(isCorrect).length,
    incorrectCount: items.filter((item) => !isCorrect(item)).length,
    precision: meanOfDefined(scored.map((metrics) => metrics.precision)),
    recall: meanOfDefined(scored.map((metrics) => metrics.recall)),
    falsePositiveRate: meanOfDefined(scored.map((metrics) => metrics.falsePositiveRate)),
    meanLatencySeconds: mean(items.map((item) => item.latencySeconds)),
    meanCostUsd: mean(items.map((item) => item.costUsd)),
    meanCostWithActivityUsd: mean(items.filter(hasActivity).map((item) => item.costUsd)),
    meanCostWithoutActivityUsd: mean(
      items.filter((item) => !hasActivity(item)).map((item) => item.costUsd),
    ),
  };
}

/* ===========================================================================
 * The $/Sub/Mo projection
 *
 * The dashboard's headline number is not a measurement, it is a projection:
 * mean cost per clip times how many clips a subscriber generates in a month.
 * The second half of that is an assumption, so the island exposes it as a
 * control rather than baking it in.
 * ======================================================================== */

/** Fewest clips per subscriber per month the control accepts. */
export const CLIPS_PER_SUBSCRIBER_MIN = 100;

/** Most clips per subscriber per month the control accepts. */
export const CLIPS_PER_SUBSCRIBER_MAX = 5_000;

/** Granularity of the control, so slider and number field cannot disagree. */
export const CLIPS_PER_SUBSCRIBER_STEP = 50;

/** What the control shows before anyone touches it — and during SSR. */
export const CLIPS_PER_SUBSCRIBER_DEFAULT = 1_500;

/**
 * Coerce arbitrary input into a legal clip volume: non-finite falls back to the
 * default, then round to the step, then clamp. That order matters, and not in
 * the reassuring direction: rounding first is exactly what lets a value climb —
 * `4999` rounds up to `5000`, and `5030` rounds up to `5050`, out past the
 * ceiling. The clamp afterwards is what saves it. Clamping first would not:
 * the round would then be free to step the clamped value back over the edge.
 */
export function clampClipsPerSubscriber(value: number): number {
  if (!Number.isFinite(value)) return CLIPS_PER_SUBSCRIBER_DEFAULT;

  const stepped = Math.round(value / CLIPS_PER_SUBSCRIBER_STEP) * CLIPS_PER_SUBSCRIBER_STEP;
  if (stepped < CLIPS_PER_SUBSCRIBER_MIN) return CLIPS_PER_SUBSCRIBER_MIN;
  if (stepped > CLIPS_PER_SUBSCRIBER_MAX) return CLIPS_PER_SUBSCRIBER_MAX;
  return stepped;
}

/**
 * True when `clampClipsPerSubscriber` would return something other than what it
 * was given — because the value is out of range, because it is off the step
 * grid, or because it is not a number at all.
 *
 * This is deliberately *not* a range check. `clampClipsPerSubscriber` rounds as
 * well as clamps, so `1234` is inside the range and still comes back as `1250`;
 * a range check would let the panel compute from `1250` while the field still
 * reads `1234` and nothing says so. Asking the clamp itself catches both halves
 * and cannot drift away from it.
 */
export function isClipVolumeAdjusted(value: number): boolean {
  return !Number.isFinite(value) || clampClipsPerSubscriber(value) !== value;
}

/** Monthly cost per subscriber at a given mean cost per clip. Input is clamped. */
export function projectCostPerSubscriber(meanCostUsd: number, clipsPerSubscriber: number): number {
  if (!Number.isFinite(meanCostUsd)) return Number.NaN;
  return meanCostUsd * clampClipsPerSubscriber(clipsPerSubscriber);
}

/* ===========================================================================
 * View models
 * ======================================================================== */

/** One row of the metrics table, already formatted. */
export interface MetricRow {
  /** `overall`, or the category name. Stable, used as a React key. */
  readonly key: string;
  /** What the row header says. */
  readonly label: string;
  /** True for the summary row, which is styled and described differently. */
  readonly isOverall: boolean;
  readonly costPerSubscriber: string;
  readonly precision: string;
  readonly recall: string;
  readonly falsePositiveRate: string;
  readonly latency: string;
  readonly meanCost: string;
  /**
   * The two cost columns only mean anything for the run as a whole: a category
   * row is a slice of the *predictions*, while the activity split is a slice of
   * the *ground truth*, and mixing the two would produce a number nobody could
   * act on. Category rows therefore carry an em dash, exactly as the dashboard
   * this recreates does.
   */
  readonly costWithActivity: string;
  readonly costWithoutActivity: string;
}

/**
 * The metrics table, top to bottom: the macro-averaged summary, then one row
 * per detection category.
 *
 * The `$/Sub/Mo` cell on a category row is that category's *slice* of the
 * projection — its share of the run's spend times the monthly volume — so the
 * three category rows plus the (unshown) `None` group add up to the overall
 * figure rather than each repeating it.
 */
export function buildMetricRows(
  items: readonly EvalItem[],
  clipsPerSubscriber: number,
): readonly MetricRow[] {
  const overall = overallMetrics(items);
  const clips = clampClipsPerSubscriber(clipsPerSubscriber);
  const overallProjection = projectCostPerSubscriber(overall.meanCostUsd, clips);

  const overallRow: MetricRow = {
    key: 'overall',
    label: 'Overall',
    isOverall: true,
    costPerSubscriber: formatUsd(overallProjection),
    precision: formatPercent(overall.precision),
    recall: formatPercent(overall.recall),
    falsePositiveRate: formatPercent(overall.falsePositiveRate),
    latency: formatSeconds(overall.meanLatencySeconds),
    meanCost: formatMicroUsd(overall.meanCostUsd),
    costWithActivity: formatMicroUsd(overall.meanCostWithActivityUsd),
    costWithoutActivity: formatMicroUsd(overall.meanCostWithoutActivityUsd),
  };

  const categoryRows = SCORED_CATEGORIES.map((category): MetricRow => {
    const metrics = categoryMetrics(items, category);

    return {
      key: category,
      label: category,
      isOverall: false,
      costPerSubscriber: formatUsd(overallProjection * metrics.costShare),
      precision: formatPercent(metrics.precision),
      recall: formatPercent(metrics.recall),
      falsePositiveRate: formatPercent(metrics.falsePositiveRate),
      latency: formatSeconds(metrics.meanLatencySeconds),
      meanCost: formatMicroUsd(metrics.meanCostUsd),
      costWithActivity: EM_DASH,
      costWithoutActivity: EM_DASH,
    };
  });

  return [overallRow, ...categoryRows];
}

/** One group of dots: the clips the model assigned to a single category. */
export interface DotGroup {
  readonly category: Category;
  readonly label: string;
  readonly items: readonly EvalItem[];
  readonly metrics: CategoryMetrics;
  /**
   * Where this group's first dot sits in the flat navigation order. The roving
   * tabindex is a single index over every dot in the island, so arrow keys walk
   * out of one group and into the next without the component doing any
   * bookkeeping of its own.
   */
  readonly startIndex: number;
}

/**
 * Group the run by predicted category, in `CATEGORIES` order.
 *
 * Concatenating the groups reproduces the input array exactly (the dataset is
 * already stored in this order), which is what makes `startIndex` arithmetic
 * safe.
 */
export function groupByPrediction(items: readonly EvalItem[]): readonly DotGroup[] {
  let startIndex = 0;

  return CATEGORIES.map((category) => {
    const groupItems = items.filter((item) => item.predicted === category);
    const group: DotGroup = {
      category,
      label: category,
      items: groupItems,
      metrics: categoryMetrics(items, category),
      startIndex,
    };
    startIndex += groupItems.length;
    return group;
  });
}

/** Index of an item in the flat navigation order, or `-1`. */
export function indexOfItem(items: readonly EvalItem[], id: string): number {
  return items.findIndex((item) => item.id === id);
}

/** Look an item up by id. `undefined` when the id is unknown. */
export function findItem(items: readonly EvalItem[], id: string): EvalItem | undefined {
  return items.find((item) => item.id === id);
}

/**
 * Where a keyboard event should move focus within the dot field.
 *
 * The field is a single tab stop with a roving tabindex, so arrow keys — not
 * Tab — move between the 29 dots. Both axes are wired up because the dots wrap
 * onto several visual rows whose length depends on the viewport: at 320px
 * "down" is not reliably "one row lower", so treating the field as a single
 * wrapping sequence is the only behaviour that stays predictable.
 *
 * Returns `null` for a key this pattern does not own, so the component can let
 * the event through untouched.
 */
export function nextDotIndex(currentIndex: number, key: string, count: number): number | null {
  if (count <= 0) return null;

  // A current index from outside the field (or from a stale render) is treated
  // as "before the first dot", so the very next arrow press lands somewhere sane.
  const safeIndex = Number.isInteger(currentIndex)
    ? Math.min(Math.max(currentIndex, 0), count - 1)
    : 0;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (safeIndex + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (safeIndex - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * The accessible name for a dot.
 *
 * Every dot is a button, and a button that reads out as "button" is useless.
 * This is the sentence a screen reader announces, and it carries the same three
 * facts the dot's position and shape carry visually: which clip, what the model
 * said against what was true, and whether that was right.
 */
export function describeDot(item: EvalItem): string {
  const verdict = isCorrect(item) ? 'correct' : 'incorrect';
  return `Clip ${item.id}: predicted ${item.predicted}, ground truth ${item.actual}, ${verdict}`;
}

/** Everything the detail panel shows for one clip, already formatted. */
export interface ItemDetail {
  readonly item: EvalItem;
  readonly correct: boolean;
  /** `Correct` or `Incorrect` — the word, never the colour alone. */
  readonly resultLabel: string;
  readonly latencyLabel: string;
  readonly confidenceLabel: string;
  /** 0–100, rounded, for the width of the confidence bar. */
  readonly confidencePercent: number;
  readonly costLabel: string;
  /** `person, parcel, door`, or an em dash when the model reported none. */
  readonly objectsLabel: string;
  readonly classifiedAt: string;
}

/** Build the detail panel's view model. Pure, so the panel renders identically on the server. */
export function describeItemDetail(item: EvalItem): ItemDetail {
  const correct = isCorrect(item);

  return {
    item,
    correct,
    resultLabel: correct ? 'Correct' : 'Incorrect',
    latencyLabel: formatPreciseSeconds(item.latencySeconds),
    confidenceLabel: formatPercent(item.confidence),
    confidencePercent: Number.isFinite(item.confidence)
      ? Math.min(Math.max(Math.round(item.confidence * 100), 0), 100)
      : 0,
    costLabel: formatMicroUsd(item.costUsd),
    objectsLabel: item.objects.length === 0 ? EM_DASH : item.objects.join(', '),
    classifiedAt: CLASSIFIER_STAGE,
  };
}
