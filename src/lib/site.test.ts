import { describe, expect, it } from 'vitest';

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
