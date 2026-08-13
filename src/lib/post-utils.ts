/**
 * Pure post logic — sorting, related-post scoring, adjacency and date
 * formatting.
 *
 * Deliberately free of any `astro:*` import so it can be unit tested in a plain
 * Node/vitest environment. `src/lib/posts.ts` is the Astro-aware wrapper that
 * feeds real collection entries into these functions and re-exports them; app
 * code should import from `@/lib/posts`, not from here.
 *
 * Everything here is structurally typed (`T extends SortablePost`) rather than
 * typed against `CollectionEntry<'posts'>`, so the concrete entry type flows
 * through the functions unchanged and tests can use small fixtures.
 */

import { SITE_LANG } from './site';

/** Minimum shape needed to order posts. */
export interface SortablePost {
  readonly id: string;
  readonly data: {
    readonly publishedAt: Date;
  };
}

/** Minimum shape needed to score relatedness. */
export interface TaggedPost extends SortablePost {
  readonly data: {
    readonly publishedAt: Date;
    readonly tags: readonly string[];
  };
}

/** Minimum shape needed to filter drafts. */
export interface DraftablePost {
  readonly data: {
    readonly draft: boolean;
  };
}

/** Neighbouring posts in publication order. */
export interface AdjacentPosts<T> {
  /** The next *older* post (published before this one), or null at the tail. */
  readonly prev: T | null;
  /** The next *newer* post (published after this one), or null at the head. */
  readonly next: T | null;
}

/**
 * Newest first. Ties on `publishedAt` are broken by ascending `id` so the
 * ordering is total and stable regardless of input order or `Array#sort`
 * implementation.
 */
export function sortByPublishedAtDesc<T extends SortablePost>(posts: readonly T[]): T[] {
  return [...posts].sort(comparePostsNewestFirst);
}

/** Comparator implementing "newest first, then slug ascending". */
export function comparePostsNewestFirst(a: SortablePost, b: SortablePost): number {
  const delta = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

/** Drop drafts. */
export function excludeDrafts<T extends DraftablePost>(posts: readonly T[]): T[] {
  return posts.filter((post) => !post.data.draft);
}

/**
 * Number of tags two posts have in common, compared case-insensitively so
 * `TypeScript` and `typescript` count as the same tag.
 */
export function countSharedTags(a: TaggedPost, b: TaggedPost): number {
  const aTags = new Set(a.data.tags.map(normalizeTag));
  let shared = 0;
  for (const tag of new Set(b.data.tags.map(normalizeTag))) {
    if (aTags.has(tag)) shared += 1;
  }
  return shared;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Deterministic related-post selection.
 *
 * Ordering rules, applied in sequence:
 *   1. More shared tags wins.
 *   2. Then newer `publishedAt` wins.
 *   3. Then lower `id` (slug) wins.
 *
 * The current post is always excluded, as are candidates that share no tags at
 * all — an unrelated post is worse than showing fewer than `limit` results.
 */
export function selectRelatedPosts<T extends TaggedPost>(
  post: TaggedPost,
  candidates: readonly T[],
  limit = 3,
): T[] {
  if (limit <= 0) return [];

  const scored = candidates
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => ({ candidate, score: countSharedTags(post, candidate) }))
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return comparePostsNewestFirst(a.candidate, b.candidate);
  });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

/**
 * Neighbours of `post` in publication order.
 *
 * Direction convention (this is the part people get wrong, so it is stated
 * explicitly): **`prev` is the older post, `next` is the newer post.** Reading
 * a post and clicking "previous" walks backwards through time.
 *
 * `candidates` need not be pre-sorted; it is sorted defensively. If `post` is
 * not present in `candidates`, both neighbours are null.
 */
export function selectAdjacentPosts<T extends SortablePost>(
  post: SortablePost,
  candidates: readonly T[],
): AdjacentPosts<T> {
  const ordered = sortByPublishedAtDesc(candidates); // newest -> oldest
  const index = ordered.findIndex((candidate) => candidate.id === post.id);
  if (index === -1) return { prev: null, next: null };

  // `ordered` runs newest -> oldest, so index+1 is older and index-1 is newer.
  return {
    prev: ordered[index + 1] ?? null,
    next: index > 0 ? (ordered[index - 1] ?? null) : null,
  };
}

/**
 * Human-readable date, e.g. "August 13, 2026".
 *
 * Pinned to UTC so a build on a machine in UTC+13 does not render a different
 * day than a build in UTC-8, and to `SITE_LANG` so the CI locale cannot change
 * the output.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(SITE_LANG, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Machine-readable value for `<time datetime="...">`.
 *
 * Full ISO-8601 instant (`2026-08-13T00:00:00.000Z`) — valid for `datetime`
 * and unambiguous about timezone.
 */
export function toISODateTime(date: Date): string {
  return date.toISOString();
}

/** Date-only ISO form (`2026-08-13`), for JSON-LD and compact display. */
export function toISODate(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, iso.indexOf('T'));
}
