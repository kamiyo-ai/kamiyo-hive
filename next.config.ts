import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:locale/dreams',
        destination: '/:locale/trust-graph',
        permanent: true,
      },
      {
        source: '/dreams',
        destination: '/trust-graph',
        permanent: true,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // snarkjs and circomlibjs use Node.js APIs that break SSR
    // Mark them as external so they're only loaded client-side at runtime
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  // Transpile these packages to handle ESM properly
  transpilePackages: ['snarkjs', 'circomlibjs'],
};

export default withNextIntl(nextConfig);
