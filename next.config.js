/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname
  },
  webpack: (config) => {
    return config;
  },
  experimental: {
    serverActions: {
      enabled: true
    }
  },
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    qualities: [75, 85, 90, 95]
  },

  // ── Security Headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Legacy XSS filter (modern browsers ignore but IE/Edge honour)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Limit referrer to same-origin for cross-origin navigations
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable unnecessary browser features; allow geolocation only for self (fuel prices)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), interest-cohort=(), geolocation=(self)' },
          // Enforce HTTPS for 2 years (preload-eligible)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Content Security Policy — defence-in-depth against XSS/data injection
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-eval (for hot-reload dev) and unsafe-inline (for styled-jsx)
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              // Allow images from any HTTPS source (news thumbnails, fund logos, etc.)
              "img-src 'self' data: blob: https:",
              // Allow API calls to self + known third-parties
              "connect-src 'self' https:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          },
          // Prevent caching of sensitive API responses
          // (individual routes can override with their own Cache-Control)
        ],
      },
      // Extra no-cache directives for auth and admin endpoints
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        ],
      },
      {
        source: '/api/portfolio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
