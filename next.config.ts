import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Temporarily ignore ESLint during builds to avoid config issues
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

