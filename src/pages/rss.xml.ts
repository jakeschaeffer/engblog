/**
 * `/rss.xml` — the publication feed.
 *
 * Built from `getPublishedPosts()`, so drafts are absent by construction and
 * the ordering is the same newest-first ordering the index uses.
 *
 * ## Why the feed carries no full post content
 *
 * `@astrojs/rss` can put HTML in `<content:encoded>`, but our posts are MDX:
 * they import Astro components, mount a React island and rely on the site's
 * stylesheet for code blocks and callouts. Serialising that to feed-safe HTML
 * means either rendering each post through the Astro pipeline and shipping
 * markup whose components are missing (a demo shell with no demo, a callout
 * with no styling) or hand-writing a second renderer that will drift from the
 * first. Half-rendered markup in a feed reader is worse than none: it looks
 * broken rather than deliberately brief.
 *
 * So each item carries the title, the frontmatter description and a link to
 * the real page — which is where the article works properly. If full-text
 * items are wanted later, the honest way to do it is a plain-Markdown
 * rendering path that deliberately drops components, not a best-effort
 * serialisation of the component tree.
 */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';

import { getPublishedPosts } from '@/lib/posts';
import {
  BRAND_NAME,
  SITE_DESCRIPTION,
  SITE_LANG,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  postPath,
} from '@/lib/site';

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  return rss({
    // A feed title is read standalone, in a reader listing full of other
    // feeds, so this is the one place the publication is qualified by the
    // company that publishes it.
    title: `${SITE_NAME} — ${BRAND_NAME}`,
    description: SITE_DESCRIPTION,
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      // Absolute, and built from the same helpers the pages use, so a feed
      // link can never disagree with the canonical URL of the post.
      link: absoluteUrl(postPath(post.id)),
    })),
    customData: `<language>${SITE_LANG}</language>`,
  });
};
