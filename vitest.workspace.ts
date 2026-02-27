/**
 * Vitest Workspace Configuration
 *
 * Defines separate test projects for backend (node) and frontend (jsdom) tests.
 * Reference: specs/15-frontend-testing.md
 */
import { defineWorkspace } from "vitest/config";

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
        "@/config": "/home/tgds/Code/bush/src/config/index.ts",
        "@/config/env": "/home/tgds/Code/bush/src/config/env.ts",
        "@/db": "/home/tgds/Code/bush/src/db/index.ts",
        "@/db/schema": "/home/tgds/Code/bush/src/db/schema.ts",
        "@/api": "/home/tgds/Code/bush/src/api/index.ts",
        "@/auth": "/home/tgds/Code/bush/src/auth/index.ts",
        "@/redis": "/home/tgds/Code/bush/src/redis/index.ts",
        "@/permissions": "/home/tgds/Code/bush/src/permissions/index.ts",
        "@/web": "/home/tgds/Code/bush/src/web",
        "@/shared": "/home/tgds/Code/bush/src/shared",
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
        "@/web": "/home/tgds/Code/bush/src/web",
        "@/config": "/home/tgds/Code/bush/src/config/index.ts",
      },
    },
  },
]);
