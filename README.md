# Ode Engineering

The engineering publication. Astro 7, static output, MDX posts, deployed on
Vercel.

Writing a post? Go to [AUTHORING.md](AUTHORING.md). This file is for people
working on the site itself.

---

## 1. What this is, and what it is not

**What it is:** a static, editorial engineering publication. Posts are MDX
files in `src/content/posts/`, validated against a strict schema, built into
plain HTML, and served from a CDN. Posts can embed approved components,
including hydrated React islands, without leaving Markdown.

**What it is not:**

- **Not a documentation portal.** No Starlight, no docs sidebar, no versioned
  reference tree. It is long-form editorial writing.
- **Not a CMS.** There is no admin UI and no editing surface. Content is files
  in git, reviewed in pull requests.
- **Not the Webflow marketing site.** `ode.com` stays on Webflow. See section 10.
- **No database, no auth, no comments, no newsletter, no search, no
  analytics.** None of these exist in this repository. The build is fully
  static (`output: 'static'` in `astro.config.mjs`); there is no server at
  runtime.

That is a deliberate starting point, not a permanent ceiling. The structure is
set up so those can be added later without a rewrite: site identity is
centralised in `src/lib/site.ts`, all content queries go through
`src/lib/posts.ts`, brand values are tokens in one CSS block, and pure logic
sits in `src/lib/post-utils.ts` behind unit tests. Adding search or a newsletter
means adding a module and (for anything dynamic) an adapter — not unpicking
assumptions spread across components.

---

## 2. Prerequisites and local commands

- **Node 22** — pinned in `.nvmrc`. `nvm use` picks it up.
- **npm** — `package-lock.json` is committed; use `npm ci` in CI and `npm
install` locally.

```bash
nvm use
npm install
npm run dev
```

`npm run dev` starts Astro's dev server at **http://localhost:4321**. Drafts are
visible there.

Every script in `package.json`:

| Script              | Command                                          | What it does / when you run it                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`       | `astro dev`                                      | Dev server on `http://localhost:4321`, HMR, drafts visible. Your default loop.                                                                                                                                 |
| `npm run build`     | `astro build`                                    | Production static build into `dist/`. Drafts excluded. This is what Vercel runs.                                                                                                                               |
| `npm run preview`   | `astro preview`                                  | Serves the already-built `dist/` locally. Use it to check the real production output (no drafts, no dev-only behaviour).                                                                                       |
| `npm run typecheck` | `astro sync && tsc --noEmit`                     | TypeScript only. Fast. Run while working on `src/lib/` or a `.tsx` island. `astro sync` first because `tsc` needs the generated `.astro/types.d.ts`, which is gitignored and so is absent on a clean checkout. |
| `npm run check`     | `astro check`                                    | Astro-aware diagnostics: `.astro` component props, template types, content-collection schema. Catches things `tsc` alone cannot.                                                                               |
| `npm run lint`      | `eslint .`                                       | ESLint: typescript-eslint, `eslint-plugin-astro`, and the jsx-a11y accessibility rulesets. See section 11.                                                                                                     |
| `npm run format`    | `prettier --write .`                             | Formats in place, including `.astro` via `prettier-plugin-astro`.                                                                                                                                              |
| `npm run test`      | `vitest run`                                     | Unit tests over `src/**/*.test.ts` (pure logic only — see `vitest.config.ts`).                                                                                                                                 |
| `npm run verify`    | all of the above except `dev`/`preview`/`format` | `lint && typecheck && check && test && build`. Run before pushing; it is what CI runs.                                                                                                                         |

Environment: copy `.env.example` to `.env` if you need to override anything.
Locally you generally do not — `SITE_URL` falls back to
`http://localhost:4321`.

---

## 3. Repository structure

```
.
├── .github/workflows/ci.yml     CI: install, lint, typecheck, check, test, build
├── astro.config.mjs             Integrations (MDX, React, sitemap), site URL, Shiki config
├── docs/
│   ├── images.md                Sizing rules and the resize/OG-crop commands
│   └── post-template.md         Copy-pasteable post skeleton (kept OUT of the content glob)
├── eslint.config.js             Flat config; includes the a11y rulesets
├── public/                      Served verbatim at the site root; no image pipeline
│   ├── favicon.svg
│   └── images/
│       ├── og-default.png       The default og:image. 1200x630 raster — see section 12
│       ├── og-default.svg       Source for the above; regenerate per docs/images.md
│       └── <post-slug>/         One directory of images per post
├── src/
│   ├── components/
│   │   ├── article/             Article furniture: header, card, prose wrapper, TOC, footer
│   │   ├── chrome/              Site-wide header, nav and footer
│   │   ├── interactive/         React islands + InteractiveDemoShell, its frame
│   │   └── mdx/                 Callout, Figure, LinkCard — the approved author surface
│   ├── content/
│   │   └── posts/               The posts. One .mdx file per post; filename = slug
│   ├── content.config.ts        The `posts` collection: strict Zod schema + glob loader
│   ├── layouts/
│   │   ├── BaseLayout.astro     Document shell: head, meta, robots, skip link, chrome
│   │   └── PostLayout.astro     Article shell: canonical, OG article tags, JSON-LD
│   ├── lib/
│   │   ├── site.ts              SITE_URL, BASE_PATH, names, OG default, indexing rule
│   │   ├── posts.ts             The only place that queries the collection; draft rule
│   │   ├── post-utils.ts        Pure logic: sorting, related, prev/next, dates
│   │   ├── structured-data.ts   JSON-LD Article builder
│   │   └── *.test.ts            Vitest unit tests for the pure modules
│   ├── pages/
│   │   ├── index.astro          `/` — a one-screen landing page, not a redirect
│   │   ├── engineering/
│   │   │   ├── index.astro      `/engineering/` — the publication index
│   │   │   └── [slug].astro     `/engineering/<slug>/` — the article route
│   │   ├── rss.xml.ts           `/rss.xml` — the feed, built from getPublishedPosts()
│   │   ├── robots.txt.ts        `/robots.txt` — mirrors the indexing rule; see section 8
│   │   └── 404.astro            `/404` — always noindex, excluded from the sitemap
│   └── styles/global.css        Brand tokens + global styles. Single source of truth
├── tsconfig.json                Strict, extends astro/tsconfigs/strict; `@/*` -> `src/*`
├── vitest.config.ts             Scoped to pure modules; no `astro:*` imports
├── .prettierrc                  Formatting rules, incl. prettier-plugin-astro
├── .prettierignore              Build output, lockfile, and the verbatim ported post
├── .nvmrc                       Node 22
└── .env.example                 Documented environment variables
```

`sitemap-index.xml` and `sitemap-0.xml` are not in this tree because they are
not source files — `@astrojs/sitemap` generates them into `dist/` from the pages
the build actually emitted.

Three structural rules worth knowing:

- **Nothing calls `getCollection('posts')` except `src/lib/posts.ts`.** That is
  what makes the draft rule hold everywhere at once.
- **`src/lib/post-utils.ts` imports nothing from `astro:*`**, which is why it
  can be unit tested in plain Node.
- **Every public URL is built by `postPath()` / `BASE_PATH` in
  `src/lib/site.ts`, and includes a trailing slash.** See section 3.1.

### 3.1 One spelling per URL: the trailing slash

`postPath()` returns `/engineering/<slug>/`. Everything downstream — the
canonical `<link>`, `og:url`, the JSON-LD `url`, the RSS `<link>`, and every
internal link on the site — is built from it, so they are byte-identical to each
other and to the sitemap entry.

The sitemap is what forces the choice. `astro build` uses the default
`directory` output format, emitting `dist/engineering/<slug>/index.html`, and
`@astrojs/sitemap` derives its entries from the pages that were actually
emitted — so the sitemap says `/engineering/<slug>/` and cannot be talked out of
it without changing the build format. Matching it in `postPath()` is one
character; the alternative is switching the whole site to `build.format: 'file'`
to make it match the other way. `BASE_PATH` already ends in a slash, so this is
also the internally consistent option.

Two spellings of one URL is not a cosmetic problem: a crawler that finds
`/engineering/x` in your feed and `/engineering/x/` in your sitemap has two
candidate URLs for one page, and picks the canonical itself.

`trailingSlash` is left at Astro's default (`'ignore'`), so both spellings still
resolve and an inbound link to the slashless form keeps working. Only what the
site _emits_ is normalised. If you ever add a URL by hand, add the slash.

---

## 4. Creating a new post

```bash
cp docs/post-template.md src/content/posts/my-post-title.mdx
npm run dev
```

The filename becomes the URL slug: `my-post-title.mdx` →
`/engineering/my-post-title/`. Full frontmatter reference, Markdown examples,
component usage and the review workflow are in [AUTHORING.md](AUTHORING.md).

`docs/post-template.md` deliberately lives outside `src/content/posts/`. The
collection loader globs `**/*.mdx` under that directory and validates every
match against the strict schema, so a template with placeholder values sitting
inside it would fail the build.

---

## 5. MDX components and the approval model

Posts may use a fixed, reviewed set of components — not arbitrary code. Author-
facing components live in `src/components/mdx/`; React islands live in
`src/components/interactive/` and are hydrated with a `client:` directive
(`client:visible` by default, so a demo halfway down a post costs a reader
nothing until they scroll to it). Both are application code: they go through
normal engineering review, they are typechecked and linted like everything else,
and a new one is documented in AUTHORING.md in the same pull request that adds
it. Posts must not contain raw `<script>` tags, injected HTML, external embeds,
or imports from `node_modules`. The reason is blast radius — a post is written
and reviewed on an editorial track, so the set of things a post can execute has
to be a reviewed, finite list rather than "whatever MDX allows". Author-facing
usage and props are documented in [AUTHORING.md](AUTHORING.md#4-approved-components).

---

## 6. How drafts work

Set `draft: true` in a post's frontmatter (the schema defaults it to `false`).

Verified against `src/lib/posts.ts`, `astro.config.mjs`,
`src/layouts/PostLayout.astro`, `src/pages/engineering/[slug].astro` and
`src/pages/rss.xml.ts`:

- `getVisiblePosts()` returns drafts **only when `import.meta.env.DEV` is
  true**. Post routes drive `getStaticPaths()` from this helper, so a draft gets
  a real, readable page in `npm run dev` and **no page at all** in a production
  build.
- `getPublishedPosts()` **never** returns drafts. Indexes, RSS, related posts
  and prev/next all read that helper, so a draft never appears in navigation
  even in dev.
- **Sitemap:** because production `getStaticPaths()` emits no page for a draft,
  `@astrojs/sitemap` cannot list it — the sitemap is generated from pages that
  were actually built. The `filter` in `astro.config.mjs` (dropping `/404` and
  `/draft/`) is a backstop, not the mechanism.
- **RSS:** `src/pages/rss.xml.ts` reads `getPublishedPosts()`, which excludes
  drafts in every environment — including `npm run dev`, where a draft has a
  readable page but still no feed item. Each item's `<link>` is
  `absoluteUrl(postPath(post.id))`, the same expression the canonical tag uses,
  so a feed link cannot drift from the page it points at.
- Additionally, a draft page emits `noindex, nofollow` — `PostLayout.astro`
  passes `noindex={data.draft}` to `BaseLayout`.

Net effect: a `draft: true` post is safe to merge to `main`. Publishing is
flipping one boolean.

---

## 7. Brand tokens and theming

**`src/styles/global.css`** is the single source of truth for brand values. The
tokens are the `:root { … }` block at the top of the file (starts at line 36),
organised into numbered sections:

| Section                   | Tokens                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1. COLOUR                 | `--color-bg`, `--color-surface`, `--color-text*`, `--color-border*`, `--color-accent*`, `--color-success/warning/danger`, selection |
| 2. TYPE                   | `--font-sans/serif/mono`, `--text-xs … --text-4xl` (fluid `clamp()`), weights, `--leading-*`, `--tracking-*`                        |
| 3. SPACING                | `--space-3xs … --space-3xl`                                                                                                         |
| 4. MEASURE & LAYOUT       | `--measure`, `--measure-narrow`, `--width-content/wide/full`, `--width-toc`, `--gutter`                                             |
| 5. RADIUS, BORDER, SHADOW | `--radius-xs … --radius-pill`, `--border*`, `--shadow-sm/md`                                                                        |
| 6. FOCUS                  | `--focus-ring-width/offset/color`                                                                                                   |
| 7. MOTION                 | `--duration-fast/base`, `--easing`                                                                                                  |
| 8. Z-INDEX                | `--z-base/sticky/header/skip-link`                                                                                                  |

The dark palette is **section 9**, a `@media (prefers-color-scheme: dark)` block
overriding the same token names with hand-picked values (not an inversion).
Dark mode is media-query only: no toggle, no client JS, no localStorage.

**This is the one place to align the site with Webflow brand styling later.**
Components read tokens and never hard-code a colour, size or radius, so a
re-brand is: replace the values in section 1 and the fonts in section 2, keep
the token _names_, then re-check section 9 separately. The file header spells
out the same procedure. No CSS framework, no utility classes — component styles
are Astro scoped `<style>` blocks that consume these tokens.

---

## 8. Preview deployments

Vercel builds a preview deployment for every pull request, at its own URL.
Editorial review happens on that URL, not on the diff.

**Preview deploys are never indexable.** `src/lib/site.ts` reads Vercel's
injected `VERCEL_ENV` and sets:

```ts
export const IS_PRODUCTION_DEPLOY: boolean = VERCEL_ENV === 'production';
```

`BaseLayout.astro` then emits, on every page:

```ts
const robots = noindex || !IS_PRODUCTION_DEPLOY ? 'noindex, nofollow' : 'index, follow';
```

So the keying is `VERCEL_ENV === 'production'` — nothing else. Preview deploys,
branch deploys, CI builds and local `astro build` all produce
`<meta name="robots" content="noindex, nofollow">`, because `VERCEL_ENV` is
either `preview`/`development` or absent. Only the production Vercel deployment
emits `index, follow`. A page can additionally opt out by passing
`noindex={true}` to `BaseLayout`; draft posts do exactly that.

### `robots.txt` follows the same switch

`src/pages/robots.txt.ts` reads the same `IS_PRODUCTION_DEPLOY` flag and emits
one of two bodies:

- **Production** — `User-agent: * / Allow: /`, plus a `Sitemap:` line pointing
  at `<SITE_URL>/sitemap-index.xml`. The sitemap is advertised only here,
  because only here are the listed URLs the canonical ones.
- **Everything else** (preview, branch, CI, local `astro build`) —
  `User-agent: * / Disallow: /`, and **no `Sitemap:` line**.

The two mechanisms are complementary, not redundant. `robots.txt` stops a
crawler fetching a preview URL at all; the meta tag covers a URL that was
reached some other way, such as a shared link. `Disallow` alone does not
de-index — a disallowed URL can still appear in results from inbound links —
which is why the `noindex` meta tag exists as well. They must agree, and they do
because they read the same constant.

Consequence when debugging: if a production deploy is not being indexed, check
`VERCEL_ENV` before anything else. `curl https://<host>/robots.txt` is the
fastest way to see which branch the deploy took.

---

## 9. Deploying on Vercel

1. **The repository is `github.com/jakeschaeffer/engblog`.** `main` is the
   production branch.
2. **Import the repo into Vercel.** Vercel detects Astro and uses `npm run
build` with an output directory of `dist/`; the defaults are correct.
3. **Add the `SITE_URL` environment variable** in Vercel (Project → Settings →
   Environment Variables), set to the canonical origin with **no trailing
   slash**, e.g. `https://engineering.ode.com`. It is read by
   `astro.config.mjs` (which sets Astro's `site`) and by `src/lib/site.ts`
   (canonical URLs, OG tags, RSS, JSON-LD, sitemap). Without it, the build falls
   back to `http://localhost:4321` and ships localhost URLs in production
   metadata. Set it for Production; set it for Preview too if you want previews
   to self-reference correctly. Never set `VERCEL_ENV` by hand — Vercel injects
   it.
4. **Use preview deployments for pull requests** — they are automatic once the
   repo is imported. Review on the preview URL.

**No adapter and no `vercel.json` are needed.** `astro.config.mjs` sets `output:
'static'`, so `astro build` emits a plain directory of HTML, CSS, JS and assets
into `dist/`. Vercel detects an Astro static build and serves that directory
from its CDN. An adapter (`@astrojs/vercel`) only matters when you need
server-rendered routes, middleware or edge functions at runtime — this site has
none. Likewise `vercel.json` exists to override routing, headers or rewrites;
the defaults for a static site are already what we want. Adding either now would
be configuration to maintain with nothing to configure.

---

## 10. Future: serving under `ode.com/engineering/*` (out of scope)

> **Out of scope for this repository.** Nothing in this repo implements or
> configures this. It is recorded here so the design intent is not lost.

`ode.com` is a Webflow site and stays on Webflow. This publication is a separate
origin on Vercel. Serving both under one hostname — Webflow at `ode.com/*` and
this site at `ode.com/engineering/*` — requires a reverse proxy at the edge
(Cloudflare Workers, Fastly, or similar) sitting in front of both origins,
routing by path prefix: `/engineering/*` to the Vercel deployment, everything
else to Webflow. That proxy, its DNS, and its cache rules are configured outside
this repository. What this repo already does to stay compatible is mount every
post under `BASE_PATH = '/engineering/'` (`src/lib/site.ts`), so the path prefix
does not have to be rewritten in flight.

**The initial public hostname is expected to be a Vercel URL or
`engineering.ode.com`** — a subdomain needs only a DNS record and no proxy, so
it is the path of least resistance for launch. Whichever it is, set it as
`SITE_URL` in Vercel production.

---

## 11. Accessibility QA

### Automated

`npm run lint` runs the accessibility rules. Confirmed in `eslint.config.js`:

- `astro.configs['flat/jsx-a11y-recommended']` — runs `eslint-plugin-jsx-a11y`
  rules against the **Astro template AST** (`.astro` files). Missing alt text,
  unlabelled controls, bad ARIA and non-interactive click handlers fail lint.
- A separate block applies `jsxA11y.flatConfigs.recommended` to
  `**/*.{jsx,tsx}`, so **React islands get the same rules**.

That is the whole automated surface. There is no axe run, no Lighthouse gate,
no contrast checking in CI. Lint catches static markup mistakes; it cannot
catch focus order, keyboard traps, contrast, or reflow.

### Manual checklist

Run this on the Vercel preview before merging anything that changes components,
layouts or CSS. It takes a few minutes.

- [ ] **Keyboard-only pass.** Unplug the mouse. `Tab` from the top of the page:
      the **skip link** must be the first focusable element, must become visible
      when focused, and activating it must move focus into `<main>` (not just
      scroll). Reach every link, button and control in a sensible order; nothing
      traps focus; `Esc` closes anything that opens.
- [ ] **Visible focus on every control.** A focus ring on every interactive
      element, in both light and dark mode, with enough contrast against its
      background. Nothing may set `outline: none` without an equally visible
      replacement.
- [ ] **Heading outline.** One `<h1>` per page. No skipped levels. Read the
      headings alone (browser reading-mode or an outline extension) — they
      should summarise the article.
- [ ] **Alt text on every image.** Meaningful images describe what they show;
      decorative images use `alt=""`. No filenames, no "image of".
- [ ] **Colour contrast.** Body text, muted text, link text, code, and callout
      text against their actual backgrounds, in **both** light and dark mode.
      4.5:1 for body text, 3:1 for large text and UI borders. Test the dark
      palette separately — it is hand-picked, not derived.
- [ ] **200% zoom and 320px width.** Browser zoom to 200%, and a 320px-wide
      viewport: **no horizontal page scroll**. Code blocks and wide tables are
      allowed to scroll — but inside their own container, never the page.
- [ ] **Readable with JavaScript disabled.** Disable JS and reload an article.
      The full text, images, code blocks and navigation must still work. Every
      interactive demo must show its `fallbackSummary` — the argument of the
      post has to survive without the island.
- [ ] **Reduced motion.** With `prefers-reduced-motion: reduce`, nothing
      animates or smooth-scrolls.

---

## 12. Launch checklist

- [ ] **Sign off on the default OG card's wording and mark.**
      `public/images/og-default.png` (1200×630 raster — social crawlers do not
      render an SVG `og:image`) is built from the site's own tokens and says
      "Ode Engineering" over the site description. It is deliberately plain. If
      brand has a wordmark they want on it, edit
      `public/images/og-default.svg`, regenerate per `docs/images.md`, and
      re-check the preview in Slack and on X before announcing.
- [ ] **Set `SITE_URL` in Vercel production** to the canonical origin, no
      trailing slash. Confirm the built HTML contains that origin in
      `<link rel="canonical">`, `og:url`, `og:image`, the RSS channel and the
      sitemap — not `localhost:4321`.
- [ ] **Confirm the production hostname** (Vercel URL vs `engineering.ode.com`)
      and point DNS at it before announcing anything. Changing it after launch
      means redirects.
- [ ] **Verify `robots` and the sitemap on the production deploy.** View source
      on a live post: it must say `index, follow`, not `noindex, nofollow`. If
      it says noindex, `VERCEL_ENV` is not `production`. Then fetch
      `/sitemap-index.xml` and confirm it lists the real post URLs and no
      drafts.
- [ ] **Confirm the ported post's canonical URL points where you want it.**
      Posts migrated from Hashnode: if the Hashnode version stays up, set
      `canonicalUrl` to it; if Hashnode is being retired or redirected, leave
      `canonicalUrl` unset so this site is canonical. Check the rendered
      `<link rel="canonical">` on each ported post. `hashnodeUrl` does not
      affect canonicalisation — it is provenance only and is never rendered.
- [ ] **RSS feed loads** at `/rss.xml` and validates.
- [ ] **Check a real link preview.** Paste a post URL into Slack and into the X
      card validator. Both should show the 1200×630 image, the title and the
      description. This is the check that catches an `og:image` resolving to
      `localhost` or 404ing.
- [ ] **Confirm the ported post's attribution.** The Rotten Tomatoes post is a
      verbatim port of Dan Girellini's article. Its body is excluded from
      `npm run format` (see `.prettierignore`) so it stays byte-identical to the
      original. Confirm with the author before it runs under this masthead.
- [ ] **Run the manual accessibility checklist** (section 11) against
      production.

---

## Related documents

- [AUTHORING.md](AUTHORING.md) — writing and publishing posts
- [docs/post-template.md](docs/post-template.md) — copy-pasteable post skeleton
- [docs/images.md](docs/images.md) — image sizing, OG crops, regenerating the default card
- [.env.example](.env.example) — environment variables, documented
