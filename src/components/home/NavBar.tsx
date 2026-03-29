'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MarketStrip from '@/components/home/MarketStrip';

// ── Notification types ────────────────────────────────────────
interface AppNotification {
  id: number;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const CATEGORY_ICON: Record<string, string> = {
  goal_drift:      'trending_down',
  secure_the_bag:  'savings',
  ltcg_harvest:    'account_balance',
  ltcg_teaser:     'workspace_premium',
  fuel_alert:      'local_gas_station',
  price_alert:     'show_chart',
  market_pulse:    'bar_chart',
  eod_pulse:       'nightlight',
  portfolio_update:'pie_chart',
  nfo_close:       'timer',
  nfo_alert:       'new_releases',
};

const CATEGORY_COLOR: Record<string, string> = {
  goal_drift:      'text-red-400 bg-red-400/10 border-red-400/20',
  secure_the_bag:  'text-[#44f593] bg-[#44f593]/10 border-[#44f593]/20',
  ltcg_harvest:    'text-amber-400 bg-amber-400/10 border-amber-400/20',
  ltcg_teaser:     'text-purple-400 bg-purple-400/10 border-purple-400/20',
  fuel_alert:      'text-orange-400 bg-orange-400/10 border-orange-400/20',
  price_alert:     'text-sky-400 bg-sky-400/10 border-sky-400/20',
  market_pulse:    'text-[#44f593] bg-[#44f593]/10 border-[#44f593]/20',
  eod_pulse:       'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  portfolio_update:'text-[#44f593] bg-[#44f593]/10 border-[#44f593]/20',
  nfo_close:       'text-amber-400 bg-amber-400/10 border-amber-400/20',
  nfo_alert:       'text-sky-400 bg-sky-400/10 border-sky-400/20',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── NavBar ──────────────────────────────────────────────────
// Fixed glassmorphic top navigation — Obsidian/Emerald theme.
// Active state via usePathname. Auth-aware right side.
// Mobile: hamburger drawer below md breakpoint.
// ─────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Markets',  href: '/markets',       disabled: false },
  { label: 'Discover', href: '/funds/search',  disabled: false },
  { label: 'Portfolio',href: '/portfolio',     disabled: false },
  { label: 'Goals',    href: '/goals',         disabled: false },
  { label: 'Planner',  href: '/calculators',   disabled: false },
  { label: 'Learn',    href: '/learn',         disabled: false },
  { label: 'News',     href: '/news',          disabled: false },
  { label: 'Screener', href: '/screener',      disabled: true  },
] satisfies { label: string; href: string; disabled: boolean }[];

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 2L4 6.5V13C4 18.55 8.33 23.74 14 25C19.67 23.74 24 18.55 24 13V6.5L14 2Z"
        fill="url(#nav-shield-grad)"
        stroke="rgba(68,245,147,0.35)"
        strokeWidth="0.75"
      />
      <path d="M10 14l3 3 5-5.5" stroke="#44f593" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="nav-shield-grad" x1="4" y1="2" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#19211e"/>
          <stop offset="100%" stopColor="#08100d"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      {open
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
      }
    </svg>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [bellOpen, setBellOpen]     = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const bellRef   = useRef<HTMLDivElement>(null);

  // Fetch notifications (only when authenticated)
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotifsLoading(true);
    try {
      const res = await fetch('/api/notifications/recent');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch { /* silent */ } finally {
      setNotifsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Mark all visible as read when bell opens
  const handleBellOpen = async () => {
    setBellOpen(v => !v);
    setAvatarOpen(false);
    if (!bellOpen && unreadCount > 0) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      // Fire-and-forget
      fetch('/api/notifications/recent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      }).catch(() => {});
    }
  };

  // Close both dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/markets') return pathname === '/markets' || pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={[
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          'border-b border-white/10',
          scrolled
            ? 'bg-[#0d1512]/60 backdrop-blur-2xl shadow-2xl'
            : 'bg-[#0d1512]/30 backdrop-blur-xl',
        ].join(' ')}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">

          {/* ── Logo ─────────────────────────────────────────── */}
          <Link href="/markets" className="flex items-center gap-2 group shrink-0 mr-8" aria-label="VMFS home">
            <ShieldIcon />
            <span className="font-['Space_Grotesk'] font-bold tracking-tighter text-[1.125rem] text-[#00d87a] hidden lg:inline">
              Vijay Malik Financial Services
            </span>
            <span className="font-['Space_Grotesk'] font-bold tracking-tighter text-[1.125rem] text-[#00d87a] lg:hidden">
              VMFS
            </span>
          </Link>

          {/* ── Center Nav (Desktop) ─────────────────────────── */}
          <nav className="hidden md:flex items-center gap-6 font-['Space_Grotesk'] font-bold tracking-tight" aria-label="Primary navigation">
            {NAV_LINKS.map(({ label, href, disabled }) => {
              const active = !disabled && isActive(href);
              if (disabled) {
                return (
                  <span
                    key={label}
                    className="relative flex items-center gap-1.5 text-base text-[#3c4a3e] cursor-not-allowed select-none"
                    title="Coming soon"
                  >
                    {label}
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 leading-none">
                      SOON
                    </span>
                  </span>
                );
              }
              return (
                <Link
                  key={label}
                  href={href}
                  className={[
                    'text-base transition-colors duration-150',
                    active
                      ? 'text-[#00d87a] border-b-2 border-[#00d87a] pb-1'
                      : 'text-[#c4cfc9] hover:text-[#00d87a]',
                  ].join(' ')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* ── Right Controls ──────────────────────────────── */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {/* Search icon */}
            <button
              className="text-[#c4cfc9] hover:bg-white/5 p-2 rounded-full transition-all"
              aria-label="Search funds"
              onClick={() => router.push('/funds/search')}
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            </button>

            {/* Download App — Coming Soon */}
            <button
              disabled
              title="Android app coming soon"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#3c4a3e] text-[#859586] cursor-not-allowed select-none opacity-70 hover:opacity-90 transition-opacity"
              aria-label="Download app — coming soon"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>smartphone</span>
              <span className="text-xs font-medium hidden lg:inline">Get App</span>
              <span className="text-[10px] font-mono font-bold px-1 py-0.5 rounded bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 leading-none">SOON</span>
            </button>

            {/* Bell icon + dropdown */}
            <div className="relative" ref={bellRef}>
              <button
                className="relative text-[#c4cfc9] hover:bg-white/5 p-2 rounded-full transition-all"
                aria-label="Notifications"
                onClick={handleBellOpen}
              >
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#44f593] text-[#001f10] text-[11px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d1512]/97 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="text-sm font-bold text-[#dce5df]">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        className="text-xs font-mono text-[#859586] hover:text-[#44f593] transition-colors"
                        onClick={() => { setNotifications([]); setBellOpen(false); }}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifsLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <svg className="animate-spin w-5 h-5 text-[#44f593]" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4">
                        <span className="material-symbols-outlined text-4xl text-[#3c4a3e] mb-3" style={{ fontVariationSettings: "'FILL' 0" }}>notifications_none</span>
                        <p className="text-sm font-medium text-[#859586]">No new notifications</p>
                        <p className="text-xs text-[#3c4a3e] mt-1 text-center">Goal updates, fuel alerts, and market pulses will appear here</p>
                      </div>
                    ) : (
                      <ul>
                        {notifications.map((n, i) => {
                          const iconName  = CATEGORY_ICON[n.category]  ?? 'circle_notifications';
                          const colorCls  = CATEGORY_COLOR[n.category] ?? 'text-[#44f593] bg-[#44f593]/10 border-[#44f593]/20';
                          return (
                            <li
                              key={n.id}
                              className={[
                                'flex gap-3 px-4 py-3 transition-colors hover:bg-white/5',
                                i < notifications.length - 1 ? 'border-b border-white/5' : '',
                                !n.read ? 'bg-[#44f593]/3' : '',
                              ].join(' ')}
                            >
                              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${colorCls}`}>
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[#dce5df] leading-snug line-clamp-1">{n.title}</p>
                                <p className="text-[11px] text-[#859586] leading-relaxed mt-0.5 line-clamp-2">{n.body}</p>
                                <p className="text-xs text-[#3c4a3e] mt-1 font-mono">{timeAgo(n.createdAt)}</p>
                              </div>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-[#44f593] shrink-0 mt-2" />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Footer */}
                  {!isAuthenticated && (
                    <div className="px-4 py-3 border-t border-white/10 bg-white/3">
                      <p className="text-xs text-[#859586] text-center">
                        <Link href="/auth/signin" className="text-[#44f593] hover:underline" onClick={() => setBellOpen(false)}>Sign in</Link> to see personalised notifications
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth CTA */}
            {isAuthenticated && user ? (
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setAvatarOpen(v => !v)}
                  className="flex items-center gap-2 bg-[#00d87a] text-[#00391c] text-base font-bold px-4 py-2 rounded-xl hover:bg-[#25e283] transition-colors active:scale-95"
                  aria-label="Account menu"
                  aria-expanded={avatarOpen}
                >
                  <span className="w-5 h-5 rounded-full bg-[#00391c]/20 flex items-center justify-center text-[0.65rem] font-bold">
                    {(user as any).fullName?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
                </button>
                {avatarOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#0d1512]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                    <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c4cfc9] hover:text-white hover:bg-white/5 transition-colors" onClick={() => setAvatarOpen(false)}>
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>dashboard</span>
                      Dashboard
                    </Link>
                    <Link href="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c4cfc9] hover:text-white hover:bg-white/5 transition-colors" onClick={() => setAvatarOpen(false)}>
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>person</span>
                      Profile
                    </Link>
                    <div className="border-t border-white/10 my-1" />
                    <button
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                      onClick={() => { setAvatarOpen(false); logout(); }}
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="bg-[#00d87a] text-[#00391c] px-5 py-2 rounded-xl font-bold text-base active:scale-95 transition-transform hover:bg-[#25e283]"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* ── Mobile Hamburger ─────────────────────────────── */}
          <button
            className="md:hidden text-[#c4cfc9] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
          >
            <HamburgerIcon open={drawerOpen} />
          </button>
        </div>
      </header>

      {/* ── Market Strip (below header, fixed top-16) ─────────── */}
      <MarketStrip />

      {/* ── Mobile Drawer ──────────────────────────────────────── */}
      <div
        className={[
          'fixed inset-0 z-40 md:hidden transition-opacity duration-300',
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-[#060D0A]/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
        {/* Panel */}
        <nav
          className="absolute top-16 left-0 right-0 bg-[#0d1512]/95 backdrop-blur-xl border-b border-white/10 px-6 py-5 flex flex-col gap-1"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map(({ label, href, disabled }) => {
            const active = !disabled && isActive(href);
            if (disabled) {
              return (
                <span
                  key={label}
                  className="px-4 py-3 rounded-xl text-base font-medium flex items-center justify-between text-[#3c4a3e] cursor-not-allowed"
                >
                  {label}
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20">
                    COMING SOON
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={label}
                href={href}
                className={[
                  'px-4 py-3 rounded-xl text-base font-medium transition-all',
                  active
                    ? 'bg-[#00d87a]/10 text-[#00d87a] border border-[#00d87a]/20'
                    : 'text-[#c4cfc9] hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                {label}
              </Link>
            );
          })}
          <div className="pt-3 border-t border-white/10 mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#3c4a3e] text-[#859586] opacity-70">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>smartphone</span>
              <span className="text-sm font-medium flex-1">Download App</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#44f593]/10 text-[#44f593] border border-[#44f593]/20 leading-none">COMING SOON</span>
            </div>
            {isAuthenticated && user ? (
              <Link
                href="/dashboard"
                className="w-full text-center block bg-[#00d87a] text-[#00391c] text-sm font-bold px-4 py-3 rounded-xl hover:bg-[#25e283] transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="w-full text-center block bg-[#00d87a] text-[#00391c] text-sm font-bold px-4 py-3 rounded-xl hover:bg-[#25e283] transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
