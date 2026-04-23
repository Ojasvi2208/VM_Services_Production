import type { Metadata } from 'next';
import { blogPosts, getAllSlugs } from './blog-posts';
import BlogPostClient from './BlogPostClient';

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts[slug];

  if (!post) {
    return {
      title: 'Article Not Found',
      description: 'The requested article was not found.',
      robots: { index: false, follow: false },
    };
  }

  const description =
    post.excerpt ||
    `${post.title}. Read our AMFI-compliant analysis on mutual fund investing, tax planning, and portfolio strategy.`;

  return {
    title: post.title,
    description: description.slice(0, 300),
    authors: [{ name: post.author, url: 'https://www.vmfinancialservices.com/author/ojasvi-malik' }],
    alternates: {
      canonical: `https://www.vmfinancialservices.com/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: description.slice(0, 300),
      url: `https://www.vmfinancialservices.com/blog/${slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: description.slice(0, 200),
    },
  };
}

export const revalidate = 3600;

export default async function BlogPostRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolved = await params;
  const post = blogPosts[resolved.slug];

  const articleJsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        author: {
          '@type': 'Person',
          name: post.author,
          url: 'https://www.vmfinancialservices.com/author/ojasvi-malik',
        },
        publisher: {
          '@type': 'FinancialService',
          name: 'Vijay Malik Financial Services',
          url: 'https://www.vmfinancialservices.com',
        },
        datePublished: post.date,
        dateModified: post.date,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://www.vmfinancialservices.com/blog/${resolved.slug}`,
        },
        keywords: (post.tags || []).join(', '),
      }
    : null;

  return (
    <>
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      )}
      <BlogPostClient params={Promise.resolve(resolved)} />
    </>
  );
}
