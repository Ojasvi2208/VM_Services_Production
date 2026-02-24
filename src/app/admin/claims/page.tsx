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
    if (stored) {
      setSecret(stored);
      setAuthenticated(true);
    }
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
      if (data.success) {
        setClaims(data.claims);
      }
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
    // Optimistic update
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'APPROVED' as const } : c))
    );
    try {
      const res = await fetch('/api/admin/claims/approve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ claimId }),
      });
      if (!res.ok) {
        // Revert on failure
        fetchClaims();
      }
    } catch {
      fetchClaims();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (claimId: string) => {
    const note = window.prompt('Rejection reason (optional):');
    setActionLoading(claimId);
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'REJECTED' as const } : c))
    );
    try {
      const res = await fetch('/api/admin/claims/reject', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ claimId, note }),
      });
      if (!res.ok) {
        fetchClaims();
      }
    } catch {
      fetchClaims();
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED: 'bg-green-100 text-green-800 border-green-300',
      REJECTED: 'bg-red-100 text-red-800 border-red-300',
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || ''}`}
      >
        {status}
      </span>
    );
  };

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm space-y-4"
        >
          <h1 className="text-2xl font-bold text-brand-navy text-center">Admin Access</h1>
          <p className="text-sm text-gray-500 text-center">Enter admin secret to continue</p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-royal"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-brand-royal text-white py-3 rounded-lg font-semibold hover:bg-brand-navy transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  // Dashboard
  const tabs: { label: string; value: TabFilter }[] = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'All', value: 'ALL' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy">Premium Claims</h1>
            <p className="text-gray-500 mt-1">Review and approve UPI payment claims</p>
          </div>
          <button
            onClick={() => fetchClaims()}
            disabled={loading}
            className="bg-brand-gold text-white px-5 py-2.5 rounded-lg font-medium hover:bg-yellow-600 transition-all disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white p-1.5 inline-flex rounded-xl shadow-sm mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-5 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.value
                  ? 'bg-brand-royal text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-brand-royal border-t-transparent" />
            <p className="mt-4 text-gray-500">Loading claims...</p>
          </div>
        )}

        {/* Table */}
        {!loading && claims.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">User</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">Amount</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">Transaction ID</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">UPI Ref</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">Date</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">Status</th>
                    <th className="text-left py-4 px-5 font-semibold text-brand-navy text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div className="font-medium text-brand-navy text-sm">{claim.user.fullName}</div>
                        <div className="text-xs text-gray-500">{claim.user.email}</div>
                        {claim.user.phone && (
                          <div className="text-xs text-gray-400">{claim.user.phone}</div>
                        )}
                      </td>
                      <td className="py-4 px-5 font-semibold text-brand-navy">
                        &#8377;{claim.amount}
                      </td>
                      <td className="py-4 px-5 font-mono text-xs text-gray-700">
                        {claim.transactionId}
                      </td>
                      <td className="py-4 px-5 font-mono text-xs text-gray-500">
                        {claim.upiRef || '—'}
                      </td>
                      <td className="py-4 px-5 text-sm text-gray-600">
                        {formatDate(claim.claimedAt)}
                      </td>
                      <td className="py-4 px-5">{statusBadge(claim.status)}</td>
                      <td className="py-4 px-5">
                        {claim.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(claim.id)}
                              disabled={actionLoading === claim.id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(claim.id)}
                              disabled={actionLoading === claim.id}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {claim.reviewedAt ? formatDate(claim.reviewedAt) : '—'}
                          </span>
                        )}
                        {claim.adminNote && (
                          <div className="mt-1 text-xs text-gray-400 italic">
                            Note: {claim.adminNote}
                          </div>
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
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-navy mb-1">No claims found</h3>
            <p className="text-gray-500 text-sm">
              {activeTab === 'PENDING'
                ? 'No pending claims to review.'
                : `No ${activeTab.toLowerCase()} claims.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
