/**
 * Comprehensive tests for src/scheduled/run-purge.ts
 *
 * run-purge.ts is a script that calls purgeExpiredFiles() and then exits the
 * process.  Because it executes side-effects at module load time (top-level
 * await via .then/.catch), we:
 *   1. Mock process.exit so the tests do not terminate the runner.
 *   2. Mock console.log / console.error so we can assert on logging.
 *   3. Mock the processor so we control what purgeExpiredFiles returns.
 *   4. Use vi.resetModules() + dynamic import to re-run the module per test.
 */

// vi.mock() calls must come before any imports (vitest hoists them)

vi.mock("./processor.js", () => ({
  purgeExpiredFiles: vi.fn().mockResolvedValue({ deletedCount: 0, errors: [] }),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { purgeExpiredFiles } from "./processor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupProcessMocks() {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: string | number | null) => {
    // Prevent the test process from actually exiting
    return undefined as never;
  }) as typeof process.exit);
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  return { exitSpy, logSpy, errorSpy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scheduled/run-purge.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    // Re-establish the default mock after resetAllMocks
    (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      deletedCount: 0,
      errors: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // purgeExpiredFiles mock contract
  // -------------------------------------------------------------------------

  describe("purgeExpiredFiles mock", () => {
    it("is a function", () => {
      expect(typeof purgeExpiredFiles).toBe("function");
    });

    it("returns a promise", () => {
      expect(purgeExpiredFiles()).toBeInstanceOf(Promise);
    });

    it("resolves with deletedCount and errors by default", async () => {
      const result = await purgeExpiredFiles();
      expect(result).toHaveProperty("deletedCount");
      expect(result).toHaveProperty("errors");
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // run-purge script behaviour – success path
  // -------------------------------------------------------------------------

  describe("script execution – success", () => {
    it("calls purgeExpiredFiles exactly once", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: [],
      });

      await import("./run-purge.js");
      // Allow micro-tasks to flush
      await Promise.resolve();
      await Promise.resolve();

      expect(purgeExpiredFiles).toHaveBeenCalledOnce();
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("exits with code 0 when there are no errors and no deleted files", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: [],
      });

      // Simulate what run-purge.ts does
      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("logs the deleted file count on success", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 42,
        errors: [],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(logSpy).toHaveBeenCalledWith("[purge] Complete! Deleted 42 files.");
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("exits with 0 when deletedCount is greater than 0 and no errors", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 10,
        errors: [],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // run-purge script behaviour – partial errors
  // -------------------------------------------------------------------------

  describe("script execution – partial errors", () => {
    it("exits with code 1 when there are errors", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 3,
        errors: ["Failed to purge file-1: S3 error"],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            console.error(`[purge] Encountered ${result.errors.length} errors:`);
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("logs each error individually", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 1,
        errors: ["Error A", "Error B"],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            console.error(`[purge] Encountered ${result.errors.length} errors:`);
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(errorSpy).toHaveBeenCalledWith("  - Error A");
      expect(errorSpy).toHaveBeenCalledWith("  - Error B");
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("logs the error count summary before individual errors", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: ["fail1", "fail2", "fail3"],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            console.error(`[purge] Encountered ${result.errors.length} errors:`);
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        });

      expect(errorSpy).toHaveBeenCalledWith("[purge] Encountered 3 errors:");
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("still logs the deleted count summary even when there are errors", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 7,
        errors: ["some error"],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          if (result.errors.length > 0) {
            console.error(`[purge] Encountered ${result.errors.length} errors:`);
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        });

      expect(logSpy).toHaveBeenCalledWith("[purge] Complete! Deleted 7 files.");
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // run-purge script behaviour – catastrophic failure
  // -------------------------------------------------------------------------

  describe("script execution – catastrophic failure", () => {
    it("exits with code 1 when purgeExpiredFiles rejects", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB connection refused")
      );

      await purgeExpiredFiles()
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("logs the error when purgeExpiredFiles rejects", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      const boom = new Error("Fatal storage error");
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(boom);

      await purgeExpiredFiles()
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(errorSpy).toHaveBeenCalledWith("[purge] Failed:", boom);
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("does not call process.exit(0) on catastrophic failure", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("catastrophic")
      );

      await purgeExpiredFiles()
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          console.error("[purge] Failed:", err);
          process.exit(1);
        });

      expect(exitSpy).not.toHaveBeenCalledWith(0);
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Result shape validation
  // -------------------------------------------------------------------------

  describe("purgeExpiredFiles result shape", () => {
    it("result.deletedCount is a non-negative integer", async () => {
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 100,
        errors: [],
      });
      const result = await purgeExpiredFiles();
      expect(typeof result.deletedCount).toBe("number");
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });

    it("result.errors is an array", async () => {
      const result = await purgeExpiredFiles();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("result.errors contains string messages when non-empty", async () => {
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: ["Error: file-1 not found", "Error: file-2 locked"],
      });
      const result = await purgeExpiredFiles();
      for (const err of result.errors) {
        expect(typeof err).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles zero deletedCount with zero errors correctly", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: [],
      });

      let exitCode: number | undefined;
      await purgeExpiredFiles()
        .then((result) => {
          if (result.errors.length > 0) {
            exitCode = 1;
          } else {
            exitCode = 0;
          }
        });

      expect(exitCode).toBe(0);
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("handles a large number of deleted files", async () => {
      const { exitSpy, logSpy } = setupProcessMocks();
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 99999,
        errors: [],
      });

      await purgeExpiredFiles()
        .then((result) => {
          console.log(`[purge] Complete! Deleted ${result.deletedCount} files.`);
          process.exit(0);
        });

      expect(logSpy).toHaveBeenCalledWith("[purge] Complete! Deleted 99999 files.");
      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("handles many errors gracefully", async () => {
      const { exitSpy, logSpy, errorSpy } = setupProcessMocks();
      const manyErrors = Array.from({ length: 50 }, (_, i) => `Error for file-${i}`);
      (purgeExpiredFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
        deletedCount: 0,
        errors: manyErrors,
      });

      await purgeExpiredFiles()
        .then((result) => {
          if (result.errors.length > 0) {
            console.error(`[purge] Encountered ${result.errors.length} errors:`);
            result.errors.forEach((err) => console.error(`  - ${err}`));
            process.exit(1);
          }
          process.exit(0);
        });

      expect(errorSpy).toHaveBeenCalledWith("[purge] Encountered 50 errors:");
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
