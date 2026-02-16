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

// ════════════════════════════════════════════════════════════════════
//  AES-256-GCM — Server-Side PII Encryption (DPDP Act Compliance)
// ════════════════════════════════════════════════════════════════════
//
//  Usage: Encrypt folio_number, investor_name, and any PII before
//         writing to PostgreSQL. Decrypt only when rendering to the
//         authenticated owner.
//
//  Key: Set ENCRYPTION_KEY env var (64-char hex = 32 bytes).
//       Generate with: openssl rand -hex 32
//
//  Format: ENC:<iv_hex>:<authTag_hex>:<ciphertext_hex>
// ════════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY env var missing or invalid. Must be 64-char hex (32 bytes). Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns "ENC:<iv>:<authTag>:<ciphertext>" (all hex).
 * Returns empty string for null/undefined/empty input.
 * Gracefully returns plaintext if ENCRYPTION_KEY is not configured.
 */
export function encryptPII(plaintext: string | null | undefined): string {
  if (!plaintext) return '';
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `ENC:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch {
    // ENCRYPTION_KEY not set — store plaintext (migration-compatible)
    return plaintext;
  }
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Accepts "ENC:<iv>:<authTag>:<ciphertext>" format.
 * Returns original plaintext. Returns input as-is if not encrypted.
 */
export function decryptPII(ciphertext: string | null | undefined): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('ENC:')) return ciphertext; // not encrypted, return as-is (migration compat)
  const parts = ciphertext.split(':');
  if (parts.length !== 4) return '';
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = Buffer.from(parts[3], 'hex');
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ════════════════════════════════════════════════════════════════════
//  PII Masking — Response Sanitization Layer
// ════════════════════════════════════════════════════════════════════

/**
 * Mask a PAN: ABCDE1234F → XXXXX1234X
 */
export function maskPAN(pan: string | null | undefined): string {
  if (!pan) return '';
  // Already masked
  if (pan.includes('X')) return pan;
  if (pan.length === 10) return `XXXXX${pan.slice(5, 9)}X`;
  return pan.replace(/[A-Z]/g, 'X');
}

/**
 * Mask a folio number: 1234567890/12 → XXXXXXX890/XX
 */
export function maskFolio(folio: string | null | undefined): string {
  if (!folio) return '';
  const clean = folio.replace(/\s/g, '');
  if (clean.length <= 4) return 'X'.repeat(clean.length);
  const visible = clean.slice(-4);
  return 'X'.repeat(clean.length - 4) + visible;
}

/**
 * Mask investor name: VIJAY KUMAR MALIK → V***** K**** M****
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  return name.split(' ').map(word => {
    if (word.length <= 1) return word;
    return word[0] + '*'.repeat(word.length - 1);
  }).join(' ');
}

/**
 * Mask an email: user@example.com → u***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}
