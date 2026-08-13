import { describe, expect, it } from 'vitest';

import {
  comparePostsNewestFirst,
  countSharedTags,
  excludeDrafts,
  formatDate,
  selectAdjacentPosts,
  selectRelatedPosts,
  sortByPublishedAtDesc,
  toISODate,
  toISODateTime,
} from './post-utils';

interface Fixture {
  readonly id: string;
  readonly data: {
    readonly publishedAt: Date;
    readonly tags: readonly string[];
    readonly draft: boolean;
  };
}

function post(id: string, published: string, tags: string[] = [], draft = false): Fixture {
  return { id, data: { publishedAt: new Date(published), tags, draft } };
}

describe('sortByPublishedAtDesc', () => {
  it('orders newest first', () => {
    const sorted = sortByPublishedAtDesc([
      post('old', '2024-01-01'),
      post('new', '2026-01-01'),
      post('mid', '2025-01-01'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('breaks ties by ascending id', () => {
    const sorted = sortByPublishedAtDesc([
      post('zebra', '2025-05-05'),
      post('alpha', '2025-05-05'),
      post('mango', '2025-05-05'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['alpha', 'mango', 'zebra']);
  });

  it('does not mutate its input', () => {
    const input = [post('a', '2024-01-01'), post('b', '2026-01-01')];
    sortByPublishedAtDesc(input);
    expect(input.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('is stable across input orderings', () => {
    const a = post('a', '2025-01-01', []);
    const b = post('b', '2026-01-01', []);
    const c = post('c', '2026-01-01', []);
    expect(sortByPublishedAtDesc([a, b, c]).map((p) => p.id)).toEqual(
      sortByPublishedAtDesc([c, a, b]).map((p) => p.id),
    );
  });
});

describe('comparePostsNewestFirst', () => {
  it('returns a negative number when the first post is newer', () => {
    expect(comparePostsNewestFirst(post('a', '2026-01-01'), post('b', '2024-01-01'))).toBeLessThan(
      0,
    );
  });
});

describe('excludeDrafts', () => {
  it('drops drafts and keeps published posts', () => {
    const result = excludeDrafts([
      post('published', '2025-01-01', [], false),
      post('draft', '2025-01-02', [], true),
    ]);
    expect(result.map((p) => p.id)).toEqual(['published']);
  });
});

describe('countSharedTags', () => {
  it('counts overlapping tags', () => {
    const a = post('a', '2025-01-01', ['astro', 'typescript', 'css']);
    const b = post('b', '2025-01-01', ['typescript', 'css', 'testing']);
    expect(countSharedTags(a, b)).toBe(2);
  });

  it('is case- and whitespace-insensitive', () => {
    const a = post('a', '2025-01-01', ['TypeScript']);
    const b = post('b', '2025-01-01', [' typescript ']);
    expect(countSharedTags(a, b)).toBe(1);
  });

  it('does not double count duplicate tags', () => {
    const a = post('a', '2025-01-01', ['astro', 'astro']);
    const b = post('b', '2025-01-01', ['astro', 'ASTRO']);
    expect(countSharedTags(a, b)).toBe(1);
  });

  it('returns zero with no overlap', () => {
    expect(countSharedTags(post('a', '2025-01-01', ['x']), post('b', '2025-01-01', ['y']))).toBe(0);
  });
});

describe('selectRelatedPosts', () => {
  const current = post('current', '2025-06-01', ['astro', 'typescript']);
  const twoShared = post('two-shared', '2024-01-01', ['astro', 'typescript', 'css']);
  const oneSharedNew = post('one-shared-new', '2026-01-01', ['astro']);
  const oneSharedOld = post('one-shared-old', '2023-01-01', ['typescript']);
  const unrelated = post('unrelated', '2026-06-01', ['marketing']);

  const all = [unrelated, oneSharedOld, oneSharedNew, twoShared, current];

  it('ranks by shared tag count first, then recency', () => {
    expect(selectRelatedPosts(current, all).map((p) => p.id)).toEqual([
      'two-shared',
      'one-shared-new',
      'one-shared-old',
    ]);
  });

  it('excludes the current post', () => {
    expect(selectRelatedPosts(current, all).map((p) => p.id)).not.toContain('current');
  });

  it('excludes posts with no shared tags', () => {
    expect(selectRelatedPosts(current, all).map((p) => p.id)).not.toContain('unrelated');
  });

  it('respects the limit', () => {
    expect(selectRelatedPosts(current, all, 1).map((p) => p.id)).toEqual(['two-shared']);
    expect(selectRelatedPosts(current, all, 0)).toEqual([]);
  });

  it('breaks score+date ties by ascending slug', () => {
    const alpha = post('alpha', '2025-01-01', ['astro']);
    const zebra = post('zebra', '2025-01-01', ['astro']);
    expect(selectRelatedPosts(current, [zebra, alpha]).map((p) => p.id)).toEqual([
      'alpha',
      'zebra',
    ]);
  });

  it('is deterministic regardless of candidate order', () => {
    const forwards = selectRelatedPosts(current, all).map((p) => p.id);
    const backwards = selectRelatedPosts(current, [...all].reverse()).map((p) => p.id);
    expect(backwards).toEqual(forwards);
  });

  it('returns an empty array when nothing is related', () => {
    expect(selectRelatedPosts(current, [unrelated])).toEqual([]);
  });
});

describe('selectAdjacentPosts', () => {
  const older = post('older', '2024-01-01');
  const middle = post('middle', '2025-01-01');
  const newer = post('newer', '2026-01-01');
  const all = [middle, newer, older];

  it('prev is the older post and next is the newer post', () => {
    const { prev, next } = selectAdjacentPosts(middle, all);
    expect(prev?.id).toBe('older');
    expect(next?.id).toBe('newer');
  });

  it('returns null for next on the newest post', () => {
    const { prev, next } = selectAdjacentPosts(newer, all);
    expect(prev?.id).toBe('middle');
    expect(next).toBeNull();
  });

  it('returns null for prev on the oldest post', () => {
    const { prev, next } = selectAdjacentPosts(older, all);
    expect(prev).toBeNull();
    expect(next?.id).toBe('middle');
  });

  it('returns both null when the post is not in the list', () => {
    expect(selectAdjacentPosts(post('ghost', '2025-06-01'), all)).toEqual({
      prev: null,
      next: null,
    });
  });

  it('returns both null for a single-post collection', () => {
    expect(selectAdjacentPosts(middle, [middle])).toEqual({ prev: null, next: null });
  });
});

describe('date helpers', () => {
  const date = new Date('2026-08-13T09:41:00.000Z');

  it('formats a human-readable date in UTC', () => {
    expect(formatDate(date)).toBe('August 13, 2026');
  });

  it('does not shift the day for late-UTC timestamps', () => {
    // Would render as the 14th if the formatter used a local timezone east of UTC.
    expect(formatDate(new Date('2026-08-13T23:59:59.000Z'))).toBe('August 13, 2026');
  });

  it('emits a full ISO instant for <time datetime>', () => {
    expect(toISODateTime(date)).toBe('2026-08-13T09:41:00.000Z');
  });

  it('emits a date-only ISO string', () => {
    expect(toISODate(date)).toBe('2026-08-13');
  });
});
