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
  async headers() {
    return [
      {
        // The app runs embedded in an iframe inside the ikas admin panel, so
        // it must be framable by ikas — but by nobody else. frame-ancestors is
        // used rather than X-Frame-Options because the latter cannot express
        // an allow-list of origins.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.myikas.com https://*.ikas.com;",
          },
        ],
      },
      {
        // The customer web-chat widget is framed BY merchant storefronts, which
        // live on arbitrary domains — so it needs its own, wider policy.
        source: "/widget/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
};

export default nextConfig;
