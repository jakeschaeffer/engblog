# Writing a post

This is for anyone on the engineering team who wants to publish. You do not
need to know Astro. You need to be able to edit a Markdown file and open a pull
request.

Platform reference (build, deploy, architecture) lives in [README.md](README.md).

---

## 1. Start here

```bash
nvm use                 # Node 22, from .nvmrc
npm install
cp docs/post-template.md src/content/posts/my-post-title.mdx
npm run dev             # http://localhost:4321
```

**The filename becomes the URL slug.** `src/content/posts/my-post-title.mdx` is
served at `/engineering/my-post-title/`.

How that works, so you can trust it: the collection loader in
`src/content.config.ts` is `glob({ base: './src/content/posts', pattern:
'**/*.mdx' })`, which sets each entry's id from its path under that directory
with the extension stripped. `postPath()` in `src/lib/site.ts` then prefixes it
with `BASE_PATH`, which is `/engineering/`. There is no `slug:` frontmatter
field — renaming the file is how you change the URL.

(Precisely: `postPath()` returns `/engineering/my-post-title/` **with** a
trailing slash, and Astro's default directory build format writes
`dist/engineering/my-post-title/index.html`. Both spellings resolve, but the
trailing-slash form is the one the site publishes everywhere — canonical link,
`og:url`, JSON-LD, RSS and the sitemap — so use it when you link to a post from
another post.)

Use lowercase words separated by hyphens. No spaces, no capitals, no dates in
the filename. Once a post is published, **do not rename the file** — that
breaks every inbound link to it.

Then:

1. Fill in the frontmatter (section 2).
2. Write the body.
3. Read it at `http://localhost:4321/engineering/my-post-title/`.
4. Run `npm run verify` before you open the PR.

---

## 2. Frontmatter reference

Frontmatter is the YAML block between the `---` fences at the top of the file.
Every field below comes from `src/content.config.ts`.

| Field          | Type                       | Required | Default                                | Notes                                                                                                                                                                                                          |
| -------------- | -------------------------- | -------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | string (non-empty)         | **yes**  | —                                      | Rendered as the page `<h1>`, the `<title>`, and the OG/Twitter title.                                                                                                                                          |
| `description`  | string (non-empty)         | **yes**  | —                                      | One or two sentences. Used as the meta description and on index cards.                                                                                                                                         |
| `publishedAt`  | date (`YYYY-MM-DD`)        | **yes**  | —                                      | Drives ordering, prev/next and RSS. Coerced to a Date, so a quoted string works too.                                                                                                                           |
| `updatedAt`    | date                       | no       | unset                                  | Set **only** on a material revision after publication. Emits `article:modified_time`.                                                                                                                          |
| `authors`      | array of author objects    | **yes**  | —                                      | At least one entry. See the author table below.                                                                                                                                                                |
| `tags`         | array of non-empty strings | **yes**  | —                                      | At least one. Tags drive related-post scoring (compared case-insensitively), so reuse existing tags.                                                                                                           |
| `draft`        | boolean                    | no       | `false`                                | `true` = dev-only. See section 8.                                                                                                                                                                              |
| `heroImage`    | object                     | no       | unset                                  | `{ src, alt }`, both non-empty. See the hero image table below.                                                                                                                                                |
| `canonicalUrl` | absolute URL               | no       | this site's URL for the post           | Set when the canonical version lives elsewhere. Overrides `<link rel="canonical">` and `og:url`.                                                                                                               |
| `hashnodeUrl`  | absolute URL               | no       | unset                                  | **Provenance only. Never rendered publicly.**                                                                                                                                                                  |
| `ogImage`      | string (non-empty)         | no       | `heroImage.src`, then the site default | Site-relative path to a social preview image. Must be a **1200×630 raster** PNG or JPG. Set it whenever the post has a hero — a hero is the wrong aspect ratio and gets cropped unpredictably by each network. |
| `featured`     | boolean                    | no       | `false`                                | Surfaces the post in the featured slot on the index.                                                                                                                                                           |

`authors[]` entries:

| Field    | Type               | Required | Notes                                                                                                                          |
| -------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name`   | string (non-empty) | **yes**  | Display name.                                                                                                                  |
| `role`   | string (non-empty) | no       | E.g. `Engineering`.                                                                                                            |
| `avatar` | string (non-empty) | no       | Site-relative path under `public/`, e.g. `/images/authors/jake.jpg`. Not a remote URL — images are served from our own origin. |

`heroImage` fields:

| Field | Type               | Required | Notes                                                                                                                                                                    |
| ----- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src` | string (non-empty) | **yes**  | Site-relative path, e.g. `/images/my-post/hero.png`. Append a `#WxH` size hint — `/images/my-post/hero.png#1600x932` — and the browser reserves the real box. See below. |
| `alt` | string (non-empty) | **yes**  | Required by the schema. A hero image without alt text fails the build.                                                                                                   |

### The `#WxH` size hint

`ArticleHeader` and `<Figure>` both read an optional `#WxH` fragment on the end
of an image path and emit it as the `<img>`'s `width`/`height` attributes, which
is how the browser reserves the right box before the file arrives:

```yaml
heroImage:
  src: '/images/my-post/hero.png#1600x932'
  alt: 'What the image shows.'
```

Omit it and the hero is pinned to the house 16:9 ratio and cropped to fit
(`object-fit: cover`) — the page still never shifts, but you do not get to
choose what is cropped. The fragment is never sent to the server, so it costs
nothing. Use the file's real pixel dimensions; `sips -g pixelWidth -g
pixelHeight file.png` on macOS, or `file file.png` anywhere, will tell you.

### `hashnodeUrl` is not a link on the page

It exists so we can trace a migrated post back to where it was originally
published. Nothing renders it — grep the codebase and you will find it only in
the schema and in post frontmatter. If you want a visible "originally published
at" link, that is a component change, not a frontmatter change: ask platform.

### The schema is strict — a typo fails the build

Every object in the schema is `.strict()`. An unknown key is an error, not
something silently ignored. This is deliberate: a typo'd `publishDate` should
break CI loudly rather than publish a post with no date.

So this:

```yaml
---
title: 'My post'
description: 'A post.'
publishDate: 2026-08-13 # <- typo: the field is publishedAt
authors:
  - name: 'Jake'
tags:
  - 'astro'
---
```

fails `npm run build` and `npm run check` with something along these lines:

```
[ERROR] [glob-loader] posts → my-post: Invalid frontmatter.
  publishDate: Unrecognized key(s) in object: 'publishDate'
  publishedAt: Required
```

The fix is always the same: match the field names in the table above exactly.
The same applies inside `authors[]` and `heroImage` — `alt_text` instead of
`alt` fails too.

---

## 3. Markdown

Standard Markdown. The bits worth stating:

### Headings

The post body starts at `##`. The page `<h1>` is generated from `title`, so a
`#` heading in the body produces a second h1 and breaks the document outline.
Never skip a level: `##` → `###` → `####`, never `##` → `####`.

```md
## A top-level section

### A subsection
```

Headings get anchor links automatically and feed the table of contents.

### Lists

```md
- Unordered item
- Another item
  - Nested item

1. Ordered item
2. Second item
```

### Links

```md
[Astro content collections](https://docs.astro.build/en/guides/content-collections/)
```

Link text must describe the destination. Never "click here", "this", or a bare
URL — a screen-reader user tabbing through links hears only the link text.

Internal links are site-relative paths, **with the trailing slash**:
`[the capacity-planning post](/engineering/how-many-llm-calls-is-your-eval-suite-making/)`.
That is the form the canonical URL, RSS and the sitemap all use; linking to the
slashless form still resolves but sends readers through a redirect on some
hosts.

### Images

```md
![A flame graph showing 400ms spent in JSON serialisation](/images/my-post/flamegraph.png)
```

Files go in `public/images/`. See section 6.

### Blockquotes

```md
> Quoted text. Attribute it in the surrounding paragraph, not inside the quote.
```

### Tables

```md
| Approach | Build time | Notes                |
| -------- | ---------- | -------------------- |
| Bundled  | 12s        | Baseline.            |
| Split    | 4s         | Needs a second pass. |
```

Wide tables get their own horizontal scroll container rather than widening the
page.

### Code blocks

**Always tag the fence with a language.** The language label is rendered above
the block, and syntax highlighting is built at compile time — there is no
client-side highlighter.

````md
```ts
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```
````

Long lines **scroll horizontally, they do not wrap** (`wrap: false` in
`astro.config.mjs`). That is intentional — wrapped code is harder to read — but
it means you should break long lines yourself where it helps. An untagged fence
still renders; it just gets no label and no highlighting.

---

## 4. Approved components

The props below are checked against the component files as they stand. If a
component's own file ever disagrees with this document, the file wins — and this
document is wrong and should be fixed in the same PR.

Note the two directories, because the import paths differ:
`Callout`, `Figure` and `LinkCard` live in `src/components/mdx/`;
`InteractiveDemoShell` and the React islands live in
`src/components/interactive/`.

Import what you use at the top of the post body, immediately after the closing
`---` of the frontmatter.

### Callout

```mdx
import Callout from '@/components/mdx/Callout.astro';

<Callout type="warning" title="This drops the index">
  Running the migration on a live table locks it for the duration. Do it in a maintenance window.
</Callout>
```

| Prop     | Type                                         | Required |
| -------- | -------------------------------------------- | -------- |
| `type`   | `'info' \| 'warning' \| 'success' \| 'note'` | yes      |
| `title`  | string                                       | no       |
| children | slot content                                 | —        |

### Figure

Use this instead of a bare `![]()` when the image needs a caption.

```mdx
import Figure from '@/components/mdx/Figure.astro';

<Figure
  src="/images/my-post/flamegraph.png"
  alt="Flame graph with a 400ms plateau in JSON serialisation"
  caption="Serialisation dominates the request. Everything else is noise."
/>
```

| Prop      | Type   | Required |
| --------- | ------ | -------- |
| `src`     | string | yes      |
| `alt`     | string | **yes**  |
| `caption` | string | no       |

`alt` and `caption` are not interchangeable. The caption is visible to
everyone; the alt text describes the image to someone who cannot see it.

### LinkCard

```mdx
import LinkCard from '@/components/mdx/LinkCard.astro';

<LinkCard
  href="https://docs.astro.build/en/guides/content-collections/"
  title="Astro content collections"
  description="The loader and schema API this site's posts are built on."
/>
```

| Prop          | Type   | Required |
| ------------- | ------ | -------- |
| `href`        | string | yes      |
| `title`       | string | yes      |
| `description` | string | no       |

### InteractiveDemoShell + a React island

Interactive demos are always wrapped in `InteractiveDemoShell`. The shell gives
the demo a title, an optional source link, and — importantly — a text summary
that stands in for the demo when it does not run.

```mdx
import InteractiveDemoShell from '@/components/interactive/InteractiveDemoShell.astro';
import ExampleCalculator from '@/components/interactive/ExampleCalculator.tsx';

<InteractiveDemoShell
  title="Cost per request"
  description="Adjust the request volume to see how the fixed cost amortises."
  sourceHref="https://github.com/jakeschaeffer/engblog/blob/main/src/components/interactive/ExampleCalculator.tsx"
  fallbackSummary="At 10k requests/month the fixed $40 base cost dominates at $0.004/request; by 1M requests it is $0.00004 and variable cost takes over."
>
  <ExampleCalculator client:visible />
</InteractiveDemoShell>
```

| Prop              | Type         | Required |
| ----------------- | ------------ | -------- |
| `title`           | string       | yes      |
| `description`     | string       | no       |
| `sourceHref`      | string       | no       |
| `fallbackSummary` | string       | **yes**  |
| island            | slot content | —        |

**Why `client:visible` and not `client:load`.** Every page here is static HTML
by default; a client directive is what opts one component into shipping
JavaScript. `client:load` hydrates during initial page load, competing with
rendering the article the reader actually came for. `client:visible` defers
hydration until the component scrolls into the viewport, so a demo halfway down
a long post costs nothing to a reader who never reaches it. Reading is the
primary job; the demo is secondary. Use `client:visible` unless you have a
documented reason not to (an above-the-fold widget is the usual exception —
raise it in review).

---

## 5. Rules

These are hard rules, not preferences. CI or review will catch violations.

1. **Normal Markdown plus the approved components above. Nothing else.**
2. **No raw `<script>` tags, injected HTML/JS, or arbitrary external embeds**
   (iframes, third-party widgets, tracking pixels, CDN scripts) without
   platform review.
3. **No arbitrary package imports inside post MDX.** A post may import approved
   components. It may not import from `node_modules`.
4. **New interactive components live in `src/components/interactive/`**, are
   reviewed and tested as application code, and **must be documented in section
   4 of this file before they are used in a post.**
5. **Use `client:visible` for expensive islands** unless there is a documented
   reason not to.
6. **A post must remain understandable when its interactive component does not
   load.** Always write a real `fallbackSummary` — state the actual conclusion
   the demo demonstrates, not "interactive demo unavailable".
7. **If an interactive tool needs authentication, user data, secrets,
   long-running compute, or saved state, it does not belong in a post.** This
   site is a static build with no server, no database, and no auth. Such a tool
   belongs in a separate application route or a `/labs/` property.

---

## 6. Images and accessibility

**Where files go:** `public/images/`. A file at
`public/images/my-post/hero.png` is served at `/images/my-post/hero.png` — that
site-relative path is what goes in your Markdown or frontmatter. Group each
post's images in a subdirectory named after the post slug.

**Size images before you commit them.** There is no build-time image pipeline:
whatever you put in `public/` is what every reader downloads, byte for byte.
Export at the size the page actually renders — **1600px wide is the widest
anything needs to be** — and never commit a 4000px camera or design-tool export.
`docs/images.md` has the one-line commands for resizing a hero and cutting the
1200×630 social crop.

**Alt text is required on every image.** Describe what the image _shows_ and
why it is in the post — not that it is an image.

- Good: `alt="Flame graph with a 400ms plateau in JSON serialisation"`
- Bad: `alt="screenshot"`, `alt="image of a graph"`, `alt="flamegraph.png"`

**`alt=""` is correct — and only correct — for purely decorative images**: an
image that adds no information a reader would miss, such as a divider or a
mood-setting header shot whose meaning is already in the surrounding text. An
empty alt tells assistive tech to skip the image, which is better than reading
out a filename. If you can write a useful sentence about the image, it is not
decorative.

**Supply dimensions to prevent layout shift.** Give the browser the image's
intrinsic pixel size so it can reserve space before the file arrives; without
it, text jumps down as images load. Markdown's `![]()` cannot express width and
height, so for any image large enough to shift the page, use `Figure` (or a
plain `<img width height alt src />` in MDX) rather than `![]()`. `Figure` and
`heroImage.src` both accept the `#WxH` path hint described in section 2:
`<Figure src="/images/my-post/flamegraph.png#1600x900" alt="…" />`.

**Headings:** the body starts at `##` because the title is the page `<h1>`.
Never skip a level. The heading outline is how many readers navigate, and it is
what the table of contents is built from.

**Link text** must make sense read on its own. See section 3.

**Colour:** do not use colour alone to carry meaning ("the red line shows…").
Name the thing as well as its colour.

---

## 7. Review workflow

```bash
git checkout -b post/my-post-title
cp docs/post-template.md src/content/posts/my-post-title.mdx
# write
npm run dev          # read it locally
npm run verify       # lint + typecheck + check + test + build
git add src/content/posts/my-post-title.mdx public/images/my-post-title
git commit -m "post: my post title"
git push -u origin post/my-post-title
```

Then open a pull request.

1. **CI runs** `npm ci`, `lint`, `typecheck`, `check`, `test`, `build`
   (`.github/workflows/ci.yml`). A frontmatter typo fails here.
2. **Vercel builds a preview** for the PR. Preview deployments emit
   `noindex, nofollow`, so nothing on them can be indexed by search engines.
3. **Editorial review happens on the preview URL**, not on the diff. Read the
   rendered post.
4. **Merge to `main` publishes.** If the post has `draft: true`, merging is
   safe — it will not appear in production until `draft: false`.

### What needs a platform-engineer review

A post that only adds a `.mdx` file and images under `public/images/` can be
reviewed by an editor. Pull in a platform engineer for anything that touches:

- `src/components/` — any component change, and especially a new interactive
  component
- `src/lib/` — site config, post queries, structured data
- `astro.config.mjs`, `content.config.ts`, `tsconfig.json`, `eslint.config.js`,
  `package.json`, `.github/workflows/`
- any new dependency
- any raw HTML, `<script>`, iframe or external embed inside a post

---

## 8. Drafts

Set `draft: true` in frontmatter.

- The post **renders in `npm run dev`** at its real URL, so you can preview it.
- It is **excluded from production builds entirely** — `getVisiblePosts()` in
  `src/lib/posts.ts` includes drafts only when `import.meta.env.DEV` is true,
  and the post route's `getStaticPaths()` is driven by that. No page is
  generated, so there is nothing for the sitemap to include.
- It never appears in **indexes, related posts, prev/next, or RSS**, even in
  dev — those read `getPublishedPosts()`, which always drops drafts.
- A draft page also emits `noindex, nofollow` (`PostLayout.astro` passes
  `noindex={data.draft}`).

Merging a draft to `main` is safe. Publishing is a one-line change: flip
`draft` to `false` and merge.

---

## 9. Commands

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Dev server at `http://localhost:4321`. Drafts visible.        |
| `npm run build`     | Production static build into `dist/`. Drafts excluded.        |
| `npm run preview`   | Serves the built `dist/` locally.                             |
| `npm run lint`      | ESLint, including accessibility rules.                        |
| `npm run typecheck` | `tsc --noEmit`.                                               |
| `npm run check`     | `astro check` — Astro diagnostics and content schema.         |
| `npm run test`      | Vitest unit tests.                                            |
| `npm run format`    | Prettier, writes in place.                                    |
| `npm run verify`    | lint + typecheck + check + test + build. Run before every PR. |
