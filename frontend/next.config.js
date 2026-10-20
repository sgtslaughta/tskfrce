/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Transpile packages  
  transpilePackages: ['@emotion/react', '@emotion/styled'],
  
  // Suppress HMR warnings in development
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
  // Skip trailing slash redirect to avoid routing issues
  skipTrailingSlashRedirect: true,
  
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TaaskMaaster',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/proxy',
  },
  
  // Configure webpack dev server for HMR over network
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devServer = {
        ...config.devServer,
        host: '0.0.0.0',
        allowedHosts: 'all',
        // Improve HMR stability
        hot: true,
        liveReload: false,
        // Suppress HMR warnings
        client: {
          overlay: {
            errors: true,
            warnings: false,
          },
        },
      };
      
      // Suppress specific HMR warnings
      config.infrastructureLogging = {
        level: 'error',
      };
      
      // Suppress ISR manifest warnings in webpack
      config.stats = {
        ...config.stats,
        warningsFilter: [
          /Invalid message.*isrManifest/,
          /handleStaticIndicator/,
        ],
      };
    }
    return config;
  },

  // WebSocket Proxy (API proxy handled by pages/api/proxy/[...path].ts)
  async rewrites() {
    return [
      {
        source: '/ws/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://backend:8000'}/ws/:path*`,
      },
    ]
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  
}

module.exports = nextConfig
