// Client-safe obfuscation utilities — browser-compatible, no Node.js deps.
// Makes passwords not immediately readable in DevTools Network tab.
// NOTE: This is NOT cryptographic security — HTTPS provides actual security.
//
// For AES-256-GCM server-side PII encryption, use @/lib/encryption (server only).

export function obfuscateForTransport(data: string): string {
  const encoded = btoa(unescape(encodeURIComponent(data)));
  const reversed = encoded.split('').reverse().join('');
  return `SEC:${reversed}`;
}

export function deobfuscateFromTransport(data: string): string {
  if (data.startsWith('SEC:')) {
    const reversed = data.slice(4);
    const encoded = reversed.split('').reverse().join('');
    return decodeURIComponent(escape(atob(encoded)));
  }
  if (data.startsWith('OBF:')) {
    const encoded = data.slice(4);
    return decodeURIComponent(escape(atob(encoded)));
  }
  return data;
}
