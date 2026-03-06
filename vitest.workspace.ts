/**
 * Vitest Workspace Configuration
 *
 * Defines separate test projects for backend (node) and frontend (jsdom) tests.
 * Reference: specs/15-frontend-testing.md
 */
import { defineWorkspace } from "vitest/config";
import path from "path";

export default defineWorkspace([
  {
    // Backend tests - use node environment
    test: {
      name: "backend",
      globals: true,
      environment: "node",
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: [
        "node_modules",
        "dist",
        ".next",
        "src/web/**/*.test.tsx", // Frontend component tests handled separately
      ],
      deps: {
        external: ["bun:sqlite"],
        interopDefault: true,
      },
    },
    resolve: {
      alias: {
        "@/config": path.resolve(__dirname, "src/config/index.ts"),
        "@/config/env": path.resolve(__dirname, "src/config/env.ts"),
        "@/db": path.resolve(__dirname, "src/db/index.ts"),
        "@/db/schema": path.resolve(__dirname, "src/db/schema.ts"),
        "@/api": path.resolve(__dirname, "src/api/index.ts"),
        "@/auth": path.resolve(__dirname, "src/auth/index.ts"),
        "@/redis": path.resolve(__dirname, "src/redis/index.ts"),
        "@/permissions": path.resolve(__dirname, "src/permissions/index.ts"),
        "@/web": path.resolve(__dirname, "src/web"),
        "@/shared": path.resolve(__dirname, "src/shared"),
      },
    },
  },
  {
    // Frontend component tests - use jsdom environment
    test: {
      name: "frontend",
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest.web.setup.ts"],
      include: ["src/web/**/*.test.tsx", "src/web/**/*.test.ts"],
      exclude: ["node_modules", "dist", ".next", "src/web/__tests__/**"],
    },
    resolve: {
      alias: {
        "@/web": path.resolve(__dirname, "src/web"),
        "@/config": path.resolve(__dirname, "src/config/index.ts"),
      },
    },
  },
]);
