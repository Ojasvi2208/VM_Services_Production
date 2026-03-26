import { redirect } from 'next/navigation';

// Force dynamic — redirect() cannot run during static prerender
export const dynamic = 'force-dynamic';

// ─── Root — server-side redirect to /markets ──────────────────
// Authenticated users can navigate to /dashboard from /markets.
// ─────────────────────────────────────────────────────────────

export default function Home() {
  redirect('/markets');
}
