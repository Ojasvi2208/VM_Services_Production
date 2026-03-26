import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import SessionManager from "@/components/SessionManager";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/LayoutWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vijay Malik Financial Services — Wealth Tools for Indian Investors",
    template: "%s | Vijay Malik Financial Services",
  },
  description: "AMFI-registered Mutual Fund Distributor (ARN-317605). Track mutual fund NAVs, portfolio XIRR, LTCG tax, market indices, and 50,000+ schemes. Institutional-grade wealth tools for Indian retail investors.",
  keywords: ["mutual fund", "SIP calculator", "XIRR", "NAV", "Nifty 50", "Sensex", "portfolio tracker", "LTCG tax", "AMFI", "ARN-317605", "Indian mutual funds", "fund comparison"],
  authors: [{ name: "Vijay Malik Financial Services" }],
  creator: "Vijay Malik Financial Services",
  publisher: "Vijay Malik Financial Services",
  metadataBase: new URL("https://www.vmfinancialservices.com"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.vmfinancialservices.com",
    siteName: "Vijay Malik Financial Services",
    title: "Vijay Malik Financial Services — Wealth Tools for Indian Investors",
    description: "Track mutual fund NAVs, portfolio XIRR, market indices, and 50,000+ schemes. AMFI-registered distributor ARN-317605.",
    images: [{ url: "/images/VM_Logo.png", width: 1200, height: 630, alt: "Vijay Malik Financial Services" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vijay Malik Financial Services",
    description: "Institutional-grade mutual fund tracking & analytics for Indian investors.",
    images: ["/images/VM_Logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  other: {
    "google-adsense-account": "ca-pub-8245125390626462",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        {/* Material Symbols for icon support across pages */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        {/* Space Grotesk + JetBrains Mono */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />

        {/* Organization JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FinancialService",
              "name": "Vijay Malik Financial Services",
              "url": "https://www.vmfinancialservices.com",
              "logo": "https://www.vmfinancialservices.com/images/VM_Logo.png",
              "description": "AMFI-registered Mutual Fund Distributor providing institutional-grade wealth tools for Indian retail investors.",
              "identifier": "ARN-317605",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Zirakpur",
                "addressRegion": "Punjab",
                "addressCountry": "IN"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+91-94173-34348",
                "email": "info@vmfinancialservices.com",
                "contactType": "customer service"
              },
              "sameAs": ["https://www.vmfinancialservices.com"]
            }),
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#060D0A]">
        <AuthProvider>
          <SessionManager />
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>

        {/* Google Analytics GA4 */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-63XFSNKFRT" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-63XFSNKFRT');`}
        </Script>

        {/* Google AdSense */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8245125390626462"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
