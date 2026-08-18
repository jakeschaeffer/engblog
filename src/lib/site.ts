/**
 * Site-wide constants.
 *
 * This is the single place to change publication identity strings. Anything
 * that appears in <head>, in RSS, in JSON-LD, or in chrome should read from
 * here rather than hard-coding a string in a component.
 *
 * Brand *visuals* (colour, type, spacing) live in `src/styles/global.css`.
 * Brand *text* lives here.
 */

/**
 * Canonical origin for the deployed site.
 *
 * Resolution order:
 *   1. `SITE_URL` env var (set this in Vercel for production and previews).
 *   2. `http://localhost:4321` — Astro's dev server default.
 *
 * `astro.config.mjs` performs the identical resolution for `Astro.site`. The
 * duplication is deliberate: the config file runs in plain Node before the
 * Astro runtime exists, so it cannot import modules that touch `astro:*`.
 *
 * Note the env access pattern: `import.meta.env` is what Astro exposes to
 * runtime code, and it inlines any `SITE_URL` present at build time.
 */
const RAW_SITE_URL: string =
  import.meta.env['SITE_URL'] ?? process.env['SITE_URL'] ?? 'http://localhost:4321';

/** Origin with no trailing slash, e.g. `https://ode.example.com`. */
export const SITE_URL: string = RAW_SITE_URL.replace(/\/+$/, '');

/**
 * Base path the publication is mounted at.
 *
 * The engineering publication is a section of a larger marketing site (the
 * Webflow property), so posts live under `/engineering/`, not at the root.
 * Always includes a leading and trailing slash.
 */
export const BASE_PATH = '/engineering/' as const;

/**
 * The organisation that publishes this site.
 *
 * Always title-case "Ode" in prose. The all-caps spelling exists only inside
 * the logo artwork and must never be typed as text.
 *
 * This is deliberately separate from `SITE_NAME`: `SITE_NAME` is the
 * *publication*, `BRAND_NAME` is the *company*. Use this one for the
 * copyright line, `og:site_name`, and the structured-data / RSS publisher —
 * anywhere the answer to "who is behind this?" is the company.
 */
export const BRAND_NAME = 'Ode' as const;

/**
 * Publication title. Used as the page title and the `<h1>` of the index.
 *
 * Just "Engineering". The site is mounted at `/engineering/` under the Ode
 * property and the header already carries the Ode lockup, so repeating the
 * company name in the title only makes every browser tab longer.
 */
export const SITE_NAME = 'Engineering' as const;

/** One-line description. Used as the default meta description and RSS channel description. */
export const SITE_DESCRIPTION =
  'Engineering notes, architecture decisions, and build logs from the team at Ode.' as const;

/**
 * Default social preview image, resolved against SITE_URL when emitted.
 *
 * Must stay a raster format at 1200x630. Social crawlers (X, LinkedIn, Slack,
 * Facebook, iMessage) silently render nothing for an SVG `og:image`. The PNG is
 * generated from `public/images/og-default.svg`; see `docs/images.md`.
 */
export const DEFAULT_OG_IMAGE = '/images/og-default.png' as const;

/**
 * Used when a post omits an author, or when an author entry omits a role.
 *
 * The byline falls back to the company, not the publication: an unattributed
 * post is written by Ode, and "Engineering" is the role that follows it.
 */
export const DEFAULT_AUTHOR = {
  name: BRAND_NAME,
  role: 'Engineering',
} as const;

/** Path to the RSS feed, for `<link rel="alternate">` and footer links. */
export const RSS_PATH = '/rss.xml' as const;

/** Language tag emitted on `<html lang>` and in RSS. */
export const SITE_LANG = 'en' as const;

/**
 * Whether this build should be indexed by search engines.
 *
 * Rule: only the production Vercel deployment is indexable. Preview deploys,
 * branch deploys and local builds all emit `noindex, nofollow` so that
 * half-finished drafts never compete with the real URLs in search results.
 *
 * `VERCEL_ENV` is injected by Vercel and is one of 'production' | 'preview' |
 * 'development'. When it is absent entirely (local `astro build`) we treat the
 * build as non-production.
 */
const VERCEL_ENV: string | undefined =
  import.meta.env['VERCEL_ENV'] ?? process.env['VERCEL_ENV'] ?? undefined;

export const IS_PRODUCTION_DEPLOY: boolean = VERCEL_ENV === 'production';

/** Resolve a site-relative path to an absolute URL string. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/**
 * Canonical path for a post slug, e.g. `/engineering/my-post/`.
 *
 * **The trailing slash is deliberate and load-bearing.** `astro build` uses
 * the default `directory` output format, so a post is emitted as
 * `dist/engineering/my-post/index.html` and `@astrojs/sitemap` — which derives
 * its entries from the pages that were actually emitted — lists it as
 * `…/engineering/my-post/`. Anything built from this helper (canonical link,
 * `og:url`, JSON-LD `url`, RSS `<link>`, every internal link) therefore agrees
 * with the sitemap byte for byte.
 *
 * Without the slash the site would advertise two spellings of one URL — the
 * sitemap saying one thing and every other signal saying another — which is a
 * self-inflicted duplicate-content problem. `BASE_PATH` already ends in a
 * slash, so the trailing-slash form is also the internally consistent one.
 *
 * Note that `trailingSlash` is left at Astro's default (`'ignore'`): both
 * spellings still *resolve*, so an existing inbound link to the slashless form
 * keeps working. Only what we emit is normalised.
 */
export function postPath(slug: string): string {
  return `${BASE_PATH}${slug}/`;
}
