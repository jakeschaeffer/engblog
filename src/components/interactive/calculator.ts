/**
 * Throughput calculator — pure logic for the `ExampleCalculator` island.
 *
 * This module is the whole brain of the demo. The React component holds state
 * and markup; every number it displays comes from here. That split is what
 * makes the demo testable: this file has no imports, no DOM, no network, no
 * storage, no randomness and no clock, so it runs unchanged in vitest, in the
 * Astro SSR pass, and in the browser after hydration.
 *
 * Determinism rules for this file:
 *   - No `Date.now()`, `Math.random()`, `fetch`, `localStorage`.
 *   - The number formatter pins its locale to `en-US` rather than using the
 *     host default, so a CI machine with a different `LANG` cannot change the
 *     rendered output (and therefore cannot cause a hydration mismatch between
 *     the server-rendered HTML and the client render).
 */

/** Locale pinned for all formatting in this module. See the note above. */
export const FORMAT_LOCALE = 'en-US' as const;

/** Lowest requests-per-second the control accepts. */
export const RPS_MIN = 1;

/** Highest requests-per-second the control accepts. */
export const RPS_MAX = 10_000;

/**
 * Granularity of the control. Inputs are rounded to a multiple of this before
 * clamping, so the slider and the number field can never disagree about which
 * value is "current".
 */
export const RPS_STEP = 1;

/** Value the control shows before the reader touches it (and during SSR). */
export const RPS_DEFAULT = 250;

/** Seconds in a day. */
export const SECONDS_PER_DAY = 86_400;

/**
 * Days used for the "per month" figure.
 *
 * A flat 30 rather than 30.44: this is a back-of-the-envelope capacity number,
 * and a round month is easier for a reader to sanity-check in their head. The
 * constant is exported so the UI can state the assumption.
 */
export const DAYS_PER_MONTH = 30;

/**
 * Shared formatter instance.
 *
 * Constructing `Intl.NumberFormat` is comparatively expensive, and these
 * options never vary, so one module-level instance is reused. It is still
 * completely deterministic — the locale and options are literals.
 */
const COUNT_FORMATTER = new Intl.NumberFormat(FORMAT_LOCALE, {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/**
 * Format a whole count for display, e.g. `21600000` -> `"21,600,000"`.
 *
 * Non-finite input is rendered as an em dash rather than `"NaN"` or
 * `"Infinity"`: the calculator never produces such a value, but a formatter
 * that can be handed one should degrade into something a reader can parse.
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return COUNT_FORMATTER.format(value);
}

/**
 * Coerce arbitrary input into a legal requests-per-second value.
 *
 * Order of operations, in this order deliberately:
 *   1. Non-finite input (`NaN`, `Infinity`, `-Infinity`) falls back to
 *      `RPS_DEFAULT`. A blank or garbled number field must not blank out the
 *      readout, so there is always *some* sane value to render.
 *   2. The value is rounded to the nearest `RPS_STEP`.
 *   3. The result is clamped into `[RPS_MIN, RPS_MAX]`.
 *
 * Rounding before clamping matters: it means a value just under `RPS_MAX`
 * cannot round its way past the ceiling.
 */
export function clampRequestsPerSecond(value: number): number {
  if (!Number.isFinite(value)) return RPS_DEFAULT;

  const stepped = Math.round(value / RPS_STEP) * RPS_STEP;
  if (stepped < RPS_MIN) return RPS_MIN;
  if (stepped > RPS_MAX) return RPS_MAX;
  return stepped;
}

/**
 * True when a value lies outside `[RPS_MIN, RPS_MAX]`, or is not a usable
 * number at all. The UI uses this to tell the reader that what they typed was
 * pulled back into range.
 *
 * Note the deliberate narrowness: this reports *range* violations only. A
 * fractional but in-range value such as `250.4` is silently rounded by
 * `clampRequestsPerSecond` and is not reported here, because rounding to the
 * step is not something worth interrupting the reader about.
 */
export function isOutOfRange(value: number): boolean {
  return !Number.isFinite(value) || value < RPS_MIN || value > RPS_MAX;
}

/** Requests per day at a sustained rate. Input is clamped first. */
export function requestsPerDay(requestsPerSecond: number): number {
  return clampRequestsPerSecond(requestsPerSecond) * SECONDS_PER_DAY;
}

/** Requests per (30-day) month at a sustained rate. Input is clamped first. */
export function requestsPerMonth(requestsPerSecond: number): number {
  return requestsPerDay(requestsPerSecond) * DAYS_PER_MONTH;
}

/** Everything the UI needs for one input value. */
export interface ThroughputEstimate {
  /** The value actually used, after rounding and clamping. */
  readonly requestsPerSecond: number;
  /** Whether the caller's raw value had to be adjusted to get there. */
  readonly wasClamped: boolean;
  /** Raw derived figures, for callers that want to do their own formatting. */
  readonly perDay: number;
  readonly perMonth: number;
  /** Display strings, formatted with the pinned locale. */
  readonly requestsPerSecondLabel: string;
  readonly perDayLabel: string;
  readonly perMonthLabel: string;
}

/**
 * One call, everything the component renders. Keeping this as a single pure
 * function means the React island never does arithmetic of its own — it maps
 * this object onto markup and nothing else.
 */
export function estimateThroughput(requestsPerSecondInput: number): ThroughputEstimate {
  const requestsPerSecond = clampRequestsPerSecond(requestsPerSecondInput);
  const perDay = requestsPerSecond * SECONDS_PER_DAY;
  const perMonth = perDay * DAYS_PER_MONTH;

  return {
    requestsPerSecond,
    wasClamped: isOutOfRange(requestsPerSecondInput),
    perDay,
    perMonth,
    requestsPerSecondLabel: formatCount(requestsPerSecond),
    perDayLabel: formatCount(perDay),
    perMonthLabel: formatCount(perMonth),
  };
}
