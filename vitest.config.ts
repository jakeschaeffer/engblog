import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest covers two kinds of file, and nothing else.
 *
 *   1. **Pure logic modules** (every `.test.ts` file under `src/`). These have no DOM and no
 *      `astro:*` imports, so they run in the default `node` environment, which
 *      is the fastest thing available.
 *
 *   2. **React islands** (every `.test.tsx` file under `src/`). A component test needs a DOM,
 *      so each component test file opts itself into jsdom with a
 *
 *          // @vitest-environment jsdom
 *
 *      docblock on its first line. That is per-file rather than global on
 *      purpose: booting jsdom for the pure-logic suites would slow every run
 *      down for no benefit, and a pure module that quietly starts depending on
 *      `document` should fail rather than find one lying around.
 *
 * What still cannot run here: anything importing `astro:content` (or another
 * `astro:*` virtual module), because those modules only exist inside Astro's
 * build. That is why the post logic lives in `src/lib/post-utils.ts` (pure,
 * tested) with `src/lib/posts.ts` as the thin Astro-aware wrapper (untested
 * here, exercised by `astro build`).
 *
 * `globals: false` means tests import `describe`/`it`/`expect` from `vitest`
 * explicitly. Testing Library's automatic cleanup hooks onto a global
 * `afterEach`, which therefore does not exist — component tests call
 * `cleanup()` in their own `afterEach`.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig `paths` and astro.config.mjs `vite.resolve.alias`.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});
