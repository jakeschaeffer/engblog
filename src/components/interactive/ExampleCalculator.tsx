/**
 * ExampleCalculator — the site's reference React island.
 *
 * A reader drags a slider (or types a number) for a sustained request rate and
 * sees the daily and monthly request volume that implies. It exists as much to
 * demonstrate *how* we ship interactivity in an article as to do the sum.
 *
 * The shape of the thing:
 *
 *   - **All arithmetic and formatting lives in `./calculator`.** This file maps
 *     that pure module onto markup and holds two pieces of state. If you find
 *     yourself writing a `*` or a `toLocaleString` in here, it belongs next
 *     door, where it can be unit tested.
 *
 *   - **It renders identically on the server and on first client render.** The
 *     default value is a constant, the formatter's locale is pinned, and there
 *     is no `Date`, no random, no measurement of the viewport. That matters
 *     because the island is mounted with `client:visible`: Astro emits the
 *     server-rendered HTML immediately and hydration happens later, possibly
 *     much later. The pre-hydration HTML already shows the default value and
 *     the full result panel, so nothing moves when React takes over.
 *
 *   - **No effects, no timers, no network, no persistence, no analytics.**
 *     Every value is derived during render from `rps`, so there is nothing for
 *     a `useEffect` to synchronise.
 *
 * Accessibility notes:
 *   - Both controls have a real `<label>` (the number field's is visually
 *     hidden — it duplicates the slider's visible label rather than shouting it
 *     twice) and both point at the same `aria-describedby` hint.
 *   - The number field exists so the control is usable by keyboard and by
 *     anyone who cannot drag; the slider is also arrow-key operable natively.
 *   - The results panel is an `aria-live="polite"` region, so a screen reader
 *     announces the new figures after the reader stops moving the slider,
 *     rather than on every intermediate value.
 */

import { useId, useState } from 'react';

import './ExampleCalculator.css';
import {
  DAYS_PER_MONTH,
  RPS_DEFAULT,
  RPS_MAX,
  RPS_MIN,
  RPS_STEP,
  clampRequestsPerSecond,
  estimateThroughput,
  formatCount,
} from './calculator';

export interface ExampleCalculatorProps {
  /**
   * Starting rate. Clamped like any other input, so a post cannot seed the
   * demo with an out-of-range value. Defaults to `RPS_DEFAULT`.
   */
  initialRequestsPerSecond?: number;
}

export default function ExampleCalculator({
  initialRequestsPerSecond = RPS_DEFAULT,
}: ExampleCalculatorProps) {
  /**
   * `rps` is the canonical value and is *always* legal — every write goes
   * through `clampRequestsPerSecond`.
   *
   * `draft` is the raw text in the number field. It is tracked separately
   * because clamping on every keystroke makes the field unusable: clearing it
   * to type a new number would immediately snap back to the minimum. So the
   * field shows what was typed, the readout shows the clamped interpretation,
   * and blurring the field normalises the two.
   */
  const [rps, setRps] = useState(() => clampRequestsPerSecond(initialRequestsPerSecond));
  const [draft, setDraft] = useState(() =>
    String(clampRequestsPerSecond(initialRequestsPerSecond)),
  );

  // `useId` is SSR-safe: React generates matching ids on the server and during
  // hydration, so the label/description wiring survives the handoff.
  const baseId = useId();
  const rangeId = `${baseId}-rate`;
  const numberId = `${baseId}-rate-exact`;
  const hintId = `${baseId}-hint`;

  const estimate = estimateThroughput(rps);

  // True when the reader typed something the calculator had to pull back into
  // range — `rps` itself is already clamped, so this compares against the draft.
  const draftNumber = Number(draft);
  const draftWasAdjusted =
    draft.trim() !== '' &&
    Number.isFinite(draftNumber) &&
    clampRequestsPerSecond(draftNumber) !== draftNumber;

  function commit(value: number): void {
    const next = clampRequestsPerSecond(value);
    setRps(next);
    setDraft(String(next));
  }

  return (
    <div className="ex-calc">
      <div className="ex-calc__controls">
        <label className="ex-calc__label" htmlFor={rangeId}>
          Sustained request rate (requests per second)
        </label>

        <div className="ex-calc__inputs">
          <input
            className="ex-calc__range"
            id={rangeId}
            type="range"
            min={RPS_MIN}
            max={RPS_MAX}
            step={RPS_STEP}
            value={rps}
            aria-describedby={hintId}
            onChange={(event) => {
              commit(Number(event.target.value));
            }}
          />

          <label className="visually-hidden" htmlFor={numberId}>
            Sustained request rate, exact value
          </label>
          <input
            className="ex-calc__number"
            id={numberId}
            type="number"
            inputMode="numeric"
            min={RPS_MIN}
            max={RPS_MAX}
            step={RPS_STEP}
            value={draft}
            aria-describedby={hintId}
            onChange={(event) => {
              const raw = event.target.value;
              setDraft(raw);

              // Only move the canonical value when the field parses to a real
              // number; a half-typed or empty field leaves the readout alone.
              if (raw.trim() === '') return;
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) setRps(clampRequestsPerSecond(parsed));
            }}
            onBlur={() => {
              // Normalise: whatever was typed, the field now agrees with the
              // value the readout is actually using.
              setDraft(String(rps));
            }}
          />
        </div>

        <p className="ex-calc__hint" id={hintId}>
          Between {formatCount(RPS_MIN)} and {formatCount(RPS_MAX)} requests per second. Values
          outside that range are clamped.
        </p>
      </div>

      {/*
        `aria-live="polite"` announces the recalculated figures without
        interrupting; the region is present in the server-rendered HTML so its
        contents are announced as *updates*, not as newly inserted content.
      */}
      <dl className="ex-calc__readout" aria-live="polite">
        <div>
          <dt className="ex-calc__figure-term">Requests per day</dt>
          <dd className="ex-calc__figure-value">{estimate.perDayLabel}</dd>
        </div>
        <div>
          <dt className="ex-calc__figure-term">Requests per month</dt>
          <dd className="ex-calc__figure-value">{estimate.perMonthLabel}</dd>
        </div>
      </dl>

      <p className="ex-calc__note">
        At {estimate.requestsPerSecondLabel} requests per second sustained, over a {DAYS_PER_MONTH}
        -day month.
      </p>

      {draftWasAdjusted && (
        <p className="ex-calc__note ex-calc__note--clamped">
          Adjusted: {draft} is outside the supported range, so {estimate.requestsPerSecondLabel} was
          used instead.
        </p>
      )}
    </div>
  );
}
