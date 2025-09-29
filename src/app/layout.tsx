import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import MutualFundBanner from "@/components/MutualFundBanner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vijay Malik Financial Services - Mutual Fund Distributor",
  description: "AMFI-registered Mutual Fund Distributor helping families plan and invest with clarity. ARN-317605.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-brand-pearl">
        <MutualFundBanner />
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
