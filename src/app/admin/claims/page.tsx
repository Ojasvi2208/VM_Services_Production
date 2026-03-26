'use client';

import { useState, useEffect, useCallback } from 'react';

interface Claim {
  id: string;
  transactionId: string;
  upiRef: string | null;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  claimedAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  user: {
    email: string;
    fullName: string;
    phone: string | null;
  };
}

type TabFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export default function AdminClaimsPage() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret');
    if (stored) { setSecret(stored); setAuthenticated(true); }
  }, []);

  const fetchClaims = useCallback(async (tab: TabFilter = activeTab) => {
    setLoading(true);
    try {
      const params = tab !== 'ALL' ? `?status=${tab}` : '';
      const res = await fetch(`/api/admin/claims${params}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem('admin_secret');
        setAuthenticated(false);
        setSecret('');
        return;
      }
      const data = await res.json();
      if (data.success) setClaims(data.claims);
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
    }
  }, [secret, activeTab]);

  useEffect(() => {
    if (authenticated) fetchClaims();
  }, [authenticated, activeTab, fetchClaims]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secret.trim()) {
      sessionStorage.setItem('admin_secret', secret.trim());
      setAuthenticated(true);
    }
  };

  const handleApprove = async (claimId: string) => {
    setActionLoading(claimId);
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'APPROVED' as const } : c));
    try {
      const res = await fetch('/api/admin/claims/approve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      });
      if (!res.ok) fetchClaims();
    } catch { fetchClaims(); } finally { setActionLoading(null); }
  };

  const handleReject = async (claimId: string) => {
    const note = window.prompt('Rejection reason (optional):');
    setActionLoading(claimId);
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'REJECTED' as const } : c));
    try {
      const res = await fetch('/api/admin/claims/reject', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, note }),
      });
      if (!res.ok) fetchClaims();
    } catch { fetchClaims(); } finally { setActionLoading(null); }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
      APPROVED: 'bg-[#44f593]/10 text-[#44f593] border-[#44f593]/30',
      REJECTED: 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${map[status] || ''}`}>
        {status}
      </span>
    );
  };

  // ── Login screen ────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#060D0A] flex items-center justify-center px-4">
        <div className="glass-card rounded-3xl p-8 w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[#44f593]/10 border border-[#44f593]/20 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#44f593" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-display font-bold text-[#dce5df]">Admin Access</h1>
            <p className="text-[#859586] text-sm mt-1">Enter admin secret to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              className="w-full bg-[#08100d] border border-[#3c4a3e] rounded-xl px-4 py-3 text-sm text-[#dce5df] placeholder:text-[#3c4a3e] focus:outline-none focus:border-[#44f593]/50 transition-all"
            />
            <button type="submit"
              className="w-full bg-gradient-to-br from-[#44f593] to-[#00d87a] text-[#001f10] py-3 rounded-xl font-bold text-sm hover:scale-[1.01] transition-transform">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────
  const tabs: { label: string; value: TabFilter }[] = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'All', value: 'ALL' },
  ];

  const pendingCount = claims.filter(c => c.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-[#060D0A]">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-display font-bold gradient-text">Premium Claims</h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-[#859586] text-sm">Review and approve UPI payment claims for Pro tier (₹99/yr)</p>
          </div>
          <button
            onClick={() => fetchClaims()}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#3c4a3e] text-[#dce5df] text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass-card rounded-xl mb-6 w-fit">
          {tabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-[#44f593]/15 text-[#44f593] border border-[#44f593]/20'
                  : 'text-[#859586] hover:text-[#dce5df]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <svg className="animate-spin w-8 h-8 text-[#44f593] mx-auto mb-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[#859586] text-sm">Loading claims…</p>
          </div>
        )}

        {/* Table */}
        {!loading && claims.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#161d1a] text-xs font-mono text-[#859586] uppercase tracking-widest">
                  <tr>
                    {['User', 'Amount', 'Transaction ID', 'UPI Ref', 'Date', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {claims.map(claim => (
                    <tr key={claim.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-5">
                        <p className="text-sm font-semibold text-[#dce5df]">{claim.user.fullName}</p>
                        <p className="text-xs text-[#859586] font-mono">{claim.user.email}</p>
                        {claim.user.phone && <p className="text-xs text-[#3c4a3e] font-mono">{claim.user.phone}</p>}
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm font-mono font-bold text-[#44f593]">₹{claim.amount}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-mono text-[#c0c9c2]">{claim.transactionId}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs font-mono text-[#859586]">{claim.upiRef || '—'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-xs text-[#859586]">{formatDate(claim.claimedAt)}</span>
                      </td>
                      <td className="py-4 px-5">{statusBadge(claim.status)}</td>
                      <td className="py-4 px-5">
                        {claim.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(claim.id)} disabled={actionLoading === claim.id}
                              className="px-3 py-1.5 bg-[#44f593]/10 border border-[#44f593]/30 text-[#44f593] rounded-lg text-xs font-semibold hover:bg-[#44f593]/20 transition-colors disabled:opacity-50">
                              Approve
                            </button>
                            <button onClick={() => handleReject(claim.id)} disabled={actionLoading === claim.id}
                              className="px-3 py-1.5 bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] rounded-lg text-xs font-semibold hover:bg-[#ffb4ab]/20 transition-colors disabled:opacity-50">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#3c4a3e] font-mono">
                            {claim.reviewedAt ? formatDate(claim.reviewedAt) : '—'}
                          </span>
                        )}
                        {claim.adminNote && (
                          <p className="mt-1 text-xs text-[#859586] italic">Note: {claim.adminNote}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && claims.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-[#3c4a3e]/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#3c4a3e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-display font-bold text-[#dce5df] mb-1">No claims found</h3>
            <p className="text-[#859586] text-sm">
              {activeTab === 'PENDING' ? 'No pending claims to review.' : `No ${activeTab.toLowerCase()} claims.`}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
