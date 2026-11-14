import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shop is a deterministic QA target: every page is rendered per request
  // from the in-memory, per-tenant store, so the Cache Components model is off
  // and request-time APIs (cookies) simply make routes dynamic.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // App Router treats folders starting with "_" as private, so the public
    // /__test/* hooks are implemented by route handlers under /api/test-hooks/*.
    return [{ source: "/__test/:path*", destination: "/api/test-hooks/:path*" }];
  },
};

export default nextConfig;
