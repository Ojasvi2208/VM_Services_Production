import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  title: "Vijay Malik Financial Services — Wealth Tools for Indian Investors",
  description: "AMFI-registered Mutual Fund Distributor · ARN-317605 · Institutional-grade wealth tools for Indian retail investors.",
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
      </head>
      <body className="min-h-screen flex flex-col bg-[#060D0A]">
        <AuthProvider>
          <SessionManager />
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
