import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/app/i18n.ts");

const nextConfig: NextConfig = {
  // Required for production Docker (standalone mode creates a minimal server.js)
  output: "standalone",

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "X-XSS-Protection",           value: "1; mode=block" },
        ],
      },
    ];
  },

  // Allow images from Cloudflare R2 and other trusted origins
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "pub-*.r2.dev" },
      { protocol: "https", hostname: "camtopproperty.site" },
      { protocol: "https", hostname: "cdn.camtopproperty.site" },
    ],
  },
};

export default withNextIntl(nextConfig);
