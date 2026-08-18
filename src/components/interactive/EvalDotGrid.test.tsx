// @vitest-environment jsdom
/**
 * Component tests for the dot-layer island.
 *
 * The docblock above puts this file in a DOM; see `vitest.config.ts`. Most of
 * what is checked here is behaviour that only exists in a browser — focus
 * order, keyboard navigation, what `Escape` does — which is exactly the part
 * that used to be untestable in this repo and is exactly the part most likely
 * to regress silently.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import EvalDotGrid from './EvalDotGrid';
import { DEFAULT_DETAIL_ITEM_ID, MOCK_ITEMS } from './eval-explorer';

afterEach(() => {
  cleanup();
});

/** Every mark in the field, in navigation order. */
function dots(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /^Clip evt-mock-/ });
}

/** The mark for one clip id. */
function dotFor(id: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Clip ${id}:`) });
}

/** The detail panel, whether it is showing a clip or the empty prompt. */
function panel(): HTMLElement {
  const region = document.querySelector('.eval-dots__detail');
  if (region === null) throw new Error('the detail panel is missing');
  return region as HTMLElement;
}

describe('EvalDotGrid — the field', () => {
  it('draws one mark per clip in the run', () => {
    render(<EvalDotGrid />);
    expect(dots()).toHaveLength(29);
    expect(dots()).toHaveLength(MOCK_ITEMS.length);
  });

  it('gives every mark a sentence for a name, not just "button"', () => {
    render(<EvalDotGrid />);
    const names = dots().map((dot) => dot.getAttribute('aria-label') ?? dot.textContent ?? '');

    expect(names[0]).toBe('Clip evt-mock-0001: predicted Person, ground truth Person, correct');
    expect(names[5]).toBe('Clip evt-mock-0006: predicted Person, ground truth Animal, incorrect');
    expect(new Set(names).size).toBe(29);
  });

  it('groups the marks by predicted category, with counts and a metric strip', () => {
    render(<EvalDotGrid />);

    const person = screen.getByRole('region', { name: /Predicted: Person/ });
    expect(within(person).getAllByRole('button', { name: /^Clip evt-mock-/ })).toHaveLength(6);
    expect(within(person).getByText('83.3%')).toBeDefined();

    expect(
      within(screen.getByRole('region', { name: /Predicted: Vehicle/ })).getAllByRole('button', {
        name: /^Clip evt-mock-/,
      }),
    ).toHaveLength(10);
    expect(
      within(screen.getByRole('region', { name: /Predicted: Animal/ })).getAllByRole('button', {
        name: /^Clip evt-mock-/,
      }),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole('region', { name: /Predicted: None/ })).getAllByRole('button', {
        name: /^Clip evt-mock-/,
      }),
    ).toHaveLength(10);
  });

  it('names both states of the legend in words, not only in shape and colour', () => {
    render(<EvalDotGrid />);

    expect(screen.getByText(/Correct — hollow round mark/)).toBeDefined();
    expect(screen.getByText(/Incorrect — filled square mark/)).toBeDefined();
  });

  it('says out loud that the run is invented', () => {
    render(<EvalDotGrid />);
    expect(screen.getByText(/not client data/)).toBeDefined();
  });

  it('emits no heading above h4, because the demo shell owns the h3', () => {
    render(<EvalDotGrid />);

    for (const level of [1, 2, 3]) {
      expect(screen.queryAllByRole('heading', { level })).toHaveLength(0);
    }
  });
});

describe('EvalDotGrid — the detail panel', () => {
  it('opens on a clip before anyone interacts, so the static HTML is not empty', () => {
    render(<EvalDotGrid />);

    expect(screen.getByRole('heading', { name: `Clip ${DEFAULT_DETAIL_ITEM_ID}` })).toBeDefined();
    expect(dotFor(DEFAULT_DETAIL_ITEM_ID).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows everything the post promises about a clip', () => {
    render(<EvalDotGrid />);
    const detail = within(panel());

    expect(
      detail.getByText('An upright figure moves along the fence line in low light.'),
    ).toBeDefined();
    expect(detail.getByText('person, fence')).toBeDefined();
    expect(detail.getByText('2.55s')).toBeDefined();
    expect(detail.getByText('92.5%')).toBeDefined();
    expect(detail.getByText('$0.0030')).toBeDefined();
    expect(detail.getByText('VLM Classifier')).toBeDefined();
    expect(detail.getByText('s3://rosie-mock-videos/eval-ui-mockup/0006.mp4')).toBeDefined();
    expect(detail.getByText('Incorrect')).toBeDefined();
  });

  it('shows a labelled placeholder instead of a video element', () => {
    render(<EvalDotGrid />);

    expect(panel().querySelector('video')).toBeNull();
    expect(screen.getByText(/This recreation ships no video/)).toBeDefined();
  });

  it('opens the clip whose mark was activated', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);

    await user.click(dotFor('evt-mock-0013'));

    expect(screen.getByRole('heading', { name: 'Clip evt-mock-0013' })).toBeDefined();
    expect(dotFor('evt-mock-0013').getAttribute('aria-expanded')).toBe('true');
    expect(dotFor(DEFAULT_DETAIL_ITEM_ID).getAttribute('aria-expanded')).toBe('false');
    expect(within(panel()).getByText(/Headlights sweep across the garage wall/)).toBeDefined();
  });

  it('collapses when the open mark is activated again', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);

    await user.click(dotFor(DEFAULT_DETAIL_ITEM_ID));

    expect(screen.getByText(/No clip open/)).toBeDefined();
    expect(dotFor(DEFAULT_DETAIL_ITEM_ID).getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses on Escape from the mark, leaving focus where it was', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    const dot = dotFor(DEFAULT_DETAIL_ITEM_ID);
    dot.focus();

    await user.keyboard('{Escape}');

    expect(screen.getByText(/No clip open/)).toBeDefined();
    expect(document.activeElement).toBe(dot);
  });

  it('collapses on Escape from inside the panel and returns focus to the mark that opened it', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);

    await user.click(dotFor('evt-mock-0019'));
    const close = screen.getByRole('button', { name: /^Close/ });
    close.focus();
    await user.keyboard('{Escape}');

    expect(screen.getByText(/No clip open/)).toBeDefined();
    expect(document.activeElement).toBe(dotFor('evt-mock-0019'));
  });

  it('returns focus to the originating mark when the close button is used', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);

    await user.click(dotFor('evt-mock-0024'));
    await user.click(screen.getByRole('button', { name: /^Close/ }));

    expect(screen.getByText(/No clip open/)).toBeDefined();
    expect(document.activeElement).toBe(dotFor('evt-mock-0024'));
  });

  it('opens nothing, and does not throw, for an id that is not in the run', () => {
    render(<EvalDotGrid initialItemId="evt-mock-nope" />);

    expect(screen.getByText(/No clip open/)).toBeDefined();
    expect(dots()).toHaveLength(29);
  });

  it('keeps the panel in the DOM when collapsed, so aria-controls always resolves', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    const controls = dots()[0]?.getAttribute('aria-controls');

    await user.click(dotFor(DEFAULT_DETAIL_ITEM_ID));

    expect(controls).toBeTruthy();
    expect(document.getElementById(controls ?? '')).not.toBeNull();
  });
});

describe('EvalDotGrid — keyboard navigation', () => {
  it('is a single tab stop, not 29', () => {
    render(<EvalDotGrid />);
    const tabbable = dots().filter((dot) => dot.getAttribute('tabindex') === '0');

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(dotFor(DEFAULT_DETAIL_ITEM_ID));
  });

  it('starts the tab stop on the first mark when nothing is open', () => {
    render(<EvalDotGrid initialItemId="evt-mock-nope" />);

    expect(dots()[0]?.getAttribute('tabindex')).toBe('0');
  });

  it('moves focus with the arrow keys and carries the tab stop along', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    dots()[0]?.focus();

    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(dotFor('evt-mock-0002'));
    expect(dotFor('evt-mock-0002').getAttribute('tabindex')).toBe('0');
    expect(dotFor('evt-mock-0001').getAttribute('tabindex')).toBe('-1');
  });

  it('walks out of one group and into the next', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    // The last mark of the Person group.
    dotFor('evt-mock-0006').focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0007'));

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0006'));
  });

  it('wraps around both ends of the field', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    dotFor('evt-mock-0029').focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0001'));

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0029'));
  });

  it('treats the vertical arrows as the same sequence', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    dotFor('evt-mock-0010').focus();

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0011'));

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0010'));
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    dotFor('evt-mock-0015').focus();

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0029'));

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(dotFor('evt-mock-0001'));
  });

  it('opens a clip from the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<EvalDotGrid />);
    dots()[0]?.focus();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Clip evt-mock-0003' })).toBeDefined();
  });
});
