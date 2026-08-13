/**
 * The shared content-query module.
 *
 * Every page, component and feed that needs post data should import from here
 * — never call `getCollection('posts')` directly. Centralising the query is
 * what makes the draft rule below hold everywhere at once.
 *
 * ## The draft rule
 *
 * Drafts are visible in `astro dev` and invisible in a production build:
 *
 *   - `getVisiblePosts()` includes drafts when `import.meta.env.DEV` is true.
 *     Route `getStaticPaths()` should be driven by this, so a draft gets a real
 *     page you can preview locally.
 *   - `getPublishedPosts()` never includes drafts. Indexes, RSS, related-posts
 *     and prev/next should use this, so drafts never leak into navigation even
 *     in dev.
 *
 * Because production `getStaticPaths()` emits no page for a draft, the draft
 * cannot appear in `@astrojs/sitemap` output either — the sitemap is generated
 * from the pages that were actually built. That is the whole draft-exclusion
 * mechanism; the `filter` in astro.config.mjs is only a backstop.
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

/** A single entry in the `posts` collection. */
export type Post = CollectionEntry<'posts'>;

/** Frontmatter of a post, after schema validation. */
export type PostData = Post['data'];

/**
 * All non-draft posts, newest first.
 *
 * Use for indexes, RSS, related posts, prev/next — anywhere a reader could be
 * sent to a URL that must exist in production.
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const all = await getCollection('posts');
  return sortByPublishedAtDesc(excludeDrafts(all));
}

/**
 * Posts that should have a page generated for them, newest first.
 *
 * In dev this is published posts *plus* drafts. In a production build it is
 * exactly `getPublishedPosts()`.
 */
export async function getVisiblePosts(): Promise<Post[]> {
  const all = await getCollection('posts');
  const visible = import.meta.env.DEV ? [...all] : excludeDrafts(all);
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
