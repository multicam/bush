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
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
