import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['@prisma/client'],
  },
  // 빌드 성능 최적화
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  }
};

export default nextConfig;
