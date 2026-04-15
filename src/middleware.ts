import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── In-memory rate limit store ────────────────────────────────────────────────
// NOTE: On Vercel each cold-start instance gets a fresh store.
// This is intentional — it's a last-resort defence layer, not a distributed lock.
// The primary rate-limit defence is at the DB/application layer inside each route.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateRule { max: number; windowMs: number }

const RATE_RULES: Array<{ prefix: string; rule: RateRule }> = [
  { prefix: '/api/auth/',                   rule: { max: 15,  windowMs: 60_000  } }, // 15 auth req/min
  { prefix: '/api/verify-arn',              rule: { max: 8,   windowMs: 60_000  } }, // 8 ARN checks/min
  { prefix: '/api/admin/',                  rule: { max: 40,  windowMs: 60_000  } }, // 40 admin req/min
  { prefix: '/api/premium/',                rule: { max: 10,  windowMs: 60_000  } }, // 10 premium req/min
  { prefix: '/api/portfolio/import-cas',    rule: { max: 5,   windowMs: 300_000 } }, // 5 CAS uploads/5min
  { prefix: '/api/contact',                 rule: { max: 5,   windowMs: 300_000 } }, // 5 contact forms/5min
  // Catch-all for public read APIs — prevents a single IP scraping the app.
  // Generous (300/min) because legit mobile + web clients make many requests
  // per screen; edge cache absorbs most repeat hits so this protects the tail.
  { prefix: '/api/',                        rule: { max: 300, windowMs: 60_000  } },
];

// ── Sensitive paths requiring IP audit logging ────────────────────────────────
const AUDIT_PATHS = [
  '/api/auth/signin',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/admin/',
  '/api/verify-arn',
  '/api/portfolio/import-cas',
  '/api/premium/claim',
];

function getRealIP(request: NextRequest): string {
  // Cloudflare → x-real-ip → x-forwarded-for → fallback
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

function applyRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; retryAfter: number } {
  const match = RATE_RULES.find(r => pathname.startsWith(r.prefix));
  if (!match) return { allowed: true, remaining: 999, retryAfter: 0 };

  const { max, windowMs } = match.rule;
  const key = `${ip}::${match.prefix}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: max - entry.count, retryAfter: 0 };
}

function needsAudit(pathname: string): boolean {
  return AUDIT_PATHS.some(p => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const host     = request.headers.get('host') || '';
  const url      = request.nextUrl.clone();
  const pathname = request.nextUrl.pathname;

  // ── 1. Canonical www redirect ─────────────────────────────────────────────
  // Skip redirect for Google bots (AdSense/Search verification needs non-www to respond directly)
  const ua = request.headers.get('user-agent') || '';
  const isGoogleBot = /googlebot|adsbot|mediapartners/i.test(ua);
  if (host === 'vmfinancialservices.com' && !isGoogleBot) {
    url.host = 'www.vmfinancialservices.com';
    return NextResponse.redirect(url, 301);
  }

  // ── 2. Block .env / hidden file probes ───────────────────────────────────
  if (/\.(env|git|DS_Store|htaccess|htpasswd|bak|config|sql|log)$/i.test(pathname) ||
      pathname.includes('/.') ||
      pathname.includes('/wp-') ||
      pathname.includes('/phpMyAdmin') ||
      pathname.toLowerCase().includes('eval(') ||
      pathname.toLowerCase().includes('<script')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ip = getRealIP(request);

  // ── 3. Rate limiting for API routes ──────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const { allowed, remaining, retryAfter } = applyRateLimit(ip, pathname);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(Math.floor(Date.now() / 1000) + retryAfter),
          },
        }
      );
    }

    const response = NextResponse.next();

    // Attach client IP so API route handlers can access it for logging
    response.headers.set('X-Client-IP', ip);
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    // Mark audit-worthy requests so server components can log them
    if (needsAudit(pathname)) {
      response.headers.set('X-Audit-Required', '1');
    }

    return response;
  }

  // ── 4. Enforce HTTPS on non-localhost origins ─────────────────────────────
  // Must check with startsWith to cover localhost:3000, localhost:3001, etc.
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('[::1]');
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto !== 'https' && !isLocalhost) {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all paths except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)',
  ],
};
