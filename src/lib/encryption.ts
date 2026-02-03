// Client-side obfuscation utilities for sensitive data
// Makes passwords not immediately readable in DevTools Network tab

// Simple obfuscation for display in network tab
// This makes passwords not immediately readable in DevTools
// Note: This is NOT cryptographic security - HTTPS provides the actual security
// This just prevents casual viewing of passwords in DevTools
export function obfuscateForTransport(data: string): string {
  // Use a simple reversible encoding that's not plain text
  const encoded = btoa(unescape(encodeURIComponent(data)));
  // Reverse and add some noise
  const reversed = encoded.split('').reverse().join('');
  // Add a marker so server knows it's obfuscated
  return `SEC:${reversed}`;
}

export function deobfuscateFromTransport(data: string): string {
  if (data.startsWith('SEC:')) {
    const reversed = data.slice(4);
    const encoded = reversed.split('').reverse().join('');
    return decodeURIComponent(escape(atob(encoded)));
  }
  // Legacy OBF format
  if (data.startsWith('OBF:')) {
    const encoded = data.slice(4);
    return decodeURIComponent(escape(atob(encoded)));
  }
  return data;
}
