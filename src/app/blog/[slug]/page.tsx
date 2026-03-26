'use client';

import { useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  authorRole?: string;
  tags?: string[];
};

const blogPosts: Record<string, BlogPost> = {
  'understanding-sip-disciplined-investing': {
    id: '1',
    title: 'Understanding SIP: Your Path to Disciplined Investing',
    slug: 'understanding-sip-disciplined-investing',
    content: `
      <p>Systematic Investment Plans (SIPs) have revolutionized the way retail investors approach mutual funds in India. A SIP allows investors to invest a fixed amount at regular intervals – be it weekly, monthly, or quarterly – into their chosen mutual fund schemes.</p>

      <h2>Why SIPs Work: The Power of Rupee Cost Averaging</h2>

      <p>The primary advantage of SIPs lies in rupee cost averaging. When you invest a fixed sum regularly, you naturally buy more units when prices are low and fewer when prices are high. Over time, this averages out your purchase cost, potentially leading to better returns while mitigating the impact of market volatility.</p>

      <p>Let's understand this with an example:</p>

      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Investment (₹)</th>
            <th>NAV (₹)</th>
            <th>Units Allotted</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>January</td><td>5,000</td><td>50</td><td>100</td></tr>
          <tr><td>February</td><td>5,000</td><td>45</td><td>111.11</td></tr>
          <tr><td>March</td><td>5,000</td><td>40</td><td>125</td></tr>
          <tr><td>April</td><td>5,000</td><td>55</td><td>90.91</td></tr>
        </tbody>
      </table>

      <p>At the end of April, you've invested ₹20,000 and accumulated 427.02 units. The average cost per unit is ₹46.84, while the current NAV is ₹55. This demonstrates how SIPs can be beneficial even in fluctuating markets.</p>

      <h2>Benefits of SIP Investing</h2>

      <ol>
        <li><strong>Financial Discipline:</strong> Regular investing instills a savings habit without requiring large sums upfront.</li>
        <li><strong>Flexibility:</strong> You can start with as little as ₹500 monthly and increase, pause, or stop as needed.</li>
        <li><strong>Compounding Benefits:</strong> The earlier you start, the more time your money has to grow through compounding.</li>
        <li><strong>Reduced Timing Risk:</strong> Eliminates the need to time the market, which is nearly impossible even for seasoned investors.</li>
        <li><strong>Stress-free Investing:</strong> Automated investments reduce emotional decision-making during market fluctuations.</li>
      </ol>

      <h2>SIP Strategies for Different Goals</h2>

      <p>The beauty of SIPs lies in their versatility. They can be tailored to align with various financial goals:</p>

      <ul>
        <li><strong>Short-term Goals (1-3 years):</strong> Consider debt or conservative hybrid funds with lower volatility.</li>
        <li><strong>Medium-term Goals (3-7 years):</strong> Balanced or aggressive hybrid funds offer a mix of growth and stability.</li>
        <li><strong>Long-term Goals (7+ years):</strong> Equity funds typically have the potential for higher returns over longer horizons.</li>
      </ul>

      <h2>Step-Up SIPs: Accelerating Wealth Creation</h2>

      <p>A step-up SIP allows you to increase your investment amount periodically, often annually. This approach aligns with income growth over your career and significantly boosts your corpus. For instance, increasing your monthly SIP by just 10% annually can potentially grow your final corpus by 30-40% over a 15-20 year period.</p>

      <h2>Things to Remember</h2>

      <ul>
        <li>SIPs don't guarantee profits; they simply offer a disciplined investment approach.</li>
        <li>Fund selection should align with your goals, risk tolerance, and investment horizon.</li>
        <li>Regular review of your SIP investments (semi-annually or annually) is recommended.</li>
        <li>For goal-based investing, consider increasing your SIP amount periodically to counter inflation.</li>
      </ul>

      <p>Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
    `,
    category: 'Investing Basics',
    author: 'Vijay Malik',
    authorRole: 'Founder & Chief Investment Officer',
    date: 'August 15, 2023',
    readTime: '5 min read',
    tags: ['SIP', 'Mutual Funds', 'Investing Strategy', 'Wealth Creation'],
  },
  'debt-funds-vs-fixed-deposits': {
    id: '2',
    title: "Debt Funds vs Fixed Deposits: What's Right for You?",
    slug: 'debt-funds-vs-fixed-deposits',
    content: `
      <p>When it comes to the fixed-income component of your portfolio, two popular options stand out: bank fixed deposits (FDs) and debt mutual funds. Each has its own set of advantages and considerations, and understanding these differences is crucial for making informed investment decisions.</p>

      <h2>Understanding Fixed Deposits</h2>

      <p>Fixed deposits have been the cornerstone of Indian household savings for decades. They offer:</p>

      <ul>
        <li><strong>Guaranteed Returns:</strong> The interest rate is fixed at the time of investment and remains unchanged until maturity.</li>
        <li><strong>Capital Safety:</strong> Bank FDs are insured up to ₹5 lakhs per depositor by DICGC.</li>
        <li><strong>Simplicity:</strong> Easy to understand with no complexity in product structure.</li>
        <li><strong>Loan Facility:</strong> Banks typically offer loans against FDs at competitive interest rates.</li>
      </ul>

      <p>However, FDs come with certain limitations:</p>

      <ul>
        <li><strong>Tax Inefficiency:</strong> Interest income is fully taxable at your income tax slab rate.</li>
        <li><strong>Inflation Risk:</strong> Returns may not always beat inflation, especially in post-tax terms.</li>
        <li><strong>Liquidity Constraints:</strong> Premature withdrawals often involve penalty charges.</li>
      </ul>

      <h2>Exploring Debt Mutual Funds</h2>

      <p>Debt mutual funds invest in fixed-income securities like government bonds, corporate bonds, treasury bills, and money market instruments. They offer:</p>

      <ul>
        <li><strong>Potential for Higher Returns:</strong> Historically, certain categories of debt funds have delivered better returns than FDs over medium to long periods.</li>
        <li><strong>Tax Efficiency:</strong> Long-term capital gains (after 3 years) are taxed at 20% with indexation benefits.</li>
        <li><strong>Liquidity:</strong> Most debt funds allow redemption without exit load after a specified period.</li>
        <li><strong>Diversification:</strong> Investment across various debt instruments reduces issuer-specific risk.</li>
      </ul>

      <h2>Making the Right Choice</h2>

      <h3>Investment Horizon</h3>
      <p><strong>Short-term (up to 1 year):</strong> Liquid funds, ultra-short duration funds, or bank FDs may be suitable.</p>
      <p><strong>Medium-term (1-3 years):</strong> Short duration funds, corporate bond funds, or bank FDs.</p>
      <p><strong>Long-term (3+ years):</strong> Medium to long duration funds offer better tax efficiency compared to FDs.</p>

      <h3>Tax Bracket</h3>
      <p>Higher tax bracket individuals typically benefit more from debt funds due to better tax efficiency, especially for investments held for over three years.</p>

      <h2>A Balanced Approach</h2>

      <ul>
        <li><strong>Emergency Fund:</strong> FDs or liquid funds for immediate accessibility.</li>
        <li><strong>Short-term Goals:</strong> FDs or ultra-short/short duration funds depending on the time horizon.</li>
        <li><strong>Tax Planning:</strong> Debt funds for longer-term fixed-income allocation, especially for those in higher tax brackets.</li>
      </ul>

      <p>Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
    `,
    category: 'Tax Planning',
    author: 'Financial Team',
    authorRole: 'Research Analysts',
    date: 'July 28, 2023',
    readTime: '4 min read',
    tags: ['Debt Funds', 'Fixed Deposits', 'Tax Planning', 'Investment Strategy'],
  },
};

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
            <div className="w-14 h-14 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[#ffb4ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
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

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-16 px-6 md:px-8 max-w-4xl mx-auto flex-1 w-full">

        {/* Back link */}
        <div className="mb-8">
          <Link href="/blog" className="flex items-center gap-2 text-[#859586] hover:text-[#44f593] text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>
        </div>

        {/* Category pill */}
        <div className="mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
            {post.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-display font-bold text-[#dce5df] mb-5 leading-tight">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#859586] mb-8">
          <span>{post.date}</span>
          <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
          <span>{post.readTime}</span>
          <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
          <span>By {post.author}</span>
          {post.authorRole && (
            <>
              <span className="w-1 h-1 rounded-full bg-[#3c4a3e]" />
              <span>{post.authorRole}</span>
            </>
          )}
        </div>

        {/* Feature image placeholder */}
        <div className="w-full h-56 rounded-2xl bg-gradient-to-br from-[#161d1a] to-[#0d1512] border border-[#3c4a3e] flex items-center justify-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#44f593]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        {/* Article content */}
        <div
          className="prose-dark max-w-none text-[#c0c9c2] leading-relaxed
            [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-[#dce5df] [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#dce5df] [&_h3]:mt-6 [&_h3]:mb-3
            [&_p]:text-sm [&_p]:text-[#859586] [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:space-y-2 [&_ul]:mb-4 [&_ul]:pl-0 [&_ul]:list-none
            [&_ul_li]:flex [&_ul_li]:items-start [&_ul_li]:gap-3 [&_ul_li]:text-sm [&_ul_li]:text-[#859586]
            [&_ul_li]:before:content-[''] [&_ul_li]:before:w-1 [&_ul_li]:before:h-1 [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-[#44f593]/50 [&_ul_li]:before:flex-shrink-0 [&_ul_li]:before:mt-2
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ol]:mb-4
            [&_ol_li]:text-sm [&_ol_li]:text-[#859586]
            [&_strong]:text-[#dce5df] [&_strong]:font-semibold
            [&_table]:w-full [&_table]:border-collapse [&_table]:mb-6
            [&_thead]:bg-[#161d1a]
            [&_th]:py-3 [&_th]:px-4 [&_th]:text-left [&_th]:text-xs [&_th]:font-mono [&_th]:text-[#859586] [&_th]:uppercase [&_th]:tracking-widest [&_th]:border [&_th]:border-[#3c4a3e]
            [&_td]:py-3 [&_td]:px-4 [&_td]:text-sm [&_td]:text-[#859586] [&_td]:border [&_td]:border-[#3c4a3e]
            [&_tr:nth-child(even)]:bg-[#161d1a]/40"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Tags */}
        {post.tags && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-mono bg-[#1a2420] text-[#859586] border border-[#3c4a3e]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Author box */}
        <div className="mt-10 glass-card rounded-2xl p-5 flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#44f593]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#dce5df]">{post.author}</p>
            {post.authorRole && <p className="text-xs text-[#859586] font-mono">{post.authorRole}</p>}
            <p className="text-xs text-[#3c4a3e] font-mono mt-1">AMFI Registered · ARN-317605</p>
          </div>
        </div>

        {/* Related Posts */}
        <div className="mt-10">
          <p className="text-xs font-mono text-[#859586] uppercase tracking-widest mb-4">Related Posts</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/blog/understanding-sip-disciplined-investing" className="glass-card rounded-xl p-4 hover:border-[#44f593]/20 transition-all group">
              <span className="text-xs font-mono text-[#44f593]">Investing Basics</span>
              <p className="text-sm font-semibold text-[#dce5df] group-hover:text-[#44f593] transition-colors mt-1 mb-1">
                Understanding SIP: Your Path to Disciplined Investing
              </p>
              <p className="text-xs text-[#859586] font-mono">August 15, 2023 · 5 min read</p>
            </Link>
            <Link href="/blog/debt-funds-vs-fixed-deposits" className="glass-card rounded-xl p-4 hover:border-[#44f593]/20 transition-all group">
              <span className="text-xs font-mono text-[#44f593]">Tax Planning</span>
              <p className="text-sm font-semibold text-[#dce5df] group-hover:text-[#44f593] transition-colors mt-1 mb-1">
                Debt Funds vs Fixed Deposits: What&apos;s Right for You?
              </p>
              <p className="text-xs text-[#859586] font-mono">July 28, 2023 · 4 min read</p>
            </Link>
          </div>
        </div>

        {/* Compliance */}
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
