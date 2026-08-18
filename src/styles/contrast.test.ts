import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Contrast regression guard for the Ode brand palette.
 *
 * `npm run verify` can catch a broken type, a broken build and a broken URL,
 * but nothing in it could catch someone nudging a colour token until text stops
 * being readable. This closes that gap.
 *
 * The values are read out of `global.css` rather than copied here on purpose:
 * a duplicated palette would drift, and a test that passes against a stale copy
 * of the palette is worse than no test. If a token is renamed or deleted, this
 * file fails loudly instead of silently checking nothing.
 */

const CSS_PATH = fileURLToPath(new URL('./global.css', import.meta.url));
const CSS = readFileSync(CSS_PATH, 'utf8');

/**
 * Every `--color-*: #hex` declaration in the stylesheet, as a lookup.
 *
 * Only full six-digit hex is matched, which is the form the token block uses.
 * A token written some other way (a colour function, a `var()` alias) will be
 * absent, and the lookup below throws rather than skipping it.
 */
function readColorTokens(css: string): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  const pattern = /(--color-[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g;

  for (const match of css.matchAll(pattern)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens.set(name, value.toLowerCase());
  }

  return tokens;
}

const TOKENS = readColorTokens(CSS);

function token(name: string): string {
  const value = TOKENS.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not defined as a six-digit hex in src/styles/global.css`);
  }
  return value;
}

/** WCAG 2.x relative luminance of an sRGB colour. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const srgb = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.x contrast ratio, 1 to 21. Order of arguments does not matter. */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounded down, so a value that only reaches the threshold by rounding fails. */
function ratioOf(foreground: string, background: string): number {
  return Math.floor(contrastRatio(token(foreground), token(background)) * 100) / 100;
}

/** WCAG AA for body-size text. */
const AA_TEXT = 4.5;
/** WCAG AA for a non-text UI boundary: borders, rules, focus rings. */
const AA_NON_TEXT = 3;

/**
 * Every ground a colour can land on. Tea (`--color-surface-sunken`) is the
 * darkest of the three and is therefore the binding constraint every time.
 */
const GROUNDS = ['--color-bg', '--color-surface', '--color-surface-sunken'] as const;

/** Tokens that are set as text and may appear on any of the three grounds. */
const TEXT_TOKENS = [
  '--color-text',
  '--color-text-muted',
  '--color-text-subtle',
  '--color-success',
  '--color-warning',
] as const;

/**
 * Tomato, in its two roles.
 *
 * Tomato is 4.71:1 on Bone and 4.88:1 on white — AA as text on both, and
 * Tomato+Bone is an approved brand pairing. On Tea it is 4.02:1, which is why
 * global.css routes accent-coloured text on the sunken ground to
 * `--color-accent-hover` instead (`a code`, and LinkCard's hover state). What
 * legitimately remains on Tea is Tomato as a *line*: the focus ring, which
 * only owes 3:1.
 */
const TOMATO_TOKENS = ['--color-accent', '--color-danger'] as const;

describe('palette tokens', () => {
  it('defines every token the site depends on', () => {
    const required = [
      ...GROUNDS,
      ...TEXT_TOKENS,
      ...TOMATO_TOKENS,
      '--color-text-inverse',
      '--color-border',
      '--color-border-strong',
      '--color-accent-hover',
      '--color-accent-subtle',
      '--color-selection-bg',
      '--color-selection-text',
    ];

    for (const name of required) expect(() => token(name)).not.toThrow();
  });

  /**
   * The brand guide sanctions no dark theme and approves no text-on-dark
   * pairing, so the site is light-only. A reintroduced `prefers-color-scheme`
   * block would ship a palette nothing in this file measures. (The stylesheet
   * mentions the feature by name in prose, so this matches the `@media` query
   * itself rather than the string.)
   */
  it('ships no dark theme', () => {
    expect(CSS).not.toMatch(/@media[^{]*prefers-color-scheme/);
  });
});

describe('text contrast (WCAG AA, 4.5:1)', () => {
  for (const fg of TEXT_TOKENS) {
    for (const bg of GROUNDS) {
      it(`${fg} on ${bg}`, () => {
        expect(ratioOf(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  /**
   * `--color-text-subtle` deliberately resolves to the same Dove as
   * `--color-text-muted`: the palette has one supporting-text colour, and the
   * guide's quieter treatment fails AA. If someone lightens one of them to
   * restore a visible difference, the loop above catches it — this pins the
   * intent so the reason is in the test output too.
   */
  it('keeps --color-text-subtle on the one supporting-text colour', () => {
    expect(token('--color-text-subtle')).toBe(token('--color-text-muted'));
  });
});

describe('accent contrast', () => {
  for (const fg of TOMATO_TOKENS) {
    it(`${fg} is AA text on --color-bg and --color-surface`, () => {
      expect(ratioOf(fg, '--color-bg')).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratioOf(fg, '--color-surface')).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${fg} still clears the non-text floor on --color-surface-sunken`, () => {
      expect(ratioOf(fg, '--color-surface-sunken')).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  }

  /**
   * The darkened accent is what carries accent-coloured *text* wherever Tomato
   * itself cannot: on Tea, and on the Lilac wash under the root CTA's hover.
   */
  it('--color-accent-hover is AA text on every ground and on the accent wash', () => {
    for (const bg of [...GROUNDS, '--color-accent-subtle']) {
      expect(ratioOf('--color-accent-hover', bg)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  /** Bone on Tomato — the reversed-out pairing the guide approves. */
  it('--color-text-inverse is AA text on --color-accent', () => {
    expect(ratioOf('--color-text-inverse', '--color-accent')).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('non-text contrast', () => {
  /**
   * `--color-border-strong` is an emphasised edge and the colour of the small
   * decorative separators between metadata items. It owes 3:1, not 4.5:1 — and
   * it must stay under the text tokens, or it stops reading as a rule.
   */
  it('--color-border-strong reads as a line on every ground', () => {
    for (const bg of GROUNDS) {
      expect(ratioOf('--color-border-strong', bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
    expect(ratioOf('--color-border-strong', '--color-bg')).toBeLessThan(
      ratioOf('--color-text-muted', '--color-bg'),
    );
  });

  it('selected text is readable on the selection ground', () => {
    expect(ratioOf('--color-selection-text', '--color-selection-bg')).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});
