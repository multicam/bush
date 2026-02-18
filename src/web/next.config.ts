import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow imports from outside the src/web directory
    externalDir: true,
  },
  // Proxy /v4 API requests to the Hono backend
  // This avoids cross-origin cookie issues during development
  async rewrites() {
    return [
      {
        source: "/v4/:path*",
        destination: `${process.env.API_URL || "http://localhost:3001"}/v4/:path*`,
      },
    ];
  },
  // Handle .js extension imports for shared modules
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    // Mark Bun-specific modules as external to avoid bundling errors
    // These modules only exist in Bun runtime, not in Node.js (used by Next.js build)
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("bun:sqlite");
      }
    }
    return config;
  },
};

export default nextConfig;
