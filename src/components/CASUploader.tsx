'use client';

import { useState, useRef } from 'react';
import { obfuscateForTransport } from '@/lib/encryption';

// ── Types matching the backend staging API ──────────────────────────────────
interface PreviewItem {
  schemeName: string;
  amc: string;
  closingBalance: number;
  closingValue: number;
  matched: boolean;
  schemeCode: string | null;
}

interface ParseSummary {
  totalFolios: number;
  totalSchemes: number;
  totalInvested: number;
  currentValue: number;
}

interface CASUploaderProps {
  onImportComplete: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function CASUploader({ onImportComplete }: CASUploaderProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Staging state — populated after POST
  const [importId, setImportId]   = useState<string | null>(null);
  const [preview, setPreview]     = useState<PreviewItem[]>([]);
  const [summary, setSummary]     = useState<ParseSummary | null>(null);
  const [investorName, setInvestorName] = useState('');
  const [pan, setPan]             = useState('');
  const [step, setStep]           = useState<'upload' | 'review' | 'complete'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File select ────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Please upload a PDF file'); return; }
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Please upload a PDF file'); return; }
    setFile(f);
    setError(null);
  };

  // ── Step 1: Upload + Parse ─────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return; }
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('casFile', file);
      if (password) formData.append('password', obfuscateForTransport(password));

      const res = await fetch('/api/portfolio/import-cas', { method: 'POST', body: formData });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to parse CAS statement');

      // Store staging token + preview data
      setImportId(result.importId);
      setPreview(result.data?.folios ?? []);
      setSummary(result.data?.summary ?? null);
      setInvestorName(result.data?.investorName ?? '');
      setPan(result.data?.pan ?? '');
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CAS statement');
    } finally {
      setIsUploading(false);
    }
  };

  // ── Step 2: Confirm import ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!importId) { setError('Session expired. Please re-upload your CAS.'); return; }
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/portfolio/import-cas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to save holdings');

      setStep('complete');
      setTimeout(() => onImportComplete(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holdings');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Complete ───────────────────────────────────────────────────────────────
  if (step === 'complete') {
    const matched = preview.filter(p => p.matched).length;
    return (
      <div className="text-center py-14 px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(68,245,147,0.12)', border: '1px solid rgba(68,245,147,0.3)' }}>
          <svg className="w-8 h-8 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#dce5df] mb-2">Portfolio Imported!</h3>
        <p className="text-[#859586] text-sm">
          {matched} of {preview.length} funds matched to live NAV data.
        </p>
      </div>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────
  if (step === 'review') {
    const matchedCount = preview.filter(p => p.matched).length;
    const totalValue   = preview.reduce((s, p) => s + p.closingValue, 0);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#dce5df]">Review Holdings</h3>
            <p className="text-xs text-[#859586] mt-0.5">
              {investorName && <span className="mr-2">{investorName}</span>}
              {pan && <span className="font-mono">{pan}</span>}
            </p>
          </div>
          <button
            onClick={() => { setStep('upload'); setImportId(null); setPreview([]); setError(null); }}
            className="text-xs text-[#859586] hover:text-[#dce5df] transition-colors"
          >
            ← Re-upload
          </button>
        </div>

        {/* Summary strip */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Funds Found', value: String(preview.length) },
              { label: 'Matched to DB', value: `${matchedCount} / ${preview.length}` },
              { label: 'Portfolio Value', value: fmt(totalValue) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(68,245,147,0.05)', border: '1px solid rgba(68,245,147,0.12)' }}>
                <p className="text-xs text-[#859586] uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-mono font-bold text-[#dce5df]">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Holdings list */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {preview.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: '#161d1a', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    item.matched
                      ? 'bg-[#44f593]/10 text-[#44f593]'
                      : 'bg-[#ffb800]/10 text-[#ffb800]'
                  }`}>
                    {item.matched ? 'MATCHED' : 'UNMATCHED'}
                  </span>
                  <span className="text-xs text-[#859586] font-mono">{item.amc}</span>
                </div>
                <p className="text-sm text-[#dce5df] truncate font-medium">{item.schemeName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-bold text-[#dce5df]">{fmt(item.closingValue)}</p>
                <p className="text-xs text-[#859586] font-mono">{item.closingBalance.toFixed(3)} units</p>
              </div>
            </div>
          ))}
        </div>

        {matchedCount < preview.length && (
          <p className="text-[11px] text-[#ffb800] bg-[#ffb800]/5 border border-[#ffb800]/20 rounded-lg px-3 py-2">
            {preview.length - matchedCount} fund{preview.length - matchedCount > 1 ? 's' : ''} could not be matched to our database.
            They will be saved and matched manually later.
          </p>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={isSaving || preview.length === 0}
          className="w-full py-3 rounded-xl font-bold text-sm text-[#00391c] transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(to right, #44f593, #00d87a)' }}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving to Portfolio…
            </span>
          ) : (
            `Import ${preview.length} Fund${preview.length !== 1 ? 's' : ''} to Portfolio`
          )}
        </button>
      </div>
    );
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-[#dce5df] mb-1">Import CAS Statement</h3>
        <p className="text-sm text-[#859586]">
          Upload your Consolidated Account Statement from CAMS or KFintech to sync all holdings.
        </p>
      </div>

      {/* How to get CAS */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(68,245,147,0.04)', border: '1px solid rgba(68,245,147,0.12)' }}>
        <p className="text-xs font-semibold text-[#44f593] mb-2">How to get your CAS</p>
        <ol className="text-xs text-[#859586] space-y-1">
          <li>1. Visit CAMS (camsonline.com) or KFintech (kfintech.com)</li>
          <li>2. Enter your PAN and registered email</li>
          <li>3. Select <strong className="text-[#dce5df]">Detailed</strong> statement type</li>
          <li>4. Download the PDF (it may be password-protected with your PAN or DOB)</li>
        </ol>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="rounded-xl p-8 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${file ? '#44f593' : 'rgba(255,255,255,0.1)'}`,
          background: file ? 'rgba(68,245,147,0.05)' : 'rgba(255,255,255,0.02)',
        }}
      >
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
        {file ? (
          <div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(68,245,147,0.12)' }}>
              <svg className="w-5 h-5 text-[#44f593]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-[#44f593] text-sm">{file.name}</p>
            <p className="text-xs text-[#859586] mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); }}
              className="mt-2 text-xs text-[#ffb4ab] hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <svg className="w-5 h-5 text-[#859586]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#dce5df]">Click to upload or drag & drop</p>
            <p className="text-xs text-[#859586] mt-1">PDF only</p>
          </div>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-medium text-[#859586] mb-1.5">
          PDF Password (if encrypted)
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Your PAN or date of birth (e.g. ABCDE1234F or 01011990)"
          className="w-full px-4 py-2.5 rounded-xl text-sm text-[#dce5df] placeholder-[#3c4a3e] outline-none focus:ring-1 focus:ring-[#44f593]/40"
          style={{ background: '#161d1a', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="w-full py-3 rounded-xl font-bold text-sm text-[#00391c] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(to right, #44f593, #00d87a)' }}
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Parsing CAS…
          </span>
        ) : (
          'Upload & Parse CAS'
        )}
      </button>

      <p className="text-xs text-[#3c4a3e] text-center">
        Your PAN, folio numbers, and personal details are never stored in plain text.
      </p>
    </div>
  );
}
