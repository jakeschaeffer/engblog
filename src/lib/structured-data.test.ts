import { describe, expect, it } from 'vitest';

import { buildArticleStructuredData, serializeStructuredData } from './structured-data';

const base = {
  title: 'Porting our first engineering post',
  description: 'What we learned moving off Hashnode.',
  publishedAt: new Date('2026-07-02T00:00:00.000Z'),
  authors: [{ name: 'Jake Schaeffer', role: 'Engineering' }],
  tags: ['migration', 'astro'],
  url: 'https://example.com/engineering/porting-our-first-engineering-post',
};

describe('buildArticleStructuredData', () => {
  it('emits a schema.org Article node', () => {
    const node = buildArticleStructuredData(base);
    expect(node['@context']).toBe('https://schema.org');
    expect(node['@type']).toBe('Article');
    expect(node.headline).toBe(base.title);
    expect(node.url).toBe(base.url);
    expect(node.mainEntityOfPage['@id']).toBe(base.url);
  });

  it('falls back to datePublished when there is no updatedAt', () => {
    const node = buildArticleStructuredData(base);
    expect(node.datePublished).toBe('2026-07-02');
    expect(node.dateModified).toBe('2026-07-02');
  });

  it('uses updatedAt for dateModified when present', () => {
    const node = buildArticleStructuredData({
      ...base,
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(node.dateModified).toBe('2026-08-01');
  });

  it('maps authors to Person nodes and omits jobTitle when there is no role', () => {
    const node = buildArticleStructuredData({
      ...base,
      authors: [{ name: 'With Role', role: 'Staff Engineer' }, { name: 'No Role' }],
    });
    expect(node.author).toEqual([
      { '@type': 'Person', name: 'With Role', jobTitle: 'Staff Engineer' },
      { '@type': 'Person', name: 'No Role' },
    ]);
  });

  it('joins tags into a keywords string', () => {
    expect(buildArticleStructuredData(base).keywords).toBe('migration, astro');
  });

  it('resolves the image to an absolute URL', () => {
    const node = buildArticleStructuredData({ ...base, image: '/images/custom.png' });
    expect(node.image[0]).toMatch(/^https?:\/\/.+\/images\/custom\.png$/);
  });

  it('falls back to the default OG image', () => {
    expect(buildArticleStructuredData(base).image[0]).toMatch(/\/images\/og-default\.png$/);
  });

  // Regression guard. The default started life as an SVG, which every social
  // crawler (X, LinkedIn, Slack, Facebook, iMessage) silently declines to
  // render — the preview shows nothing at all rather than failing loudly. The
  // default OG image has to stay a raster format.
  it('never falls back to a vector image', () => {
    expect(buildArticleStructuredData(base).image[0]).not.toMatch(/\.svg$/);
  });
});

describe('serializeStructuredData', () => {
  it('produces parseable JSON', () => {
    const json = serializeStructuredData(buildArticleStructuredData(base));
    expect(JSON.parse(json)).toMatchObject({ '@type': 'Article' });
  });

  it('escapes < so a title cannot break out of the script tag', () => {
    const json = serializeStructuredData(
      buildArticleStructuredData({ ...base, title: 'a </script> title' }),
    );
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script>');
    // Still valid JSON, and the escape round-trips to the original character.
    expect(JSON.parse(json).headline).toBe('a </script> title');
  });
});
