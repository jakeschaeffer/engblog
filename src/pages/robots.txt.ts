/**
 * `/robots.txt`
 *
 * Mirrors the indexing rule that `BaseLayout` applies with `<meta name="robots">`:
 * only the production Vercel deployment is indexable. `IS_PRODUCTION_DEPLOY` is
 * derived from `VERCEL_ENV === 'production'` in `@/lib/site`, so preview
 * deploys, branch deploys and local builds all fall into the disallow branch.
 *
 * The two mechanisms are complementary rather than redundant: `robots.txt`
 * stops a crawler fetching a preview URL at all, while the meta tag covers a
 * URL that was reached some other way (a shared link, a referrer). They must
 * agree — a `Disallow` here plus an `index` meta tag would be an instruction a
 * crawler could not act on, because it would never read the tag.
 *
 * Note that `Disallow: /` is a crawl instruction, not a guarantee of
 * de-indexing; the `noindex` meta tag is what actually keeps preview URLs out
 * of a results page. That is why both exist.
 *
 * The sitemap is only advertised on production, where the URLs it lists are
 * the canonical ones. `sitemap-index.xml` is the entry point emitted by
 * `@astrojs/sitemap`; it points at the numbered `sitemap-N.xml` files.
 */
import type { APIRoute } from 'astro';

import { IS_PRODUCTION_DEPLOY, absoluteUrl } from '@/lib/site';

const PRODUCTION_RULES = `# Production deploy: everything here is canonical and indexable.
User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap-index.xml')}
`;

const NON_PRODUCTION_RULES = `# Non-production deploy (preview, branch, or local build).
# These URLs duplicate production content and may contain drafts, so they are
# not for crawling. See src/lib/site.ts -> IS_PRODUCTION_DEPLOY.
User-agent: *
Disallow: /
`;

export const GET: APIRoute = () =>
  new Response(IS_PRODUCTION_DEPLOY ? PRODUCTION_RULES : NON_PRODUCTION_RULES, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
