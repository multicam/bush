import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["src/web/**", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", ".next"],
    deps: {
      // Mock bun:sqlite since we're running under vitest/node
      external: ["bun:sqlite"],
      interopDefault: true,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "node_modules",
        "dist",
        "src/web/**",
        "src/db/migrate.ts",
        "src/db/seed.ts",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
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
});
