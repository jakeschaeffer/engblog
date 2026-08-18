// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

/**
 * Canonical site origin.
 *
 * Single source of truth: the `SITE_URL` environment variable. Locally (and in
 * any context where it is unset) we fall back to Astro's dev server origin so
 * that `Astro.site` is always defined and canonical/OG URL building never has
 * to branch on `undefined`.
 *
 * Keep this in sync with `src/lib/site.ts`, which performs the same resolution
 * for runtime (component) code. Astro config runs in Node before the Astro
 * runtime exists, so the two cannot share a module cleanly without pulling
 * `astro:*` virtual modules into the config graph.
 */
const SITE_URL = process.env.SITE_URL || 'http://localhost:4321';

/**
 * Shiki transformer: adds a build-time language label to every fenced code
 * block, with **no client JavaScript**.
 *
 * Astro's own Shiki wrapper already stamps `data-language="<lang>"` onto the
 * `<pre>`. A CSS `::before` on that attribute would work, but the `<pre>` is
 * the horizontal scroll container, so an absolutely-positioned label scrolls
 * out of view on wide code. Instead we wrap the `<pre>` in a
 * `<figure data-code-block>` and emit a sibling `<div class="code-block__lang">`
 * that stays put while the code scrolls underneath it.
 *
 * This runs after Astro's internal transformer (user transformers are appended
 * to the internal list), so `dataLanguage` is guaranteed to be populated.
 *
 * @type {import('shiki').ShikiTransformer}
 */
const codeBlockLanguageLabel = {
  name: 'ode:code-block-language-label',
  root(root) {
    const pre = root.children.find((node) => node.type === 'element' && node.tagName === 'pre');
    if (!pre || pre.type !== 'element') return;

    const raw = pre.properties?.['dataLanguage'];
    const lang = typeof raw === 'string' ? raw : '';
    // Unlabelled/plaintext blocks get the wrapper but no visible chip.
    const showLabel = lang !== '' && lang !== 'plaintext' && lang !== 'text';

    /** @type {import('hast').Element[]} */
    const children = [];
    if (showLabel) {
      children.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block__lang'], 'aria-hidden': 'true' },
        children: [{ type: 'text', value: lang }],
      });
    }
    children.push(pre);

    return {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'figure',
          properties: { 'data-code-block': '', className: ['code-block'] },
          children,
        },
      ],
    };
  },
};

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  // Fully static export. Vercel auto-detects Astro static builds and serves
  // `dist/` directly, so no adapter and no `vercel.json` are required.
  output: 'static',

  integrations: [
    mdx(),
    react(),
    sitemap({
      /**
       * Drops the 404 page, which is the only built page that should never be
       * advertised for crawling.
       *
       * Drafts need no clause here, and the `/draft/` one that used to sit in
       * this filter was removed because it matched nothing: no route emits a
       * `/draft/` segment, so it implied a protection it did not provide.
       *
       * What actually keeps drafts out of a production sitemap is that they
       * are not built in production. `src/lib/posts.ts#getVisiblePosts()`
       * returns drafts only when `SHOW_DRAFTS` is true — never on a
       * `VERCEL_ENV=production` deploy — and the post route's
       * `getStaticPaths()` is driven by that helper. `@astrojs/sitemap` reads
       * the pages that were actually emitted, so a page that does not exist
       * cannot be listed.
       *
       * On the deploys that *do* build drafts, a draft may well appear in
       * that build's sitemap — which costs nothing, because a non-production
       * deploy never advertises the file. `src/pages/robots.txt.ts` emits
       * `Disallow: /` with no `Sitemap:` line off production, and
       * `src/layouts/BaseLayout.astro` marks every page on such a deploy
       * `noindex, nofollow`.
       */
      filter: (page) => !page.includes('/404'),
    }),
  ],

  markdown: {
    // Shiki is the default highlighter, running a single light theme. The Ode
    // brand guide sanctions no dark theme and approves no text-on-dark
    // pairing, so the site is light-only and there is nothing for a second
    // theme to switch to. One theme also means Shiki inlines real colours
    // rather than `--shiki-dark*` custom properties, so `src/styles/global.css`
    // needs no `!important` overrides to swap them.
    shikiConfig: {
      theme: 'github-light',
      // Code blocks scroll horizontally instead of soft-wrapping. Astro adds
      // `overflow-x: auto` to the <pre> for us when wrap is false.
      wrap: false,
      transformers: [codeBlockLanguageLabel],
    },
  },

  vite: {
    resolve: {
      alias: {
        // Mirrors the `@/*` path mapping in tsconfig.json. tsconfig paths are
        // type-level only; Vite needs its own alias to actually resolve the
        // import at build time.
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
