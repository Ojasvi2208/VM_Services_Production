import type { Metadata } from 'next';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { blogPosts as postsMap } from './[slug]/blog-posts';

export const metadata: Metadata = {
  title: 'Blog — Mutual Fund Insights & Financial Education',
  description:
    'AMFI-compliant blog on mutual funds, SIPs, LTCG tax, portfolio strategy, and financial planning for Indian investors. Updated for FY 2025-26.',
  alternates: { canonical: 'https://www.vmfinancialservices.com/blog' },
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  featured?: boolean;
};

// Built from the single source-of-truth blog-posts.ts. Newest post first.
const blogPosts: BlogPost[] = Object.values(postsMap)
  .map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt || `${p.title}.`,
    category: p.category,
    author: p.author,
    date: p.date,
    readTime: p.readTime,
  }))
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .map((p, i) => ({ ...p, featured: i === 0 }));

const CATEGORIES = ['All Posts', 'Investing Basics', 'Tax Planning', 'Portfolio Strategy', 'Retirement Planning'];

const CAT_ICONS: Record<string, string> = {
  'Investing Basics': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'Tax Planning': 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  'Financial Planning': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  'Market Updates': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  'Investment Products': 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <div className={`glass-card rounded-2xl overflow-hidden hover:border-[#44f593]/20 transition-all group ${featured ? 'md:col-span-2' : ''}`}>
      {/* Image placeholder */}
      <div className={`bg-gradient-to-br from-[#161d1a] to-[#0d1512] flex items-center justify-center ${featured ? 'h-52' : 'h-36'}`}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mx-auto mb-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d={CAT_ICONS[post.category] || CAT_ICONS['Investing Basics']} />
            </svg>
          </div>
        </div>
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
            {post.category}
          </span>
        </div>
      </div>

      <div className="p-5 relative">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono text-[#859586]">{post.date}</span>
          <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
          <span className="text-xs font-mono text-[#859586]">{post.readTime}</span>
        </div>

        <h3 className={`font-display font-bold text-[#dce5df] group-hover:text-[#44f593] transition-colors mb-2 ${featured ? 'text-xl' : 'text-sm'}`}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>

        <p className="text-xs text-[#859586] leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-[#3c4a3e] font-mono">By {post.author}</span>
          <Link href={`/blog/${post.slug}`}
            className="flex items-center gap-1.5 text-[#44f593] text-xs font-semibold hover:underline">
            Read
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  const featured = blogPosts[0];
  const regular = blogPosts.slice(1);

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-[1440px] mx-auto flex-1 w-full">

        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight gradient-text mb-4">
            Insights
          </h1>
          <p className="text-[#859586] text-base max-w-lg mx-auto">
            Expert perspectives on investing, financial planning, and market trends for Indian retail investors.
          </p>
        </header>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {CATEGORIES.map(cat => (
            <button key={cat}
              className="px-4 py-1.5 rounded-full text-xs font-medium border border-[#3c4a3e] text-[#859586] hover:text-[#dce5df] hover:border-[#44f593]/30 transition-all first:bg-[#44f593]/10 first:text-[#44f593] first:border-[#44f593]/30">
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BlogCard post={featured} featured />
          {regular.map(post => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <p className="text-[#859586] text-sm mb-4">
            Want to stay updated? Get financial insights directly to your inbox.
          </p>
          <Link href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#44f593]/30 text-[#44f593] text-sm font-semibold hover:bg-[#44f593]/5 transition-colors">
            Subscribe to Insights
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
