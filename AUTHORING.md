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
| `draft`        | boolean                    | no       | `false`                                | `true` = built everywhere except production, and badged "Draft" wherever it appears. See section 8.                                                                                                            |
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

### EvalMetricsPanel

The summary half of the Detection Eval Explorer: a macro-averaged overall row
and one row per detection category, over a built-in mock eval run. The
`$/Sub/Mo` column is a projection, and the assumption behind it — clips per
subscriber per month — is a slider the reader can move.

```mdx
import InteractiveDemoShell from '@/components/interactive/InteractiveDemoShell.astro';
import EvalMetricsPanel from '@/components/interactive/EvalMetricsPanel.tsx';

<InteractiveDemoShell
  title="Run summary and per-category breakdown"
  description="Precision, recall, false positive rate, latency and cost for a mock 29-clip run, with the clip-volume assumption behind the $/Sub/Mo projection exposed as a control."
  sourceHref="https://github.com/jakeschaeffer/engblog/blob/main/src/components/interactive/EvalMetricsPanel.tsx"
  fallbackSummary="Across 29 mock clips the run macro-averages 80.0% precision, 76.0% recall and a 4.6% false positive rate, at 2.1 seconds per clip. At an assumed 1,500 clips per subscriber per month that projects to $3.57 per subscriber per month."
>
  <EvalMetricsPanel client:visible />
</InteractiveDemoShell>
```

| Prop                        | Type                  | Required |
| --------------------------- | --------------------- | -------- |
| `items`                     | `readonly EvalItem[]` | no       |
| `initialClipsPerSubscriber` | number                | no       |

`items` defaults to the mock run exported by
`src/components/interactive/eval-explorer.ts`; there is only one run and it is
deliberately fake, so a post normally passes nothing.
`initialClipsPerSubscriber` is clamped to the control's range, so a post cannot
seed an impossible projection.

### EvalDotGrid

The dot layer of the same explorer: every clip in the run as one small mark,
grouped by predicted category, with a per-group metric strip. Activating a mark
expands that clip's full record inline underneath — caption, predicted label
against ground truth, confidence, objects detected, latency and cost.

Correctness is carried by shape as well as colour (hollow round = correct,
filled square = incorrect) and named in a visible legend. The field is a single
tab stop with arrow-key navigation, and `Esc` collapses the record.

```mdx
import InteractiveDemoShell from '@/components/interactive/InteractiveDemoShell.astro';
import EvalDotGrid from '@/components/interactive/EvalDotGrid.tsx';

<InteractiveDemoShell
  title="The dot layer, and one clip opened up"
  description="Every clip as a single mark, grouped by predicted category. Activate any mark — by click, or with the arrow keys once the field has focus — and that clip's full record expands underneath."
  sourceHref="https://github.com/jakeschaeffer/engblog/blob/main/src/components/interactive/EvalDotGrid.tsx"
  fallbackSummary="Five of the 29 clips are wrong, and the field shows where they sit: one in Person, one in Vehicle, one of the three Animal clips, and two clips the model called empty that were not."
>
  <EvalDotGrid client:visible />
</InteractiveDemoShell>
```

| Prop            | Type                  | Required |
| --------------- | --------------------- | -------- |
| `items`         | `readonly EvalItem[]` | no       |
| `initialItemId` | string                | no       |

`initialItemId` decides which clip's record is open on first render — including
in the server-rendered HTML, which is why it defaults to a real clip rather than
to nothing. An id that is not in the run opens nothing instead of throwing.

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
   reviewed and tested as application code — pure logic _and_ the rendered
   component, see section 10 — and **must be documented in section 4 of this
   file before they are used in a post.**
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
2. **Vercel builds a preview** for the PR. Preview deployments build drafts,
   so a `draft: true` post has a real page there and is listed on
   `/engineering/`. They also emit `noindex, nofollow` and a `Disallow: /`
   `robots.txt`, so nothing on them can be indexed by search engines. Who can
   open a preview URL is governed by Vercel's **Deployment Protection** setting
   on the project — a preview link is viewable by whoever that protection
   allows, which is a Vercel setting, not something this repository controls.
3. **Editorial review happens on the preview URL**, not on the diff. Read the
   rendered post. Share the link with anyone who needs to review it.
4. **Merge to `main` publishes.** If the post has `draft: true`, merging is
   safe — the production build does not include it. Publishing is flipping
   `draft` to `false`.

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

Set `draft: true` in frontmatter. The post is then **built everywhere except
the production deploy**, which is what lets you share it for review.

### Where a draft shows up

| Build                                   | Draft page | Listed on `/engineering/` | In RSS |
| --------------------------------------- | ---------- | ------------------------- | ------ |
| `npm run dev`                           | yes        | yes                       | no     |
| Vercel **preview** (every pull request) | yes        | yes                       | no     |
| `npm run build` locally, and CI         | yes        | yes                       | no     |
| Vercel **production**                   | **no**     | **no**                    | no     |

The switch is `VERCEL_ENV === 'production'` and nothing else — see
`SHOW_DRAFTS` in `src/lib/site.ts`. There is no staging branch and no extra
Vercel configuration to set up: open a pull request and the draft is on the
preview deploy.

### Sharing a draft for review

Open a pull request. Vercel comments the preview URL on it; the draft is at its
real path and is listed on `/engineering/`, so a reviewer can just browse to it.

**Preview deployments sit behind Vercel's Deployment Protection.** Who can open
that URL — the team only, anyone with the link, or anyone at all — is a setting
on the Vercel project, not something this repository controls. Check it before
you treat a preview link as private, and do not put anything in a draft that
would be a problem if the link were forwarded.

### What keeps a draft out of production

- **No page is built.** `getVisiblePosts()` in `src/lib/posts.ts` drops drafts
  when `SHOW_DRAFTS` is false, and the post route's `getStaticPaths()` is driven
  by that helper. Nothing in `dist/`, so nothing to link to, crawl, or list in
  the sitemap — `@astrojs/sitemap` reads the pages that were actually emitted.
- **The index agrees with the routes.** `/engineering/` also reads
  `getVisiblePosts()`, so it lists exactly the posts this build has pages for.
  It never links to something that was not built.

### On builds that do render a draft

- **It is visibly badged "Draft"** — on its index card and above its title on
  the post page. In words, not just colour, so a preview cannot be mistaken for
  a published page.
- **It is not indexable.** The page emits `noindex, nofollow` (`PostLayout.astro`
  passes `noindex={data.draft}`), and every non-production deploy is
  `noindex, nofollow` with `Disallow: /` in `robots.txt` regardless.
- **It never enters RSS, related posts, or prev/next.** Those read
  `getPublishedPosts()`, which drops drafts in every environment. A draft is not
  part of the reading order between finished posts, and it is never syndicated.

### Checking the production behaviour locally

A plain `npm run build` includes drafts, because it is not a production deploy.
To reproduce what production actually emits, set the variable Vercel sets:

```bash
VERCEL_ENV=production npm run build
```

The draft's directory will be absent from `dist/engineering/`.

Merging a draft to `main` is safe. Publishing is a one-line change: flip
`draft` to `false` and merge.

---

## 9. Commands

| Command             | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Dev server at `http://localhost:4321`. Drafts visible.                       |
| `npm run build`     | Static build into `dist/`. Includes drafts unless `VERCEL_ENV=production`.   |
| `npm run preview`   | Serves the built `dist/` locally.                                            |
| `npm run lint`      | ESLint, including accessibility rules.                                       |
| `npm run typecheck` | `astro sync && tsc --noEmit`.                                                |
| `npm run check`     | `astro check` — Astro diagnostics and content schema.                        |
| `npm run test`      | Vitest: pure-logic tests (`.test.ts`) and island tests (`.test.tsx`, jsdom). |
| `npm run format`    | Prettier, writes in place.                                                   |
| `npm run verify`    | lint + typecheck + check + test + build. Run before every PR.                |

---

## 10. From a Markdown post to a custom interactive component

Everything above is the author's surface. This section is the engineer's: how a
plain Markdown post ends up with a bespoke, hydrated React component in the
middle of it, and what that component owes the reader.

Work through it in order. The example to copy is the pair
`EvalDotGrid.tsx` / `eval-explorer.ts` in `src/components/interactive/`.

### 10.1 Decide whether it should be an island at all

An island earns its place when **the reader changes something and the answer
changes**. A static figure that only ever shows one state is a `<Figure>` — it
is cheaper, it works with JavaScript off, and it cannot break.

Rule 7 of section 5 is the hard boundary: no authentication, no user data, no
secrets, no long-running compute, no saved state. This site is a static build
with no server. If your idea needs a backend, it belongs in a separate
application, not in a post.

### 10.2 Where the files go

Four files, colocated in `src/components/interactive/`:

```
src/components/interactive/
├── MyDemo.tsx          The component: markup, state, event handlers. Nothing else.
├── MyDemo.css          Colocated styles, imported at the top of MyDemo.tsx.
├── my-demo.ts          Pure logic: arithmetic, formatting, view models, index maths.
├── my-demo.test.ts     Vitest over the pure module. Node environment, fast.
└── MyDemo.test.tsx     Vitest over the component. jsdom, opted in per file.
```

**Why the logic is a separate file.** Two reasons, and both are load-bearing:

1. **SSR determinism.** An island is server-rendered during `astro build` and
   then hydrated in the browser. If the two renders disagree, React throws the
   server HTML away and you get a flash, a layout jump, or a subtly wrong page.
   Anything non-deterministic — `Date.now()`, `Math.random()`, a locale-default
   `toLocaleString()`, reading the viewport — is therefore a bug, not a style
   preference. Keeping the arithmetic and the formatting in a module with no
   imports and no DOM makes that property something you can _test_.
2. **Testability.** A pure function is tested with a table of inputs and
   expected outputs. Assertions about rounding, about macro-averaging, about
   what an empty dataset does — all of it belongs where it can be checked
   without rendering anything.

The rule of thumb: **if you are writing a `*`, a `.toFixed()` or a
`toLocaleString()` inside the `.tsx`, it belongs next door.**

### 10.3 The component itself

Copy the conventions from `ExampleCalculator.tsx`:

- Default export, plus an exported props interface. Every prop optional and
  documented; a post must not be able to break a page with a bad value, so
  clamp or fall back rather than throw.
- No `import React` — the automatic JSX runtime is configured in `tsconfig.json`.
- `useState` and `useId` only. **No `useEffect`, no timers, no network, no
  persistence, no analytics.** If you think you need an effect, you probably
  want a value derived during render. Focus management is the one exception,
  and it belongs in the event handler that caused the focus change — never in an
  effect that re-runs.
- Class names are component-prefixed and BEM-ish (`.my-demo__thing`), because
  the stylesheet is global once bundled.
- Styles use **only** the custom properties in `src/styles/global.css`. No hex,
  no `rgb()`, no invented colours, and **no `prefers-color-scheme` block** —
  the site is light-only and `src/styles/contrast.test.ts` fails the build if
  one appears.
- **Emit no `<h1>`–`<h3>`.** `InteractiveDemoShell` renders the demo's `<h3>`
  itself, so an island that adds one breaks the article outline. Use `<h4>` or
  non-heading markup.
- The pre-hydration HTML must already be correct and complete. Default state is
  a constant, not something computed from the environment.

### 10.4 Mounting it in a post

Always inside the shell, and always with the client directive on the **island**,
not on the shell:

```mdx
import InteractiveDemoShell from '@/components/interactive/InteractiveDemoShell.astro';
import MyDemo from '@/components/interactive/MyDemo.tsx';

<InteractiveDemoShell
  title="What this demo shows"
  description="One sentence on what the reader can change."
  sourceHref="https://github.com/jakeschaeffer/engblog/blob/main/src/components/interactive/MyDemo.tsx"
  fallbackSummary="The actual conclusion, in two or three sentences."
>
  <MyDemo client:visible />
</InteractiveDemoShell>
```

Note the `.tsx` extension in the import — it is required.

`client:visible` defers hydration until the demo scrolls into view, so a reader
who never reaches it pays nothing. See the note in section 4 for when that is
the wrong choice.

**The `fallbackSummary` bar.** It renders as plain text for every reader,
always, hydrated or not. Write the sentence you would have written if the post
had no demo in it: the conclusion, with the numbers in it. "Interactive demo
unavailable" is a failure, not a summary. If deleting the island would damage
the article, the summary is not doing its job.

### 10.5 The accessibility bar

Non-negotiable, and mostly the reason a custom component takes longer than it
looks:

- **Every control is a real control.** A `<div onClick>` is not a button. Lint
  will tell you (`jsx-a11y/click-events-have-key-events`,
  `no-static-element-interactions`, `interactive-supports-focus`), but the
  reason is that a `<div>` has no name, no role, no keyboard behaviour and no
  focus ring.
- **Give every control an accessible name that says something.** "Button" is
  not a name. `describeDot()` in `eval-explorer.ts` is the pattern: a sentence,
  generated by a pure function, unit tested.
- **Do not turn one widget into fifty tab stops.** A grid of items is _one_
  tab stop with a roving tabindex: arrow keys move between items, `Home`/`End`
  jump to the ends, and exactly one item has `tabindex="0"` at a time. Put the
  index arithmetic in the pure module (`nextDotIndex()`) so wrap-around and
  boundaries are tested rather than hoped for.
- **`Esc` closes whatever opens**, and focus returns to whatever opened it.
- **Never encode meaning in colour alone.** Use shape, or a word, or both, and
  give the reader a legend that names each state. The palette has one accent;
  it does not have four category colours, and inventing some is not an option.
- **Visible focus ring on everything.** `global.css` draws it; your job is to
  leave room so the ring is not clipped or colliding with a neighbour. Never
  `outline: none` without an equally visible replacement.
- **320px wide and 200% zoom, with no horizontal _page_ scroll.** Wide content
  scrolls inside its own container — `.demo__stage` already does this, and a
  wide table should also carry its own `overflow-x: auto` wrapper.
- **Reduced motion is handled globally.** Do not add your own media query.
- A value shown as a bar, a meter or a gauge must also be shown as text.

### 10.6 Testing it

Both halves are testable, and both are expected:

```bash
npm run test                 # everything
npx vitest run src/components/interactive/my-demo.test.ts
```

**Pure logic** (`my-demo.test.ts`) runs in the default `node` environment.
Import `describe`/`it`/`expect` from `vitest` explicitly — `globals` is off.
Cover the arithmetic, the formatting, the degradation path (what an empty or
undefined value renders as), and determinism: the same input must produce the
same string twice.

**The component** (`MyDemo.test.tsx`) runs in jsdom, opted into per file with a
docblock on the very first line:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});
```

That `afterEach` is not optional: Testing Library's automatic cleanup attaches
itself to a global `afterEach`, and this project runs with `globals: false`, so
without it every test renders into the previous test's DOM.

Test the things only a DOM can answer: that controls have the accessible names
you think they have (`getByRole` with a `name`, never a CSS selector), that
activating something changes the right thing, that `Esc` restores focus, that
arrow keys move focus and the tab stop follows, and that the component emits no
heading above `<h4>`. Do not re-test the arithmetic here.

### 10.7 Before you open the pull request

1. `npm run format`, then `npm run verify` — lint, typecheck, `astro check`,
   tests and a real build, in that order.
2. Document the component in **section 4 of this file**. Rule 4 of section 5
   makes that mandatory _before_ it is used in a post.
3. Read the post with JavaScript disabled. The `fallbackSummary` must carry the
   point on its own.
4. Walk section 11 of [README.md](README.md#11-accessibility-qa) — the manual
   keyboard, zoom and reduced-motion pass. Lint and jsdom do not catch reflow.
