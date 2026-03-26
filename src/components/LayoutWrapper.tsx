'use client';

// ── LayoutWrapper ─────────────────────────────────────────────
// All pages render their own NavBar + SiteFooter.
// This wrapper just provides the <main> flex-grow container.
// Legacy Header/Footer components deleted — no page uses them.
// ─────────────────────────────────────────────────────────────

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return <main className="flex-grow">{children}</main>;
}
