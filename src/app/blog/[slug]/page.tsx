'use client';

import { useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Blog post type definition
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
  imagePath?: string;
  tags?: string[];
};

// Blog posts data (in a real app, this would come from an API or CMS)
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
          <tr>
            <td>January</td>
            <td>5,000</td>
            <td>50</td>
            <td>100</td>
          </tr>
          <tr>
            <td>February</td>
            <td>5,000</td>
            <td>45</td>
            <td>111.11</td>
          </tr>
          <tr>
            <td>March</td>
            <td>5,000</td>
            <td>40</td>
            <td>125</td>
          </tr>
          <tr>
            <td>April</td>
            <td>5,000</td>
            <td>55</td>
            <td>90.91</td>
          </tr>
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
      
      <p>While SIPs offer numerous advantages, keep these points in mind:</p>
      
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
    tags: ['SIP', 'Mutual Funds', 'Investing Strategy', 'Wealth Creation']
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
        <li><strong>Capital Safety:</strong> Bank FDs are insured up to ₹5 lakhs per depositor by the Deposit Insurance and Credit Guarantee Corporation (DICGC).</li>
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
        <li><strong>Tax Efficiency:</strong> Long-term capital gains (after 3 years) are taxed at 20% with indexation benefits, often resulting in lower effective tax rates compared to FDs.</li>
        <li><strong>Liquidity:</strong> Most debt funds allow redemption without exit load after a specified period, typically ranging from 7 days to 1 year depending on the fund type.</li>
        <li><strong>Diversification:</strong> Investment across various debt instruments reduces issuer-specific risk.</li>
      </ul>
      
      <p>However, debt funds also have considerations:</p>
      
      <ul>
        <li><strong>Market Risk:</strong> Not guaranteed; returns fluctuate based on interest rate movements and credit events.</li>
        <li><strong>Credit Risk:</strong> Possibility of default by issuers of debt securities held by the fund.</li>
        <li><strong>Complexity:</strong> Various categories with different risk-return profiles require more understanding.</li>
      </ul>
      
      <h2>Making the Right Choice: Factors to Consider</h2>
      
      <h3>Investment Horizon</h3>
      
      <p><strong>Short-term (up to 1 year):</strong> Liquid funds, ultra-short duration funds, or bank FDs may be suitable.</p>
      <p><strong>Medium-term (1-3 years):</strong> Short duration funds, corporate bond funds, banking & PSU debt funds, or bank FDs.</p>
      <p><strong>Long-term (3+ years):</strong> Medium to long duration funds offer better tax efficiency compared to FDs.</p>
      
      <h3>Risk Tolerance</h3>
      
      <p><strong>Conservative investors:</strong> Bank FDs, overnight funds, or liquid funds with high-quality portfolios.</p>
      <p><strong>Moderate risk-takers:</strong> Short to medium duration funds, corporate bond funds with good credit quality.</p>
      
      <h3>Tax Bracket</h3>
      
      <p>Higher tax bracket individuals typically benefit more from debt funds due to better tax efficiency, especially for investments held for over three years.</p>
      
      <h3>Liquidity Needs</h3>
      
      <p>If you might need the money before maturity, debt funds generally offer better liquidity than FDs, which often involve penalties for premature withdrawals.</p>
      
      <h2>A Balanced Approach</h2>
      
      <p>For many investors, a combination of both instruments works well:</p>
      
      <ul>
        <li><strong>Emergency Fund:</strong> FDs or liquid funds for immediate accessibility.</li>
        <li><strong>Short-term Goals:</strong> FDs or ultra-short/short duration funds depending on the time horizon.</li>
        <li><strong>Tax Planning:</strong> Debt funds for longer-term fixed-income allocation, especially for those in higher tax brackets.</li>
      </ul>
      
      <p>Remember that all investments, including debt funds, carry some level of risk. Diversification across different investment vehicles and regular portfolio reviews are key to achieving your financial goals while managing risk effectively.</p>
      
      <p>Mutual Fund investments are subject to market risks. Read all scheme related documents carefully before investing.</p>
    `,
    category: 'Tax Planning',
    author: 'Financial Team',
    authorRole: 'Research Analysts',
    date: 'July 28, 2023',
    readTime: '4 min read',
    tags: ['Debt Funds', 'Fixed Deposits', 'Tax Planning', 'Investment Strategy']
  }
};

// Related posts component
const RelatedPosts = ({ tags }: { tags?: string[] }) => {
  return (
    <div className="mt-10 md:mt-12 bg-sage/20 p-4 md:p-6 rounded-lg">
      <h3 className="text-xl font-semibold text-olive mb-4">Related Posts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-4 rounded-md shadow-sm">
          <span className="text-xs text-olive font-medium">Investing Basics</span>
          <h4 className="text-base font-medium text-navy mt-1 mb-2">
            <Link href="/blog/power-of-compounding-wealth-creation" className="hover:text-olive">
              The Power of Compounding in Wealth Creation
            </Link>
          </h4>
          <div className="text-xs text-navy/60">June 10, 2023 • 4 min read</div>
        </div>
        <div className="bg-white p-4 rounded-md shadow-sm">
          <span className="text-xs text-olive font-medium">Market Updates</span>
          <h4 className="text-base font-medium text-navy mt-1 mb-2">
            <Link href="/blog/navigating-market-volatility" className="hover:text-olive">
              Navigating Market Volatility: Staying Invested During Uncertainty
            </Link>
          </h4>
          <div className="text-xs text-navy/60">May 28, 2023 • 5 min read</div>
        </div>
      </div>
    </div>
  );
};

export default function BlogPostPage({ params }: { params: any }) {
  const router = useRouter();
  
  // Use React.use() to unwrap params Promise (future-proofing for Next.js)
  // This is the recommended pattern for Next.js 15+ and React 19+
  const resolvedParams = use(params) as { slug: string };
  const slug = resolvedParams.slug;
  
  // Get the blog post data based on the slug
  const post = blogPosts[slug];
  
  // If the blog post doesn't exist, redirect to the blog index page
  useEffect(() => {
    if (!post) {
      router.push('/blog');
    }
  }, [post, router]);
  
  // If post is undefined (not found), show a proper error state with themed styling
  if (!post) {
    return (
      <section className="py-12 bg-sage/10">
        <div className="container-padding">
          <div className="text-center py-20 bg-sage/20 rounded-lg p-8 max-w-2xl mx-auto border border-olive/20 shadow-lg">
            <div className="text-olive mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-navy mb-3">Blog Post Not Found</h2>
            <p className="text-navy/70 mb-6">The blog post you're looking for doesn't exist or may have been moved.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/blog" className="bg-olive text-sage-50 hover:bg-olive-700 py-2.5 px-6 rounded-lg font-semibold shadow-md border border-olive-600 transition-all">
                Return to Blog
              </Link>
              <a href="/partners" className="bg-olive text-sage-50 hover:bg-olive-700 py-2.5 px-6 rounded-lg font-semibold shadow-md border border-olive-600 transition-all">
                Start Investing
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  return (
    <>
      <section className="py-12">
        <div className="container-padding max-w-4xl mx-auto">
          {/* Back link */}
          <div className="mb-8">
            <Link href="/blog" className="text-olive hover:underline flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Blog
            </Link>
          </div>
          
          {/* Post category */}
          <div className="mb-4">
            <span className="bg-olive/10 text-olive px-3 py-1 text-sm rounded-full">
              {post.category}
            </span>
          </div>
          
          {/* Post title */}
          <h1 className="text-3xl md:text-4xl font-bold text-navy mb-4">{post.title}</h1>
          
          {/* Post metadata */}
          <div className="flex flex-wrap items-center text-sm text-navy/70 mb-6 md:mb-8">
            <span>{post.date}</span>
            <span className="mx-2">•</span>
            <span>{post.readTime}</span>
            <span className="mx-2">•</span>
            <span>By {post.author}</span>
            {post.authorRole && (
              <>
                <span className="mx-2">•</span>
                <span>{post.authorRole}</span>
              </>
            )}
          </div>
          
          {/* Featured image placeholder */}
          <div className="bg-sage/20 w-full h-64 rounded-lg mb-8">
            <div className="h-full w-full flex items-center justify-center text-navy/40">
              Blog Feature Image Placeholder
            </div>
          </div>
          
          {/* Post content */}
          <div 
            className="prose prose-olive max-w-none prose-headings:text-navy prose-p:text-navy/80 prose-a:text-olive hover:prose-a:underline prose-img:rounded-lg prose-table:overflow-x-auto" 
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          
          {/* Tags */}
          {post.tags && (
            <div className="mt-8 flex flex-wrap gap-2 justify-center md:justify-start">
              {post.tags.map((tag, index) => (
                <span key={index} className="bg-sage/30 px-3 py-1 text-xs rounded-full text-navy/70">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Author box */}
          <div className="mt-12 bg-olive/10 p-4 md:p-6 rounded-lg flex flex-col md:flex-row items-center text-center md:text-left">
            <div className="w-16 h-16 bg-navy/10 rounded-full flex items-center justify-center text-navy mb-4 md:mb-0 md:mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-navy">{post.author}</h3>
              {post.authorRole && <p className="text-sm text-navy/70">{post.authorRole}</p>}
              <p className="text-sm text-navy/70 mt-1">
                AMFI Registered Mutual Fund Distributor (ARN-317605)
              </p>
            </div>
          </div>
          
          {/* Related posts */}
          <RelatedPosts tags={post.tags} />
          
          {/* Compliance note */}
          <div className="mt-10 p-4 border-t border-sage/50">
            <p className="text-navy/80 text-sm text-center">
              Content is for educational purposes only. Not investment advice. Mutual Fund investments are subject to market risks, read all scheme related documents carefully.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
