import Link from 'next/link';
import Section from '@/components/Section';
import ComplianceNotice from '@/components/ComplianceNotice';
import ResponsiveContainer from '@/components/ResponsiveContainer';

// Blog post type definition
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
  imagePath?: string;
};

// Blog post card component
const BlogPostCard = ({ 
  post, 
  featured = false 
}: { 
  post: BlogPost; 
  featured?: boolean 
}) => {
  return (
    <div className={`rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] animate-fadeInUp ${featured ? 'col-span-2 border-2 border-brand-gold/20' : 'border border-brand-pearl'}`}>
      <div className="relative group">
        <div className={`bg-gradient-to-br from-brand-pearl to-blue-50 w-full ${featured ? 'h-64' : 'h-48'} transition-all duration-300 group-hover:from-blue-50 group-hover:to-brand-gold/10`}>
          {/* Image placeholder - would be replaced with actual image */}
          <div className="h-full w-full flex items-center justify-center text-brand-navy/40">
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-royal/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <div className="w-6 h-6 bg-brand-gold rounded-sm"></div>
              </div>
              Blog Image Placeholder
            </div>
          </div>
        </div>
        <div className="absolute top-4 left-4">
          <span className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-4 py-1.5 text-xs font-medium rounded-full shadow-lg animate-shimmer">
            {post.category}
          </span>
        </div>
        {featured && (
          <div className="absolute top-4 right-4">
            <div className="w-3 h-3 bg-brand-gold rounded-full animate-pulse"></div>
          </div>
        )}
      </div>
      
      <div className="p-6 bg-white">
        <div className="flex items-center text-xs text-brand-navy/60 mb-3">
          <div className="w-2 h-2 bg-brand-gold rounded-full mr-2 animate-pulse"></div>
          <span className="text-brand-royal font-medium">{post.date}</span>
          <span className="mx-2 text-brand-gold">•</span>
          <span>{post.readTime}</span>
        </div>
        
        <h3 className="text-xl font-semibold text-brand-navy mb-3 hover:text-brand-royal transition-colors duration-200">
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        
        <p className="text-brand-navy/70 text-sm mb-4 line-clamp-2 leading-relaxed">
          {post.excerpt}
        </p>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-brand-navy/60">By <span className="text-brand-gold font-medium">{post.author}</span></span>
          <Link href={`/blog/${post.slug}`} className="bg-gradient-to-r from-brand-royal to-brand-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-200 inline-flex items-center">
            Read More
            <div className="ml-2 w-1.5 h-1.5 bg-brand-gold rounded-full animate-pulse"></div>
          </Link>
        </div>
      </div>
    </div>
  );
};

// Main Blog Page
export default function BlogPage() {
  // Blog posts data
  const blogPosts: BlogPost[] = [
    {
      id: '1',
      title: 'Understanding SIP: Your Path to Disciplined Investing',
      slug: 'understanding-sip-disciplined-investing',
      excerpt: 'Learn how Systematic Investment Plans can help you build wealth steadily regardless of market volatility, and why rupee cost averaging works in your favor.',
      category: 'Investing Basics',
      author: 'Vijay Malik',
      date: 'August 15, 2023',
      readTime: '5 min read',
      featured: true
    },
    {
      id: '2',
      title: 'Debt Funds vs Fixed Deposits: What\'s Right for You?',
      slug: 'debt-funds-vs-fixed-deposits',
      excerpt: 'Compare the tax efficiency, returns potential, and liquidity of debt mutual funds against traditional bank fixed deposits to optimize your investment strategy.',
      category: 'Tax Planning',
      author: 'Financial Team',
      date: 'July 28, 2023',
      readTime: '4 min read'
    },
    {
      id: '3',
      title: 'Goal-Based Investing: Align Your Finances With Life Objectives',
      slug: 'goal-based-investing-align-finances',
      excerpt: 'How to structure your investments around specific life goals like education, retirement, or home buying, and why this approach leads to better financial outcomes.',
      category: 'Financial Planning',
      author: 'Vijay Malik',
      date: 'July 12, 2023',
      readTime: '6 min read'
    },
    {
      id: '4',
      title: 'Understanding SEBI\'s New Mutual Fund Categories',
      slug: 'understanding-sebi-mutual-fund-categories',
      excerpt: 'A comprehensive guide to the mutual fund categorization by SEBI and how it impacts your investment choices and portfolio diversification strategy.',
      category: 'Market Updates',
      author: 'Research Team',
      date: 'June 25, 2023',
      readTime: '7 min read'
    },
    {
      id: '5',
      title: 'The Power of Compounding in Wealth Creation',
      slug: 'power-of-compounding-wealth-creation',
      excerpt: 'Discover how starting early with even modest investments can lead to significant wealth over time through the mathematical magic of compounding.',
      category: 'Investing Basics',
      author: 'Financial Team',
      date: 'June 10, 2023',
      readTime: '4 min read'
    },
    {
      id: '6',
      title: 'Navigating Market Volatility: Staying Invested During Uncertainty',
      slug: 'navigating-market-volatility',
      excerpt: 'Strategies to maintain investment discipline during market downturns and why emotional reactions can harm your long-term financial goals.',
      category: 'Market Updates',
      author: 'Vijay Malik',
      date: 'May 28, 2023',
      readTime: '5 min read'
    },
    {
      id: '7',
      title: 'ETFs vs Index Funds: Understanding the Differences',
      slug: 'etfs-vs-index-funds-differences',
      excerpt: 'A comparative analysis of Exchange Traded Funds and Index Mutual Funds, their cost structures, tax implications, and suitability for different investor profiles.',
      category: 'Investment Products',
      author: 'Research Team',
      date: 'May 15, 2023',
      readTime: '6 min read'
    }
  ];
  
  // Featured blog post (first one in the list)
  const featuredPost = blogPosts[0];
  
  // Regular blog posts (excluding the featured one)
  const regularPosts = blogPosts.slice(1);
  
  return (
    <>
      <div className="pt-24"></div> {/* Spacer for absolute header */}
      <Section background="offwhite" padding="large">
        <ResponsiveContainer maxWidth="xl">
          <div className="text-center mb-12 animate-fadeInUp animation-delay-100">
            <h1 className="text-4xl md:text-5xl font-bold text-brand-navy mb-6">
              Financial <span className="bg-gradient-to-r from-brand-gold to-yellow-400 bg-clip-text text-transparent animate-shimmer">Education</span> Blog
            </h1>
            <p className="text-lg text-brand-navy/80 max-w-3xl mx-auto leading-relaxed">
              Stay informed with expert insights on <span className="text-brand-gold font-semibold">investing</span>, <span className="text-brand-royal font-semibold">financial planning</span>, and market trends.
            </p>
            <div className="flex items-center justify-center mt-4 space-x-2">
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-brand-royal rounded-full animate-pulse animation-delay-200"></div>
              <div className="w-2 h-2 bg-brand-gold rounded-full animate-pulse animation-delay-300"></div>
            </div>
          </div>
          
          <div className="mb-8 md:mb-12">
            {/* Filter buttons - in a real app, these would filter posts */}
            <div className="flex flex-wrap gap-3 mb-8 justify-center animate-fadeInUp animation-delay-300">
              <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-brand-royal to-brand-navy text-white shadow-lg hover:from-brand-navy hover:to-brand-royal transform hover:scale-105 transition-all duration-200">
                All Posts
              </button>
              <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-105 transition-all duration-200">
                Investing Basics
              </button>
              <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-105 transition-all duration-200">
                Financial Planning
              </button>
              <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-105 transition-all duration-200">
                Tax Planning
              </button>
              <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-105 transition-all duration-200">
                Market Updates
              </button>
            </div>
            
            {/* Featured blog post */}
            <div className="animate-fadeInUp animation-delay-400">
              <BlogPostCard post={featuredPost} featured={true} />
            </div>
          </div>
          
          {/* Regular blog posts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {regularPosts.map((post, index) => (
              <div key={post.id} className="animate-fadeInUp" style={{ animationDelay: `${600 + index * 100}ms` }}>
                <BlogPostCard post={post} />
              </div>
            ))}
          </div>
          
          {/* Pagination - static for now */}
          <div className="mt-12 md:mt-16 flex justify-center animate-fadeInUp animation-delay-1000">
            <div className="flex items-center space-x-3">
              <button className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-110 transition-all duration-200">
                &lsaquo;
              </button>
              <button className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-r from-brand-royal to-brand-navy text-white shadow-lg">
                1
              </button>
              <button className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-110 transition-all duration-200">
                2
              </button>
              <button className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-brand-navy hover:bg-brand-pearl border-2 border-brand-royal/20 hover:border-brand-gold/50 shadow-sm transform hover:scale-110 transition-all duration-200">
                3
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center bg-sage text-navy hover:bg-sage/70 border border-sage-300 shadow-sm transition-all">
                &rsaquo;
              </button>
            </div>
          </div>
          
          {/* Newsletter signup */}
          <div className="mt-12 md:mt-16 bg-sage/20 p-4 sm:p-8 rounded-lg text-center border border-sage-300 shadow-md">
            <h3 className="text-xl font-semibold text-olive mb-3 heading-with-accent">Stay Informed with Market Updates</h3>
            <p className="text-navy mb-4 md:mb-6 max-w-2xl mx-auto">
              Subscribe to our newsletter for educational content on investing, market insights, and financial planning tips. No spam, unsubscribe anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-olive"
              />
              <button className="bg-olive text-sage-50 px-4 py-3 rounded-lg font-semibold shadow-md border border-olive-600 transition-all hover:bg-olive-700 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
          
          {/* Compliance notice */}
          <div className="mt-8 md:mt-10">
            <ComplianceNotice type="standard" />
          </div>
        </ResponsiveContainer>
      </Section>
    </>
  );
}
