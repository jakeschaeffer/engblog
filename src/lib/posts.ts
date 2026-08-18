/**
 * The shared content-query module.
 *
 * Every page, component and feed that needs post data should import from here
 * — never call `getCollection('posts')` directly. Centralising the query is
 * what makes the draft rule below hold everywhere at once.
 *
 * ## The draft rule
 *
 * Drafts are built everywhere except the production deploy — the dev server,
 * Vercel preview and branch deploys, CI and a local `npm run build` all render
 * them. `SHOW_DRAFTS` in `@/lib/site` is the resolved answer for this build.
 *
 *   - `getVisiblePosts()` includes drafts when `SHOW_DRAFTS` is true. Route
 *     `getStaticPaths()` is driven by this, so a draft gets a real page you can
 *     open and share on a preview URL.
 *   - `getPublishedPosts()` never includes drafts, in any environment. RSS,
 *     related posts and prev/next use this, so a draft is never syndicated and
 *     never becomes a neighbour of a published post.
 *
 * The publication index uses `getVisiblePosts()`, so wherever a draft is listed
 * it also has a page: the index never links to a URL this build did not emit.
 *
 * Production exclusion is structural rather than cosmetic. `getStaticPaths()`
 * emits no page for a draft in production, so there is nothing in `dist/` to
 * link to, crawl, or pick up in `@astrojs/sitemap` output — the sitemap is
 * generated from the pages that were actually built.
 *
 * Draft pages that *are* built carry a visible "Draft" badge (`ArticleCard`,
 * `ArticleHeader`) and `noindex, nofollow` (`PostLayout` passes
 * `noindex={data.draft}`, and every non-production page is noindex anyway), so
 * a preview cannot be mistaken for a published page.
 */

import { getCollection, type CollectionEntry } from 'astro:content';

import {
  comparePostsNewestFirst,
  excludeDrafts,
  formatDate,
  selectAdjacentPosts,
  selectRelatedPosts,
  sortByPublishedAtDesc,
  toISODate,
  toISODateTime,
  type AdjacentPosts,
} from './post-utils';
import { SHOW_DRAFTS } from './site';

/** A single entry in the `posts` collection. */
export type Post = CollectionEntry<'posts'>;

/** Frontmatter of a post, after schema validation. */
export type PostData = Post['data'];

/**
 * All non-draft posts, newest first. Never includes drafts, in any build.
 *
 * Use for RSS, related posts and prev/next — anywhere a draft would be
 * syndicated, or would sit in the reading path between two published posts.
 * The index deliberately does *not* use this; see `getVisiblePosts()`.
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const all = await getCollection('posts');
  return sortByPublishedAtDesc(excludeDrafts(all));
}

/**
 * Posts that should have a page generated for them, newest first.
 *
 * Published posts *plus* drafts on every build except the production deploy,
 * where it is exactly `getPublishedPosts()`. Use it for `getStaticPaths()` and
 * for the index, which must agree with it about what exists.
 */
export async function getVisiblePosts(): Promise<Post[]> {
  const all = await getCollection('posts');
  const visible = SHOW_DRAFTS ? [...all] : excludeDrafts(all);
  return sortByPublishedAtDesc(visible);
}

/** Only the posts flagged `featured: true`, newest first. */
export async function getFeaturedPosts(): Promise<Post[]> {
  const published = await getPublishedPosts();
  return published.filter((post) => post.data.featured);
}

/**
 * Up to `limit` posts related to `post`, ranked by shared tags.
 *
 * Deterministic: more shared tags first, then newer, then slug ascending. Pass
 * the result of `getPublishedPosts()` as `allPosts` so drafts are never
 * suggested.
 */
export function getRelatedPosts(post: Post, allPosts: readonly Post[], limit = 3): Post[] {
  return selectRelatedPosts(post, allPosts, limit);
}

/**
 * Neighbouring posts. `prev` is the *older* post, `next` is the *newer* post.
 *
 * Pass `getPublishedPosts()` output so a draft never becomes a neighbour of a
 * published post.
 */
export function getAdjacentPosts(post: Post, publishedPosts: readonly Post[]): AdjacentPosts<Post> {
  return selectAdjacentPosts(post, publishedPosts);
}

/** Every tag in use across published posts, deduped and alphabetised. */
export async function getAllTags(): Promise<string[]> {
  const published = await getPublishedPosts();
  const tags = new Set<string>();
  for (const post of published) {
    for (const tag of post.data.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

// Re-exported so consumers have one import site for post-related helpers.
export { comparePostsNewestFirst, formatDate, toISODate, toISODateTime, type AdjacentPosts };
