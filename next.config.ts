import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Type errors fail the build. Keep strict.
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      // ikas product images / CDN — refine to exact hosts in Phase 1.
      { protocol: "https", hostname: "**.myikas.com" },
      { protocol: "https", hostname: "**.ikas.com" },
    ],
  },
};

export default nextConfig;
