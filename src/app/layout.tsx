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
        <AuthProvider>
          <SessionManager />
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
