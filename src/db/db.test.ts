/**
 * Tests for Database Module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock bun:sqlite
const mockSqlite = {
  exec: vi.fn(),
  close: vi.fn(),
};

vi.mock("bun:sqlite", () => ({
  Database: vi.fn(() => mockSqlite),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm/bun-sqlite", () => ({
  drizzle: vi.fn(() => ({ mock: "drizzle" })),
}));

// Mock config
vi.mock("../config/index.js", () => ({
  config: {
    DATABASE_URL: ":memory:",
    DATABASE_WAL_MODE: false,
    DATABASE_BUSY_TIMEOUT: 5000,
  },
}));

describe("Database Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("closeDatabase", () => {
    it("closes the database connection successfully", async () => {
      mockSqlite.close.mockReturnValue(undefined);

      const { closeDatabase } = await import("./index.js");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      closeDatabase();

      expect(mockSqlite.close).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith("[Database] Connection closed");

      consoleSpy.mockRestore();
    });

    it("handles errors when closing the database", async () => {
      const error = new Error("Close failed");
      mockSqlite.close.mockImplementation(() => {
        throw error;
      });

      const { closeDatabase } = await import("./index.js");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      closeDatabase();

      expect(mockSqlite.close).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Database] Error closing connection:",
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
