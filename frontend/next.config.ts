import type { NextConfig } from "next";

import { API_PREFIX } from "./src/lib/api-prefix";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: `${API_PREFIX}/:path*`, destination: "/api/proxy/:path*" }];
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
