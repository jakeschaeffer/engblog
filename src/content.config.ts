import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 7 deprecates re-exporting `z` from `astro:content`. `astro/zod` is the
// same Zod instance Astro validates with, so schemas built here are recognised
// by the content layer.
import { z } from 'astro/zod';

/**
 * Author credit on a post.
 *
 * `avatar` is a site-relative path (e.g. `/images/authors/jake.jpg`), not a
 * remote URL, so that images are served from our own origin.
 */
const authorSchema = z
  .object({
    name: z.string().min(1, 'author.name must not be empty'),
    role: z.string().min(1).optional(),
    avatar: z.string().min(1).optional(),
  })
  .strict();

/**
 * The `posts` collection.
 *
 * Schema is `.strict()` at every level: any frontmatter key that is not listed
 * here fails the build. That is intentional — a typo'd `publishDate` should
 * break CI loudly rather than silently produce a post with no date.
 */
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.mdx',
  }),
  schema: z
    .object({
      /** Post title. Rendered as the <h1> and used in <title>/OG tags. */
      title: z.string().min(1),

      /** One or two sentences. Used as the meta description and in indexes. */
      description: z.string().min(1),

      /** First publication date. Drives ordering, prev/next and RSS. */
      publishedAt: z.coerce.date(),

      /** Set only when a post is materially revised after publication. */
      updatedAt: z.coerce.date().optional(),

      /** At least one author is required. */
      authors: z.array(authorSchema).min(1, 'at least one author is required'),

      /** At least one tag is required; tags drive related-post scoring. */
      tags: z.array(z.string().min(1)).min(1, 'at least one tag is required'),

      /**
       * Drafts render in `astro dev` but are excluded from production builds
       * (see `src/lib/posts.ts`), so they never appear in the sitemap or RSS.
       */
      draft: z.boolean().default(false),

      /** Alt text is REQUIRED whenever a hero image is present. */
      heroImage: z
        .object({
          src: z.string().min(1),
          alt: z.string().min(1, 'heroImage.alt is required for accessibility'),
        })
        .strict()
        .optional(),

      /** Set when the canonical version of this post lives elsewhere. */
      canonicalUrl: z.url().optional(),

      /**
       * Provenance only: where this post was originally published on Hashnode.
       * Never rendered publicly by default — it exists so we can trace migrated
       * content back to its source.
       */
      hashnodeUrl: z.url().optional(),

      /** Per-post social image path. Falls back to DEFAULT_OG_IMAGE. */
      ogImage: z.string().min(1).optional(),

      /** Surfaces the post in the "featured" slot on the index. */
      featured: z.boolean().default(false),
    })
    .strict(),
});

export const collections = { posts };
