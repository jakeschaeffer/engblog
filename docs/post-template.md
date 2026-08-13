---
# ---------------------------------------------------------------------------
# REQUIRED FIELDS
#
# The schema in src/content.config.ts is .strict(): any key that is not listed
# here fails the build. Do not invent fields. Do not rename fields.
# Full reference: AUTHORING.md
# ---------------------------------------------------------------------------

# Rendered as the page <h1>, the <title>, and the OG/Twitter title.
title: 'Replace me with the post title'

# One or two sentences. Used as the meta description and on index cards.
description: 'Replace me with one or two sentences describing the post.'

# First publication date. Drives ordering, prev/next and RSS. YYYY-MM-DD.
publishedAt: 2026-01-01

# At least one author. `role` and `avatar` are optional per author.
# `avatar` must be a site-relative path under public/, not a remote URL.
authors:
  - name: 'Your Name'
    role: 'Engineering'
    # avatar: '/images/authors/your-name.jpg'

# At least one tag. Tags drive related-post scoring, so reuse existing tags
# where they fit rather than inventing near-duplicates.
tags:
  - 'engineering'

# ---------------------------------------------------------------------------
# FIELDS WITH DEFAULTS — safe to leave as-is
# ---------------------------------------------------------------------------

# true  -> renders in `npm run dev` only; excluded from production builds,
#          indexes, prev/next, related posts, RSS and the sitemap.
# false -> published.
# Leave this true until the post is ready to go live.
draft: true

# Surfaces the post in the "featured" slot on the index. Defaults to false.
featured: false

# ---------------------------------------------------------------------------
# OPTIONAL FIELDS — uncomment only the ones you actually need.
# An empty or placeholder value in an uncommented optional field will fail
# validation, so delete rather than blank out.
# ---------------------------------------------------------------------------

# Set ONLY when the post is materially revised after publication.
# updatedAt: 2026-02-01

# Hero image. `alt` is required whenever heroImage is present — the schema
# rejects a hero image without it. File goes in public/images/<slug>/, sized to
# at most 1600px wide before you commit it — there is no build-time image
# pipeline, so readers download exactly what is in the repo. See docs/images.md.
# heroImage:
#   src: '/images/my-post/hero.png'
#   alt: 'Describe what the image shows, not that it is an image.'

# Set when the canonical version of this post lives somewhere else (e.g. it
# stays up on Hashnode). Must be a full absolute URL. When omitted, the
# canonical URL is this site's own URL for the post.
# canonicalUrl: 'https://example.com/original-post'

# Provenance only. Records where a migrated post was originally published on
# Hashnode. Never rendered publicly. Must be a full absolute URL.
# hashnodeUrl: 'https://ode.hashnode.dev/original-slug'

# Per-post social preview image. Falls back to heroImage.src, then to the
# site default. Must be a 1200x630 PNG or JPG — never an SVG, which social
# crawlers silently refuse to render. Set this whenever the post has a hero:
# a hero is the wrong aspect ratio and each network crops it differently.
# docs/images.md has the one-line command to cut the crop.
# ogImage: '/images/my-post/og.png'
---

import Callout from '@/components/mdx/Callout.astro';

The first paragraph is the standfirst. Say what the post is about and what the
reader will be able to do afterwards. Do not restate the title.

The body starts at `##`. The page `<h1>` is generated from the `title`
frontmatter field, so a `#` heading here would produce two h1s.

## First section

Write the section. Keep paragraphs short. Link with descriptive text, like
[the Astro content collections reference](https://docs.astro.build/en/guides/content-collections/)
— never "click here".

Things this section covers:

- A point, stated plainly.
- Another point.
- A third point.

## A code example

Always tag the fence with a language. The label is rendered above the block,
and long lines scroll horizontally rather than wrapping.

```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

<Callout type="note" title="Delete this before publishing">
  This template ships with `draft: true`. Flip it to `false` in the same pull
  request that adds the finished post, or in a follow-up — either way, the post
  will not appear in production until it is `false`.
</Callout>

## What to do next

1. Copy this file to `src/content/posts/<slug>.mdx`. The filename becomes the
   URL slug.
2. Fill in the frontmatter and delete every comment block above.
3. Write the body.
4. Run `npm run dev` and read it in the browser.
5. Run `npm run verify` before opening the pull request.
