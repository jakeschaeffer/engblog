import { afterEach, describe, expect, it, vi } from 'vitest';

import { BASE_PATH, DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl, postPath } from '@/lib/site';

describe('postPath', () => {
  it('mounts a post under BASE_PATH', () => {
    expect(postPath('my-post')).toBe('/engineering/my-post/');
  });

  /**
   * The site publishes exactly one spelling of a post URL, and it is the
   * trailing-slash one. `astro build` uses the default `directory` output
   * format, so a post is emitted as `engineering/<slug>/index.html` and
   * `@astrojs/sitemap` — which reads the pages that were actually emitted —
   * lists it with a trailing slash. Canonical, `og:url`, JSON-LD `url`, the RSS
   * `<link>` and every internal link are all built from this helper, so
   * dropping the slash here would put the sitemap into disagreement with every
   * other signal the site sends: two candidate URLs for one page.
   */
  it('ends with a trailing slash, matching the sitemap', () => {
    expect(postPath('my-post').endsWith('/')).toBe(true);
  });

  it('agrees with BASE_PATH about the separator (no doubled slash)', () => {
    expect(BASE_PATH.endsWith('/')).toBe(true);
    expect(postPath('my-post')).not.toMatch(/\/\//);
  });
});

describe('absoluteUrl', () => {
  it('resolves a site-relative path against SITE_URL', () => {
    expect(absoluteUrl('/rss.xml')).toBe(`${SITE_URL}/rss.xml`);
  });

  it('preserves the trailing slash of a post path', () => {
    expect(absoluteUrl(postPath('my-post'))).toBe(`${SITE_URL}/engineering/my-post/`);
  });
});

describe('DEFAULT_OG_IMAGE', () => {
  /**
   * Social crawlers (X, LinkedIn, Slack, Facebook, iMessage) do not render an
   * SVG `og:image`, and they fail silently: the preview is blank rather than
   * broken. The default has to stay a raster at 1200x630.
   */
  it('is a raster image, not a vector one', () => {
    expect(DEFAULT_OG_IMAGE).toMatch(/\.(png|jpg|jpeg)$/);
  });
});

/**
 * `SHOW_DRAFTS` and `IS_PRODUCTION_DEPLOY` are both resolved once, at module
 * evaluation, from `import.meta.env` — so a static import would only ever
 * observe the test runner's own environment. Stubbing the environment and then
 * re-importing the module (after `vi.resetModules()` drops the cached copy) is
 * what lets this assert the real wiring rather than restating the predicate.
 *
 * The predicate itself is tested directly in `env-utils.test.ts`; what is under
 * test here is that `site.ts` feeds it the right two inputs.
 */
async function loadSite(env: { dev: boolean; vercelEnv?: string }) {
  vi.stubEnv('DEV', env.dev);
  if (env.vercelEnv !== undefined) vi.stubEnv('VERCEL_ENV', env.vercelEnv);
  vi.resetModules();
  return import('@/lib/site');
}

describe('SHOW_DRAFTS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is false on a production Vercel deploy — the one build that hides drafts', async () => {
    const site = await loadSite({ dev: false, vercelEnv: 'production' });
    expect(site.SHOW_DRAFTS).toBe(false);
    expect(site.IS_PRODUCTION_DEPLOY).toBe(true);
  });

  it('is true on a preview deploy, which is how drafts get reviewed', async () => {
    const site = await loadSite({ dev: false, vercelEnv: 'preview' });
    expect(site.SHOW_DRAFTS).toBe(true);
    expect(site.IS_PRODUCTION_DEPLOY).toBe(false);
  });

  it('is true on the dev server', async () => {
    const site = await loadSite({ dev: true, vercelEnv: 'development' });
    expect(site.SHOW_DRAFTS).toBe(true);
  });

  /**
   * The pairing that matters: nothing can be both indexable and draft-bearing.
   * A build that emits `index, follow` must not have built a draft.
   */
  it('never coincides with an indexable build', async () => {
    for (const vercelEnv of ['production', 'preview', 'development']) {
      const site = await loadSite({ dev: false, vercelEnv });
      expect(site.SHOW_DRAFTS && site.IS_PRODUCTION_DEPLOY).toBe(false);
      vi.unstubAllEnvs();
    }
  });
});
