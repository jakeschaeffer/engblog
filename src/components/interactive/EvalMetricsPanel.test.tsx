// @vitest-environment jsdom
/**
 * Component tests for the metrics island.
 *
 * The docblock above is what puts this file in a DOM — `vitest.config.ts`
 * defaults to the `node` environment so the pure-logic suites stay fast, and
 * each component test opts in. `globals: false` means Testing Library's
 * automatic cleanup never registers, so this file does it explicitly.
 *
 * These tests are about the *component's* job: wiring the pure module to
 * markup, keeping state, and staying accessible. The arithmetic behind every
 * figure is covered in `eval-explorer.test.ts` and is not re-tested here.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import EvalMetricsPanel from './EvalMetricsPanel';
import { CLIPS_PER_SUBSCRIBER_MAX } from './eval-explorer';

afterEach(() => {
  cleanup();
});

/** The cells of one row, by the row's visible header. */
function cellsOf(rowName: RegExp): string[] {
  const row = screen.getByRole('row', { name: rowName });
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('EvalMetricsPanel — structure', () => {
  it('renders a summary row and one row per detection category', () => {
    render(<EvalMetricsPanel />);

    expect(screen.getByRole('rowheader', { name: 'Overall' })).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'Person' })).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'Vehicle' })).toBeDefined();
    expect(screen.getByRole('rowheader', { name: 'Animal' })).toBeDefined();
    // Four body rows plus the header row.
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });

  it('spells out every abbreviated column header for assistive technology', () => {
    render(<EvalMetricsPanel />);

    for (const name of [
      'Projected dollars per subscriber per month',
      'Precision',
      'Recall',
      'False positive rate',
      'Mean latency',
      'Mean cost per clip',
      'Mean cost per clip with activity',
      'Mean cost per clip with no activity',
    ]) {
      expect(screen.getByRole('columnheader', { name })).toBeDefined();
    }
  });

  it('shows the run figures on the summary row', () => {
    render(<EvalMetricsPanel />);

    expect(cellsOf(/^Overall/)).toStrictEqual([
      '$3.57',
      '80.0%',
      '76.0%',
      '4.6%',
      '2.1s',
      '$0.0024',
      '$0.0030',
      '$0.0009',
    ]);
  });

  it('says "not applicable" rather than leaving a bare dash on category rows', () => {
    render(<EvalMetricsPanel />);

    const person = screen.getByRole('row', { name: /^Person/ });
    const empties = within(person).getAllByText('Not applicable');

    expect(empties).toHaveLength(2);
  });

  it('says out loud that the data is invented', () => {
    render(<EvalMetricsPanel />);

    expect(screen.getByText(/Mock data/)).toBeDefined();
    expect(screen.getByText(/not from client data/)).toBeDefined();
  });

  it('emits no heading above h4, because the demo shell owns the h3', () => {
    render(<EvalMetricsPanel />);

    for (const level of [1, 2, 3]) {
      expect(screen.queryAllByRole('heading', { level })).toHaveLength(0);
    }
    expect(screen.getAllByRole('heading', { level: 4 }).length).toBeGreaterThan(0);
  });
});

describe('EvalMetricsPanel — the projection control', () => {
  it('starts at the default volume in both controls', () => {
    render(<EvalMetricsPanel />);

    expect(screen.getByLabelText('Clips per subscriber per month')).toHaveProperty('value', '1500');
    expect(screen.getByLabelText('Clips per subscriber per month, exact value')).toHaveProperty(
      'value',
      '1500',
    );
  });

  it('moves the projection when the slider moves', () => {
    render(<EvalMetricsPanel />);
    const slider = screen.getByLabelText('Clips per subscriber per month');

    fireEvent.change(slider, { target: { value: '3000' } });

    expect(cellsOf(/^Overall/)[0]).toBe('$7.14');
    expect(screen.getByText(/projects/).textContent).toContain('$7.14');
  });

  it('moves the projection when the number is typed', async () => {
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '1000');

    expect(cellsOf(/^Overall/)[0]).toBe('$2.38');
  });

  it('leaves every other column alone when the volume changes', () => {
    render(<EvalMetricsPanel />);
    const before = cellsOf(/^Overall/).slice(1);

    fireEvent.change(screen.getByLabelText('Clips per subscriber per month'), {
      target: { value: '4500' },
    });

    expect(cellsOf(/^Overall/).slice(1)).toStrictEqual(before);
  });

  it('clamps an out-of-range number and says so in words', async () => {
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '99999');

    expect(screen.getByText(/Adjusted:/)).toBeDefined();
    expect(screen.getByText(/projects/).textContent).toContain(String(CLIPS_PER_SUBSCRIBER_MAX));
  });

  it('says so before blur when the step grid moved an in-range number', async () => {
    // 1234 is inside the range and still is not what the projection is computed
    // from — the step rounds it to 1250. A range-only check misses this, and the
    // field still reads 1234 until it is blurred, so without a notice the reader
    // sees a projection built on a number nothing on screen shows.
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '1234');

    expect(field).toHaveProperty('value', '1234');
    const notice = screen.getByText(/^Adjusted:/);
    expect(notice.textContent).toContain('1234');
    expect(notice.textContent).toContain('1250');
    expect(screen.getByText(/projects/).textContent).toContain('1250');
  });

  it('shows no notice for a value the control can actually take', async () => {
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '1250');

    expect(screen.queryByText(/^Adjusted:/)).toBeNull();
  });

  it('announces the adjustment, rather than only showing it', async () => {
    // It appears and disappears while focus stays in the number field, so a
    // screen-reader user hears about it only if it is inside a live region.
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '1234');

    expect(
      screen
        .getByText(/^Adjusted:/)
        .closest('[aria-live]')
        ?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('normalises the number field on blur so the two controls agree', async () => {
    const user = userEvent.setup();
    render(<EvalMetricsPanel />);
    const field = screen.getByLabelText('Clips per subscriber per month, exact value');

    await user.clear(field);
    await user.type(field, '1234');
    await user.tab();

    expect(field).toHaveProperty('value', '1250');
  });

  it('clamps a prop the same way it clamps a keystroke', () => {
    render(<EvalMetricsPanel initialClipsPerSubscriber={-40} />);

    expect(screen.getByLabelText('Clips per subscriber per month')).toHaveProperty('value', '100');
  });

  it('announces the projection politely rather than re-announcing the table', () => {
    render(<EvalMetricsPanel />);
    const live = screen.getByText(/projects/);

    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('table').getAttribute('aria-live')).toBeNull();
  });

  it('makes the sideways scroller reachable and named, not a pointer-only affordance', () => {
    // The wrapper scrolls and holds nothing focusable, so without a tab stop the
    // right-hand columns are unreachable by keyboard (WCAG 2.1.1). The caption
    // is what stops that tab stop from announcing as an unnamed region.
    render(<EvalMetricsPanel />);
    const region = screen.getByRole('region', { name: /Detection quality across 29 mock clips/ });

    expect(region.className).toContain('eval-metrics__table-wrap');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('table')).toBeDefined();
  });
});
