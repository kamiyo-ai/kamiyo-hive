import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
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

    // Ignore bun: protocol imports that Prisma CLI uses internally
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push(/^bun:/);
    }

    return config;
  },
  // Transpile these packages to handle ESM properly
  transpilePackages: ['snarkjs', 'circomlibjs'],
  // Mark Prisma as server-only to avoid client-side bundling issues
  serverExternalPackages: ['prisma', '@prisma/client'],
};

export default withNextIntl(nextConfig);
