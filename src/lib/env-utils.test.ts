import { describe, expect, it } from 'vitest';

import { shouldIncludeDrafts } from './env-utils';

describe('shouldIncludeDrafts', () => {
  it('includes drafts on the dev server', () => {
    expect(shouldIncludeDrafts({ dev: true, vercelEnv: undefined })).toBe(true);
  });

  it('excludes drafts on a production Vercel deploy', () => {
    expect(shouldIncludeDrafts({ dev: false, vercelEnv: 'production' })).toBe(false);
  });

  it('includes drafts on a preview deploy', () => {
    expect(shouldIncludeDrafts({ dev: false, vercelEnv: 'preview' })).toBe(true);
  });

  /**
   * No `VERCEL_ENV` means the build is not a Vercel deployment at all — a local
   * `npm run build`, or CI. Those are not the site readers land on, so they get
   * drafts.
   */
  it('includes drafts when VERCEL_ENV is absent', () => {
    expect(shouldIncludeDrafts({ dev: false, vercelEnv: undefined })).toBe(true);
  });

  /**
   * The dev server is a local server regardless of what the shell exports, so
   * `dev` wins over a stray `VERCEL_ENV=production`.
   */
  it('treats the dev server as draft-visible even if VERCEL_ENV says production', () => {
    expect(shouldIncludeDrafts({ dev: true, vercelEnv: 'production' })).toBe(true);
  });

  it('is the exact complement of the production-deploy test', () => {
    for (const vercelEnv of ['production', 'preview', 'development', '', undefined]) {
      expect(shouldIncludeDrafts({ dev: false, vercelEnv })).toBe(vercelEnv !== 'production');
    }
  });
});
