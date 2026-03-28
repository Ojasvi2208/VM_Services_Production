'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────
interface TaxProfile {
  incomeRange: string;
  occupationType: string;
  taxRegime: 'new' | 'old';
  panStatus: string;
  estimatedSlab: string;
  currentFY: string;
}

interface NotifPrefs {
  market_open: boolean;
  market_close: boolean;
  nfo_alert: boolean;
  price_alert: boolean;
  news_alert: boolean;
  portfolio_update: boolean;
  daily_briefing: boolean;
}

// ─── Constants ───────────────────────────────────────────────
const INCOME_RANGES = ['0-4L', '4-8L', '8-12L', '12-16L', '16-20L', '20-24L', '24L+'];
const OCCUPATION_TYPES = [
  { value: 'salaried',     label: 'Salaried' },
  { value: 'business',     label: 'Business Owner' },
  { value: 'professional', label: 'Professional' },
];
const NOTIF_LABELS: Record<keyof NotifPrefs, string> = {
  market_open:       'Market open (9:15 AM)',
  market_close:      'Market close (3:30 PM)',
  nfo_alert:         'New fund launches (NFO)',
  price_alert:       'Price / NAV alerts',
  news_alert:        'Market news digest',
  portfolio_update:  'Portfolio updates',
  daily_briefing:    'Daily briefing',
};

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card-vi rounded-2xl overflow-hidden">
      <div className="px-4 md:px-6 py-4 bg-white/[0.02] border-b border-white/5">
        <h2 className="font-['Space_Grotesk'] font-bold text-base text-[#dce5df]">{title}</h2>
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </section>
  );
}

// ─── Toggle switch ────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-[#44f593]' : 'bg-[#3c4a3e]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [taxProfile, setTaxProfile] = useState<TaxProfile | null>(null);
  const [notifPrefs, setNotifPrefs]  = useState<NotifPrefs | null>(null);
  const [loadingTax, setLoadingTax]  = useState(true);
  const [loadingNotif, setLoadingNotif] = useState(true);

  // Tax form state
  const [incomeRange, setIncomeRange]       = useState('');
  const [occupationType, setOccupationType] = useState('');
  const [taxRegime, setTaxRegime]           = useState<'new' | 'old'>('new');
  const [taxSaving, setTaxSaving]           = useState(false);
  const [taxSaved, setTaxSaved]             = useState(false);

  // Notif saving state
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved]   = useState(false);

  const isPremium = (user as any)?.is_premium ?? false;

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin?redirect=/profile');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load tax profile
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/user/tax-profile')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTaxProfile(d.profile);
          setIncomeRange(d.profile.incomeRange);
          setOccupationType(d.profile.occupationType);
          setTaxRegime(d.profile.taxRegime);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTax(false));
  }, [isAuthenticated]);

  // Load notification preferences
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    fetch(`/api/notifications/preferences?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setNotifPrefs(d.preferences as NotifPrefs);
      })
      .catch(() => {})
      .finally(() => setLoadingNotif(false));
  }, [isAuthenticated, user?.id]);

  const saveTaxProfile = async () => {
    setTaxSaving(true);
    setTaxSaved(false);
    try {
      const r = await fetch('/api/user/tax-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomeRange, occupationType, taxRegime }),
      });
      if (r.ok) setTaxSaved(true);
    } catch {}
    finally { setTaxSaving(false); }
  };

  const saveNotifPrefs = async (prefs: NotifPrefs) => {
    if (!user?.id) return;
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      const r = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, preferences: prefs }),
      });
      if (r.ok) setNotifSaved(true);
    } catch {}
    finally { setNotifSaving(false); }
  };

  const toggleNotif = (key: keyof NotifPrefs) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="bg-[#060d0a] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-6 md:px-8 max-w-[800px] mx-auto flex-1 w-full">

        {/* Page header */}
        <div className="mb-10">
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl md:text-5xl text-[#dce5df] tracking-tight mb-2">
            Profile
          </h1>
          <p className="text-[#859586] text-sm">Account · Tax profile · Notifications · Premium status</p>
        </div>

        <div className="flex flex-col gap-6">

          {/* ── Account ──────────────────────────────────────── */}
          <Section title="Account">
            <div className="flex items-center gap-5 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#44f593]/15 border border-[#44f593]/30 flex items-center justify-center text-2xl font-bold text-[#44f593] font-['Space_Grotesk']">
                {user?.fullName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="font-['Space_Grotesk'] font-bold text-lg text-[#dce5df]">
                  {user?.fullName ?? 'User'}
                </p>
                <p className="text-sm text-[#859586]">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-[#161d1a] rounded-xl">
                <p className="text-xs uppercase tracking-widest text-[#859586] mb-1">Account Type</p>
                <p className="font-bold text-[#dce5df]">{isPremium ? 'Pro' : 'Free'}</p>
              </div>
              <div className="p-4 bg-[#161d1a] rounded-xl">
                <p className="text-xs uppercase tracking-widest text-[#859586] mb-1">Email Verified</p>
                <p className={`font-bold ${user?.emailVerified ? 'text-[#44f593]' : 'text-amber-400'}`}>
                  {user?.emailVerified ? 'Verified' : 'Pending'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={logout}
                className="px-4 py-2 border border-[#3c4a3e] text-[#859586] rounded-xl text-sm hover:text-[#ffb4ab] hover:border-[#ffb4ab]/30 transition-colors"
              >
                Sign out
              </button>
            </div>
          </Section>

          {/* ── Premium Status ───────────────────────────────── */}
          <Section title="Premium Status">
            {isPremium ? (
              <div className="flex items-center gap-4 p-4 bg-[#44f593]/5 border border-[#44f593]/20 rounded-xl">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-bold text-[#44f593]">VMFS Pro — Active</p>
                  <p className="text-xs text-[#859586] mt-0.5">All Pro features unlocked.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 p-4 bg-[#161d1a] border border-[#3c4a3e] rounded-xl">
                <span className="text-2xl">💎</span>
                <div className="flex-1">
                  <p className="font-bold text-[#dce5df]">Free Plan</p>
                  <p className="text-xs text-[#859586] mt-0.5 mb-3">
                    Upgrade to Pro for portfolio overlap detection, fund scoring, LTCG tax calculator, advanced analytics, capital gains PDF export, and many more.
                  </p>
                  <Link
                    href="/premium"
                    className="inline-block bg-[#44f593] text-[#001f10] px-5 py-2 rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors"
                  >
                    Upgrade for ₹99/year →
                  </Link>
                </div>
              </div>
            )}
          </Section>

          {/* ── Tax Profile ──────────────────────────────────── */}
          <Section title="Tax Profile">
            {loadingTax ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {taxProfile?.estimatedSlab && (
                  <div className="p-4 bg-[#44f593]/5 border border-[#44f593]/20 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[#859586] mb-0.5">Estimated Tax Slab</p>
                      <p className="font-mono font-bold text-[#44f593] text-lg">{taxProfile.estimatedSlab}</p>
                    </div>
                    <p className="text-xs text-[#859586]">{taxProfile.currentFY}</p>
                  </div>
                )}

                {/* Income Range */}
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-3">Annual Income</label>
                  <div className="grid grid-cols-4 gap-2">
                    {INCOME_RANGES.map(r => (
                      <button
                        key={r}
                        onClick={() => setIncomeRange(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                          incomeRange === r
                            ? 'bg-[#44f593] text-[#001f10] border-[#44f593]'
                            : 'bg-[#161d1a] text-[#859586] border-[#3c4a3e] hover:border-[#44f593]/30 hover:text-[#dce5df]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Occupation */}
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-3">Occupation Type</label>
                  <div className="flex gap-3">
                    {OCCUPATION_TYPES.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setOccupationType(o.value)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                          occupationType === o.value
                            ? 'bg-[#44f593] text-[#001f10] border-[#44f593]'
                            : 'bg-[#161d1a] text-[#859586] border-[#3c4a3e] hover:border-[#44f593]/30 hover:text-[#dce5df]'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Regime */}
                <div>
                  <label className="text-xs font-mono text-[#859586] uppercase tracking-widest block mb-3">Tax Regime</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#3c4a3e] w-fit">
                    {(['new', 'old'] as const).map(regime => (
                      <button
                        key={regime}
                        onClick={() => setTaxRegime(regime)}
                        className={`px-8 py-2.5 text-xs font-bold capitalize transition-colors ${
                          taxRegime === regime
                            ? 'bg-[#44f593] text-[#001f10]'
                            : 'bg-transparent text-[#859586] hover:text-[#dce5df]'
                        }`}
                      >
                        {regime} regime
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={saveTaxProfile}
                    disabled={taxSaving}
                    className="bg-[#44f593] text-[#001f10] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#25e283] transition-colors disabled:opacity-50"
                  >
                    {taxSaving ? 'Saving…' : 'Save Tax Profile'}
                  </button>
                  {taxSaved && (
                    <span className="text-xs text-[#44f593] font-bold">Saved ✓</span>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* ── Notifications ────────────────────────────────── */}
          <Section title="Notifications">
            {loadingNotif ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-[#44f593]/30 border-t-[#44f593] rounded-full animate-spin" />
              </div>
            ) : notifPrefs ? (
              <div className="flex flex-col gap-1">
                {(Object.keys(NOTIF_LABELS) as (keyof NotifPrefs)[]).map(key => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-b-0"
                  >
                    <span className="text-sm text-[#dce5df]">{NOTIF_LABELS[key]}</span>
                    <Toggle
                      checked={notifPrefs[key]}
                      onChange={() => toggleNotif(key)}
                    />
                  </div>
                ))}
                {notifSaved && (
                  <p className="text-xs text-[#44f593] font-bold pt-2">Preferences saved ✓</p>
                )}
                {notifSaving && (
                  <p className="text-xs text-[#859586] pt-2">Saving…</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#859586]">Could not load notification preferences.</p>
            )}
          </Section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
