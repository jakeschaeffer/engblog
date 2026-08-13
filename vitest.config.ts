import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest is scoped to pure logic modules only.
 *
 * Anything that imports `astro:content` (or another `astro:*` virtual module)
 * cannot run here — those modules only exist inside Astro's build. That is why
 * the post logic lives in `src/lib/post-utils.ts` (pure, tested) with
 * `src/lib/posts.ts` as the thin Astro-aware wrapper (untested here, exercised
 * by `astro build`).
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
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
