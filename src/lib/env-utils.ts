/**
 * Pure predicates over build-environment values.
 *
 * Like `post-utils.ts` this file is deliberately free of any `astro:*` import
 * — and, unlike `post-utils.ts`, it imports nothing at all. That matters:
 * `site.ts` needs `shouldIncludeDrafts` to compute `SHOW_DRAFTS`, while
 * `post-utils.ts` already imports `SITE_LANG` from `site.ts`. Putting this
 * predicate in `post-utils.ts` would therefore have made `site.ts` and
 * `post-utils.ts` import each other. A leaf module with no imports of its own
 * cannot participate in a cycle no matter who imports it.
 */

/** The environment facts that decide whether drafts are built. */
export interface DraftVisibilityEnv {
  /** `import.meta.env.DEV` — true only under `astro dev`. */
  readonly dev: boolean;
  /**
   * `VERCEL_ENV`, or `undefined` when the build is not running on Vercel.
   * Vercel sets it to one of 'production' | 'preview' | 'development'.
   */
  readonly vercelEnv: string | undefined;
}

/**
 * Whether this build should include draft posts.
 *
 * The rule is stated as a single exclusion rather than a list of inclusions:
 * **drafts are hidden only on a real production deploy.** Vercel always
 * injects `VERCEL_ENV` into a deployment's build, so `'production'` is the one
 * value that can identify the deploy readers actually land on. Everything else
 * — the dev server, preview and branch deploys, CI builds, a local
 * `npm run build`, and any environment where `VERCEL_ENV` is simply absent —
 * shows drafts.
 *
 * Framing it this way is what makes preview deploys useful for review: a draft
 * renders on *every* Vercel preview with no extra branch, environment or
 * project configuration. It also fails safe in the direction that matters. A
 * missing `VERCEL_ENV` means "not the production deploy", so the worst
 * misconfiguration shows drafts on a build nobody reads, rather than hiding
 * them from the preview that a reviewer was sent.
 *
 * Note the `dev` term is not redundant. `astro dev` on a machine that happens
 * to export `VERCEL_ENV=production` is still a local dev server, not the
 * production deploy.
 */
export function shouldIncludeDrafts(env: DraftVisibilityEnv): boolean {
  return env.dev || env.vercelEnv !== 'production';
}
