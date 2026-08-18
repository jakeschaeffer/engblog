/**
 * EvalDotGrid — the dot layer of the Detection Eval Explorer.
 *
 * Every clip in the run is one small mark, grouped by what the model predicted.
 * Distribution, class imbalance and error clusters are visible before you have
 * asked a question. Activate a mark and the clip's full record expands inline
 * underneath the field: caption, predicted label against ground truth,
 * confidence, objects detected, latency and that clip's own cost.
 *
 * Conventions, same as `ExampleCalculator`:
 *   - **No arithmetic and no formatting in this file.** Grouping, metrics,
 *     accessible names, the detail view model and the keyboard index
 *     arithmetic all live in `./eval-explorer`, where they are unit tested.
 *   - **Identical on the server and on first client render.** The dataset and
 *     the initially-open clip are module constants, so the pre-hydration HTML
 *     already contains all 29 marks and a fully populated detail panel.
 *   - **No effects, no timers, no network, no persistence.** Focus is moved
 *     imperatively inside the event handler that caused it, which is where
 *     focus management belongs — not in an effect that re-runs on re-render.
 *
 * ---------------------------------------------------------------------------
 * ACCESSIBILITY, WHICH IS MOST OF THE DESIGN HERE
 * ---------------------------------------------------------------------------
 *   - Correctness is never colour alone. A correct clip is a hollow round mark,
 *     an incorrect one is a filled square — different in shape, in fill and in
 *     greyscale — and a visible legend names both states in words.
 *   - Category is carried by which group a mark sits in and by that group's
 *     visible heading, never by a colour. The Ode palette has no four
 *     distinguishable category colours, and inventing some would be worse than
 *     grouping.
 *   - Each mark is a real `<button>` with a sentence for a name
 *     (`describeDot`), not a `<div>` with a click handler.
 *   - 29 marks are **one** tab stop, not 29. The field uses a roving tabindex:
 *     Tab reaches the field, then arrows move between marks — across group
 *     boundaries, because the index is flat — and Home/End jump to the ends.
 *   - `Escape` collapses the panel and returns focus to the mark that opened
 *     it. It is handled on the marks and on the panel's close button, which
 *     are the only focusable things in the island, so no static element needs
 *     a key handler to make it work.
 *   - The confidence bar is decoration; the number beside it is the value.
 *   - No `<video>`: the demo ships no media (see AUTHORING §5 rule 7), so the
 *     clip is represented by a labelled placeholder frame and the clip path is
 *     shown as text. Nothing here pretends to be a player.
 */

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import './EvalDotGrid.css';
import {
  DEFAULT_DETAIL_ITEM_ID,
  MOCK_DATA_NOTICE,
  MOCK_ITEMS,
  describeDot,
  describeItemDetail,
  findItem,
  formatPercent,
  formatSeconds,
  groupByPrediction,
  indexOfItem,
  isCorrect,
  nextDotIndex,
} from './eval-explorer';
import type { EvalItem } from './eval-explorer';

export interface EvalDotGridProps {
  /**
   * The run to draw. Defaults to the built-in mock run; there is only one, and
   * it is deliberately fake.
   */
  items?: readonly EvalItem[];
  /**
   * Which clip's record is open on first render, including during SSR. Defaults
   * to `DEFAULT_DETAIL_ITEM_ID`. An id that is not in the run opens nothing
   * rather than throwing — a post should not be able to break a page with a
   * typo.
   */
  initialItemId?: string;
}

/** The placeholder that stands in for the clip. Decorative: the caption carries the meaning. */
function ClipPlaceholder() {
  return (
    <svg
      className="eval-dots__still-frame"
      viewBox="0 0 160 90"
      role="presentation"
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="159" height="89" rx="4" />
      <path d="M0 90 L160 0" />
      <path d="M0 0 L160 90" />
    </svg>
  );
}

export default function EvalDotGrid({
  items = MOCK_ITEMS,
  initialItemId = DEFAULT_DETAIL_ITEM_ID,
}: EvalDotGridProps) {
  /** The open clip, or `null` when the panel is collapsed. Always a real id or null. */
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    findItem(items, initialItemId) === undefined ? null : initialItemId,
  );

  /**
   * Which mark currently owns the field's single tab stop. It starts on the
   * open clip so that tabbing into the field lands on the mark the panel is
   * already describing, and falls back to the first mark when nothing is open.
   */
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(indexOfItem(items, initialItemId), 0),
  );

  /**
   * The mark elements, by flat index. Written only from ref callbacks and read
   * only from event handlers — never during render.
   */
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const baseId = useId();
  const panelId = `${baseId}-detail`;
  const detailHeadingId = `${baseId}-detail-heading`;
  const legendId = `${baseId}-legend`;

  const groups = groupByPrediction(items);
  const selectedItem = selectedId === null ? undefined : findItem(items, selectedId);
  const detail = selectedItem === undefined ? undefined : describeItemDetail(selectedItem);

  function focusDot(index: number): void {
    dotRefs.current[index]?.focus();
  }

  function collapse(returnFocusTo: number | null): void {
    setSelectedId(null);
    if (returnFocusTo === null) return;
    setFocusIndex(returnFocusTo);
    focusDot(returnFocusTo);
  }

  function onDotKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'Escape') {
      // Focus is already on the mark, so there is nothing to restore.
      if (selectedId !== null) {
        event.preventDefault();
        setSelectedId(null);
      }
      return;
    }

    const next = nextDotIndex(index, event.key, items.length);
    if (next === null) return;

    // Arrows and Home/End would otherwise scroll the page out from under the
    // field while the reader is walking it.
    event.preventDefault();
    setFocusIndex(next);
    focusDot(next);
  }

  return (
    <div className="eval-dots">
      <div className="eval-dots__header">
        <p className="eval-dots__legend" id={legendId}>
          <span className="eval-dots__legend-item">
            <span aria-hidden="true" className="eval-dots__mark eval-dots__mark--correct" />
            Correct — hollow round mark
          </span>
          <span className="eval-dots__legend-item">
            <span aria-hidden="true" className="eval-dots__mark eval-dots__mark--incorrect" />
            Incorrect — filled square mark
          </span>
        </p>
        <p className="eval-dots__badge">
          {MOCK_DATA_NOTICE}
          <span className="visually-hidden">. Every clip below is invented, not client data.</span>
        </p>
      </div>

      <div className="eval-dots__groups">
        {groups.map((group) => {
          const groupHeadingId = `${baseId}-group-${group.category}`;

          return (
            <section
              aria-labelledby={groupHeadingId}
              className="eval-dots__group"
              key={group.category}
            >
              <h4 className="eval-dots__group-title" id={groupHeadingId}>
                Predicted: {group.label}
                <span className="eval-dots__group-count">
                  {group.items.length}
                  <span className="visually-hidden"> clips</span>
                </span>
              </h4>

              <dl className="eval-dots__strip">
                <div className="eval-dots__strip-item">
                  <dt>Precision</dt>
                  <dd>{formatPercent(group.metrics.precision)}</dd>
                </div>
                <div className="eval-dots__strip-item">
                  <dt>Recall</dt>
                  <dd>{formatPercent(group.metrics.recall)}</dd>
                </div>
                <div className="eval-dots__strip-item">
                  <dt>FPR</dt>
                  <dd>{formatPercent(group.metrics.falsePositiveRate)}</dd>
                </div>
                <div className="eval-dots__strip-item">
                  <dt>Latency</dt>
                  <dd>{formatSeconds(group.metrics.meanLatencySeconds)}</dd>
                </div>
              </dl>

              <ul aria-describedby={legendId} className="eval-dots__field">
                {group.items.map((item, indexInGroup) => {
                  const index = group.startIndex + indexInGroup;
                  const correct = isCorrect(item);
                  const isOpen = selectedId === item.id;

                  return (
                    <li className="eval-dots__field-item" key={item.id}>
                      <button
                        aria-controls={panelId}
                        aria-expanded={isOpen}
                        className="eval-dots__dot"
                        onClick={() => {
                          setFocusIndex(index);
                          setSelectedId(isOpen ? null : item.id);
                        }}
                        onKeyDown={(event) => {
                          onDotKeyDown(event, index);
                        }}
                        ref={(element) => {
                          dotRefs.current[index] = element;
                        }}
                        tabIndex={index === focusIndex ? 0 : -1}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={
                            correct
                              ? 'eval-dots__mark eval-dots__mark--correct'
                              : 'eval-dots__mark eval-dots__mark--incorrect'
                          }
                        />
                        <span className="visually-hidden">{describeDot(item)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/*
        The panel is inline and always present in the DOM — it is what
        `aria-controls` on every mark points at, and it expands the page rather
        than floating over it, so it works at 320px without a scroll trap.
      */}
      <section
        aria-labelledby={detail === undefined ? undefined : detailHeadingId}
        className="eval-dots__detail"
        id={panelId}
      >
        {detail === undefined ? (
          <p className="eval-dots__detail-empty">
            No clip open. Choose any mark above to expand that clip&rsquo;s full record — caption,
            labels, confidence, objects, latency and cost.
          </p>
        ) : (
          <>
            <div className="eval-dots__detail-head">
              <h4 className="eval-dots__detail-title" id={detailHeadingId}>
                Clip {detail.item.id}
              </h4>
              <button
                className="eval-dots__close"
                onClick={() => {
                  collapse(indexOfItem(items, detail.item.id));
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  collapse(indexOfItem(items, detail.item.id));
                }}
                type="button"
              >
                Close<span className="visually-hidden"> clip {detail.item.id}</span>
              </button>
            </div>

            <div className="eval-dots__detail-body">
              <figure className="eval-dots__still">
                <ClipPlaceholder />
                <figcaption className="eval-dots__still-caption">
                  Placeholder frame. This recreation ships no video — the clip path below is what
                  the real tool would load.
                </figcaption>
              </figure>

              <dl className="eval-dots__facts">
                <div className="eval-dots__fact">
                  <dt>Predicted output</dt>
                  <dd>
                    <span className="eval-dots__pill">{detail.item.predicted}</span>
                  </dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Ground truth</dt>
                  <dd>
                    <span className="eval-dots__pill">{detail.item.actual}</span>
                  </dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Result</dt>
                  <dd>
                    <span
                      className={
                        detail.correct
                          ? 'eval-dots__pill eval-dots__pill--correct'
                          : 'eval-dots__pill eval-dots__pill--incorrect'
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          detail.correct
                            ? 'eval-dots__mark eval-dots__mark--correct'
                            : 'eval-dots__mark eval-dots__mark--incorrect'
                        }
                      />
                      {detail.resultLabel}
                    </span>
                  </dd>
                </div>
                <div className="eval-dots__fact eval-dots__fact--wide">
                  <dt>Model caption</dt>
                  <dd>{detail.item.caption}</dd>
                </div>
                <div className="eval-dots__fact eval-dots__fact--wide">
                  <dt>Objects detected</dt>
                  <dd>{detail.objectsLabel}</dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Latency</dt>
                  <dd className="eval-dots__figure">{detail.latencyLabel}</dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Cost</dt>
                  <dd className="eval-dots__figure">{detail.costLabel}</dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Confidence</dt>
                  <dd className="eval-dots__figure">
                    {/* The bar is decoration; this number is the value. */}
                    <span aria-hidden="true" className="eval-dots__meter">
                      <span
                        className="eval-dots__meter-fill"
                        style={{ inlineSize: `${detail.confidencePercent}%` }}
                      />
                    </span>
                    {detail.confidenceLabel}
                  </dd>
                </div>
                <div className="eval-dots__fact">
                  <dt>Classified at</dt>
                  <dd>{detail.classifiedAt}</dd>
                </div>
                <div className="eval-dots__fact eval-dots__fact--wide">
                  <dt>Video path</dt>
                  <dd className="eval-dots__path">{detail.item.videoPath}</dd>
                </div>
              </dl>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
