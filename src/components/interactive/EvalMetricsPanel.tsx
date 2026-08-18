/**
 * EvalMetricsPanel — the summary half of the Detection Eval Explorer.
 *
 * A macro-averaged summary row and one row per detection category, over a mock
 * 29-clip eval run, plus the control that makes the panel worth hydrating: the
 * `$/Sub/Mo` figure is a *projection*, and the assumption underneath it — how
 * many clips a subscriber generates in a month — is a slider rather than a
 * number somebody has to take on faith.
 *
 * Conventions, same as `ExampleCalculator`:
 *   - **No arithmetic and no formatting in this file.** Every string comes from
 *     `./eval-explorer`, where it is unit tested.
 *   - **Identical on the server and on first client render.** The dataset is a
 *     module constant, the default clip volume is a constant, formatter locales
 *     are pinned, and there is no `Date`, no random and no measurement of the
 *     viewport. The pre-hydration HTML already shows the whole table.
 *   - **No effects, no timers, no network, no persistence.** One piece of state
 *     (plus the number field's draft text); everything else is derived during
 *     render.
 *
 * Accessibility notes:
 *   - It is a real `<table>` with a `<caption>` and `scope`ed headers, so the
 *     relationship between a figure and its row and column survives being read
 *     out one cell at a time.
 *   - Column headers are abbreviated on screen (the dashboard this recreates is
 *     dense) and spelled out for assistive technology.
 *   - The projection sentence under the controls is the `aria-live` region, not
 *     the table: announcing sixteen re-rendered cells on every slider tick
 *     would be unusable.
 *   - No heading is emitted above `<h4>` — `InteractiveDemoShell` owns the
 *     `<h3>` for the demo.
 */

import { useId, useState } from 'react';

import './EvalMetricsPanel.css';
import {
  CLIPS_PER_SUBSCRIBER_DEFAULT,
  CLIPS_PER_SUBSCRIBER_MAX,
  CLIPS_PER_SUBSCRIBER_MIN,
  CLIPS_PER_SUBSCRIBER_STEP,
  EM_DASH,
  MOCK_DATA_NOTICE,
  MOCK_ITEMS,
  buildMetricRows,
  clampClipsPerSubscriber,
  formatUsd,
  isClipVolumeOutOfRange,
  overallMetrics,
  projectCostPerSubscriber,
} from './eval-explorer';
import type { EvalItem } from './eval-explorer';

export interface EvalMetricsPanelProps {
  /**
   * The run to summarise. Defaults to the built-in mock run; a post could pass
   * a different one, but there is only one and it is deliberately fake.
   */
  items?: readonly EvalItem[];
  /**
   * Starting clips-per-subscriber-per-month. Clamped like any other input, so a
   * post cannot seed the projection with an impossible assumption. Defaults to
   * `CLIPS_PER_SUBSCRIBER_DEFAULT`.
   */
  initialClipsPerSubscriber?: number;
}

/** Column definition: what the header says on screen, and what it says out loud. */
interface Column {
  readonly short: string;
  readonly full: string;
}

const COLUMNS: readonly Column[] = [
  { short: '$/Sub/Mo', full: 'Projected dollars per subscriber per month' },
  { short: 'Prec', full: 'Precision' },
  { short: 'Rec', full: 'Recall' },
  { short: 'FPR', full: 'False positive rate' },
  { short: 'Lat', full: 'Mean latency' },
  { short: 'Avg cost', full: 'Mean cost per clip' },
  { short: 'Cost (act)', full: 'Mean cost per clip with activity' },
  { short: 'Cost (no act)', full: 'Mean cost per clip with no activity' },
];

/**
 * One figure. An em dash means "this column does not apply to this row", which
 * is information, so it is spelled out for a screen reader rather than left as
 * a punctuation mark to guess at.
 */
function MetricCell({ value }: { value: string }) {
  if (value === EM_DASH) {
    return (
      <td className="eval-metrics__cell eval-metrics__cell--empty">
        <span aria-hidden="true">{EM_DASH}</span>
        <span className="visually-hidden">Not applicable</span>
      </td>
    );
  }

  return <td className="eval-metrics__cell">{value}</td>;
}

export default function EvalMetricsPanel({
  items = MOCK_ITEMS,
  initialClipsPerSubscriber = CLIPS_PER_SUBSCRIBER_DEFAULT,
}: EvalMetricsPanelProps) {
  /**
   * `clips` is canonical and always legal — every write goes through
   * `clampClipsPerSubscriber`. `draft` is the raw text in the number field,
   * tracked separately so clearing the field to type a new number does not snap
   * it back to the minimum on the first keystroke. Same split as
   * `ExampleCalculator`, for the same reason.
   */
  const [clips, setClips] = useState(() => clampClipsPerSubscriber(initialClipsPerSubscriber));
  const [draft, setDraft] = useState(() =>
    String(clampClipsPerSubscriber(initialClipsPerSubscriber)),
  );

  const baseId = useId();
  const rangeId = `${baseId}-clips`;
  const numberId = `${baseId}-clips-exact`;
  const hintId = `${baseId}-hint`;

  const rows = buildMetricRows(items, clips);
  const overall = overallMetrics(items);
  const projectionLabel = formatUsd(projectCostPerSubscriber(overall.meanCostUsd, clips));

  const draftNumber = Number(draft);
  const draftWasAdjusted = draft.trim() !== '' && isClipVolumeOutOfRange(draftNumber);

  function commit(value: number): void {
    const next = clampClipsPerSubscriber(value);
    setClips(next);
    setDraft(String(next));
  }

  return (
    <div className="eval-metrics">
      <div className="eval-metrics__header">
        <h4 className="eval-metrics__run">Detection Eval Explorer — run summary</h4>
        <p className="eval-metrics__badge">
          {MOCK_DATA_NOTICE}
          <span className="visually-hidden">
            . These figures are computed from a made-up run, not from client data.
          </span>
        </p>
      </div>

      <div className="eval-metrics__controls">
        <label className="eval-metrics__label" htmlFor={rangeId}>
          Clips per subscriber per month
        </label>

        <div className="eval-metrics__inputs">
          <input
            className="eval-metrics__range"
            id={rangeId}
            type="range"
            min={CLIPS_PER_SUBSCRIBER_MIN}
            max={CLIPS_PER_SUBSCRIBER_MAX}
            step={CLIPS_PER_SUBSCRIBER_STEP}
            value={clips}
            aria-describedby={hintId}
            onChange={(event) => {
              commit(Number(event.target.value));
            }}
          />

          <label className="visually-hidden" htmlFor={numberId}>
            Clips per subscriber per month, exact value
          </label>
          <input
            className="eval-metrics__number"
            id={numberId}
            type="number"
            inputMode="numeric"
            min={CLIPS_PER_SUBSCRIBER_MIN}
            max={CLIPS_PER_SUBSCRIBER_MAX}
            step={CLIPS_PER_SUBSCRIBER_STEP}
            value={draft}
            aria-describedby={hintId}
            onChange={(event) => {
              const raw = event.target.value;
              setDraft(raw);

              // A half-typed or empty field leaves the projection alone.
              if (raw.trim() === '') return;
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) setClips(clampClipsPerSubscriber(parsed));
            }}
            onBlur={() => {
              setDraft(String(clips));
            }}
          />
        </div>

        <p className="eval-metrics__hint" id={hintId}>
          Between {CLIPS_PER_SUBSCRIBER_MIN} and {CLIPS_PER_SUBSCRIBER_MAX} clips. This is the one
          assumption behind the {'$'}/Sub/Mo column — nothing measures it, so it is a dial rather
          than a constant.
        </p>

        {draftWasAdjusted && (
          <p className="eval-metrics__hint eval-metrics__hint--clamped">
            Adjusted: {draft} is outside the supported range, so {clips} was used instead.
          </p>
        )}
      </div>

      {/*
        The live region is this sentence, not the table. It restates the
        headline projection, so a screen reader hears one short update after the
        slider settles instead of the whole grid.
      */}
      <p className="eval-metrics__projection" aria-live="polite">
        At {clips} clips per subscriber per month, this run projects{' '}
        <strong>{projectionLabel}</strong> per subscriber per month.
      </p>

      <div className="eval-metrics__table-wrap">
        {/* The <caption> is the table's accessible name; it needs no aria wiring. */}
        <table className="eval-metrics__table">
          <caption className="eval-metrics__caption">
            Detection quality across {overall.itemCount} mock clips. The overall row is
            macro-averaged over Person, Vehicle and Animal, so a small category counts as much as a
            large one.
          </caption>
          <thead>
            <tr>
              <th className="eval-metrics__row-head" scope="col">
                Slice
              </th>
              {COLUMNS.map((column) => (
                <th className="eval-metrics__col-head" key={column.short} scope="col">
                  <span aria-hidden="true">{column.short}</span>
                  <span className="visually-hidden">{column.full}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className={
                  row.isOverall
                    ? 'eval-metrics__row eval-metrics__row--overall'
                    : 'eval-metrics__row'
                }
                key={row.key}
              >
                <th className="eval-metrics__row-head" scope="row">
                  {row.label}
                </th>
                <MetricCell value={row.costPerSubscriber} />
                <MetricCell value={row.precision} />
                <MetricCell value={row.recall} />
                <MetricCell value={row.falsePositiveRate} />
                <MetricCell value={row.latency} />
                <MetricCell value={row.meanCost} />
                <MetricCell value={row.costWithActivity} />
                <MetricCell value={row.costWithoutActivity} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="eval-metrics__note">
        A category row&rsquo;s {'$'}/Sub/Mo is that category&rsquo;s slice of the monthly bill — its
        share of the run&rsquo;s spend, not a repeat of the headline. The two right-hand columns
        split cost by whether the clip contained anything, which is a property of the run rather
        than of a category, so category rows show &ldquo;not applicable&rdquo;.
      </p>
    </div>
  );
}
