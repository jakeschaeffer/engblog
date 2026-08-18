/**
 * JSON-LD builders.
 *
 * Pure functions returning plain objects, so they can be unit tested without
 * rendering a page. Serialise with `JSON.stringify` into a
 * `<script type="application/ld+json">` tag.
 *
 * No `astro:*` imports here — keep it that way.
 */

import { BRAND_NAME, DEFAULT_OG_IMAGE, SITE_LANG, absoluteUrl } from './site';
import { toISODate } from './post-utils';

/** Author credit as it appears in post frontmatter. */
export interface StructuredDataAuthor {
  readonly name: string;
  readonly role?: string | undefined;
  readonly avatar?: string | undefined;
}

/** Everything the Article builder needs from a post. */
export interface ArticleStructuredDataInput {
  readonly title: string;
  readonly description: string;
  readonly publishedAt: Date;
  readonly updatedAt?: Date | undefined;
  readonly authors: readonly StructuredDataAuthor[];
  readonly tags: readonly string[];
  /** Absolute canonical URL of the post. */
  readonly url: string;
  /** Site-relative or absolute image path. Falls back to the default OG image. */
  readonly image?: string | undefined;
}

/** schema.org Person node. */
export interface PersonNode {
  readonly '@type': 'Person';
  readonly name: string;
  readonly jobTitle?: string;
}

/** schema.org Article node (subset we emit). */
export interface ArticleNode {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'Article';
  readonly headline: string;
  readonly description: string;
  readonly datePublished: string;
  readonly dateModified: string;
  readonly author: readonly PersonNode[];
  readonly publisher: {
    readonly '@type': 'Organization';
    readonly name: string;
  };
  readonly mainEntityOfPage: {
    readonly '@type': 'WebPage';
    readonly '@id': string;
  };
  readonly url: string;
  readonly image: readonly string[];
  readonly keywords: string;
  readonly inLanguage: string;
}

/**
 * Build the `Article` node for a post.
 *
 * `dateModified` falls back to `datePublished` — Google prefers the field
 * present over absent, and "never modified" is truthfully the publish date.
 */
export function buildArticleStructuredData(input: ArticleStructuredDataInput): ArticleNode {
  const image = absoluteUrl(input.image ?? DEFAULT_OG_IMAGE);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: toISODate(input.publishedAt),
    dateModified: toISODate(input.updatedAt ?? input.publishedAt),
    author: input.authors.map(toPersonNode),
    publisher: {
      // The Organization is the company, not the publication.
      '@type': 'Organization',
      name: BRAND_NAME,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.url,
    },
    url: input.url,
    image: [image],
    keywords: input.tags.join(', '),
    inLanguage: SITE_LANG,
  };
}

function toPersonNode(author: StructuredDataAuthor): PersonNode {
  return author.role === undefined
    ? { '@type': 'Person', name: author.name }
    : { '@type': 'Person', name: author.name, jobTitle: author.role };
}

/**
 * Serialise a node for embedding in a `<script>` tag.
 *
 * `<` is escaped so a title containing `</script>` cannot break out of the
 * script element.
 */
export function serializeStructuredData(node: unknown): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}
