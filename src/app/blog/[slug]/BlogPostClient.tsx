'use client';

import { useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { blogPosts } from './blog-posts';

export default function BlogPostPage({ params }: { params: any }) {
  const router = useRouter();
  const resolvedParams = use(params) as { slug: string };
  const slug = resolvedParams.slug;
  const post = blogPosts[slug];

  useEffect(() => {
    if (!post) router.push('/blog');
  }, [post, router]);

  if (!post) {
    return (
      <div className="bg-[#060D0A] min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center px-6 pt-36 pb-16">
          <div className="glass-card rounded-3xl p-12 text-center max-w-sm w-full">
            <h2 className="text-lg font-display font-bold text-[#dce5df] mb-2">Post Not Found</h2>
            <p className="text-[#859586] text-sm mb-6">The blog post you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
            <Link href="/blog" className="px-6 py-2.5 bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] rounded-xl font-bold text-sm">
              Return to Blog
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const otherSlugs = Object.keys(blogPosts).filter((s) => s !== slug);
  const related = otherSlugs.slice(0, 2).map((s) => blogPosts[s]);

  // Content is author-controlled (hardcoded in blog-posts.ts, never user input),
  // rendered via dangerouslySetInnerHTML to preserve the semantic HTML authoring
  // model (tables, headings, lists) used by existing AMFI-compliant articles.
  // eslint-disable-next-line react/no-danger
  const postHtml = { __html: post.content };

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />
      <main className="pt-36 pb-16 px-6 md:px-8 max-w-4xl mx-auto flex-1 w-full">
        <div className="mb-8">
          <Link href="/blog" className="flex items-center gap-2 text-[#859586] hover:text-[#44f593] text-sm transition-colors">
            Back to Blog
          </Link>
        </div>

        <div className="mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
            {post.category}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-display font-bold text-[#dce5df] mb-5 leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#859586] mb-8">
          <span>{post.date}</span>
          <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
          <span>{post.readTime}</span>
          <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
          <Link href="/author/ojasvi-malik" className="hover:text-[#44f593] transition-colors">
            By {post.author}
          </Link>
          {post.authorRole && (
            <>
              <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
              <span>{post.authorRole}</span>
            </>
          )}
        </div>

        <div
          className="prose-dark max-w-none text-[#c0c9c2] leading-relaxed
            [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-[#dce5df] [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#dce5df] [&_h3]:mt-6 [&_h3]:mb-3
            [&_p]:text-sm [&_p]:text-[#859586] [&_p]:leading-relaxed [&_p]:mb-4
            [&_a]:text-[#44f593] [&_a]:underline
            [&_ul]:space-y-2 [&_ul]:mb-4 [&_ul]:pl-0 [&_ul]:list-none
            [&_ul_li]:text-sm [&_ul_li]:text-[#859586]
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ol]:mb-4
            [&_ol_li]:text-sm [&_ol_li]:text-[#859586]
            [&_strong]:text-[#dce5df] [&_strong]:font-semibold
            [&_table]:w-full [&_table]:border-collapse [&_table]:mb-6
            [&_thead]:bg-[#161d1a]
            [&_th]:py-3 [&_th]:px-4 [&_th]:text-left [&_th]:text-xs [&_th]:font-mono [&_th]:text-[#859586] [&_th]:uppercase [&_th]:tracking-widest [&_th]:border [&_th]:border-[#3c4a3e]
            [&_td]:py-3 [&_td]:px-4 [&_td]:text-sm [&_td]:text-[#859586] [&_td]:border [&_td]:border-[#3c4a3e]
            [&_tr:nth-child(even)]:bg-[#161d1a]/40"
          dangerouslySetInnerHTML={postHtml}
        />

        {post.tags && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-mono bg-[#1a2420] text-[#859586] border border-[#3c4a3e]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <Link
          href="/author/ojasvi-malik"
          className="mt-10 glass-card rounded-2xl p-5 flex items-center gap-5 hover:border-[#44f593]/30 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#dce5df]">{post.author}</p>
            {post.authorRole && <p className="text-xs text-[#859586] font-mono">{post.authorRole}</p>}
            <p className="text-xs text-[#3c4a3e] font-mono mt-1">AMFI Registered · ARN-317605</p>
          </div>
        </Link>

        {related.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-4">Related Posts</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="glass-card rounded-xl p-4 hover:border-[#44f593]/20 transition-all group"
                >
                  <span className="text-xs font-mono text-[#44f593]">{r.category}</span>
                  <p className="text-sm font-semibold text-[#dce5df] group-hover:text-[#44f593] transition-colors mt-1 mb-1">
                    {r.title}
                  </p>
                  <p className="text-xs text-[#859586] font-mono">
                    {r.date} · {r.readTime}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-[#3c4a3e] font-mono leading-relaxed">
            Content is for educational purposes only. Not investment advice. Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
