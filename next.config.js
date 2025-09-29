/** @type {import('next').NextConfig} */
const nextConfig = {
  // Specify project root for Turbopack to resolve path conflicts
  turbopack: {
    root: __dirname
  },
  // Resolve common compilation issues
  webpack: (config) => {
    return config;
  },
  // Set proper configuration for experimental features
  experimental: {
    // Enable React server actions
    serverActions: {
      enabled: true
    }
  },
  // Fix image quality warnings
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    qualities: [75, 85, 90, 95]
  }
};

module.exports = nextConfig;
