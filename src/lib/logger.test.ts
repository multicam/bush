/**
 * Tests for Structured Logging Utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, logger, scrubSecrets } from "./logger";

// Mock config module
vi.mock("../config/index.js", () => ({
  config: {
    LOG_LEVEL: "debug",
  },
  scrubSecrets: (str: string) => str.replace(/secret/g, "[REDACTED]"),
  isDev: false,
  isTest: true,
}));

describe("Logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("createLogger", () => {
    it("creates a logger with module prefix", () => {
      const moduleLogger = createLogger("test-module");
      expect(moduleLogger).toBeDefined();
      expect(typeof moduleLogger.debug).toBe("function");
      expect(typeof moduleLogger.info).toBe("function");
      expect(typeof moduleLogger.warn).toBe("function");
      expect(typeof moduleLogger.error).toBe("function");
    });

    it("logs debug messages with module prefix", () => {
      const moduleLogger = createLogger("api");
      moduleLogger.debug("test message");
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toContain("[api]");
      expect(call).toContain("[DEBUG]");
      expect(call).toContain("test message");
    });

    it("logs info messages with module prefix", () => {
      const moduleLogger = createLogger("auth");
      moduleLogger.info("user logged in");
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toContain("[auth]");
      expect(call).toContain("[INFO]");
    });

    it("logs warn messages with module prefix", () => {
      const moduleLogger = createLogger("db");
      moduleLogger.warn("connection slow");
      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0][0];
      expect(call).toContain("[db]");
      expect(call).toContain("[WARN]");
    });

    it("logs error messages with module prefix", () => {
      const moduleLogger = createLogger("storage");
      moduleLogger.error("upload failed");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs error with Error object", () => {
      const moduleLogger = createLogger("http");
      const error = new Error("Network timeout");
      moduleLogger.error("request failed", error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs error with additional data", () => {
      const moduleLogger = createLogger("worker");
      moduleLogger.error("job failed", undefined, { jobId: "123" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("includes data in log output when provided", () => {
      const moduleLogger = createLogger("queue");
      moduleLogger.info("job started", { jobId: "abc123", priority: 1 });
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toContain("jobId");
      expect(call).toContain("abc123");
    });
  });

  describe("default logger", () => {
    it("logs debug messages", () => {
      logger.debug("debug message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("logs info messages", () => {
      logger.info("info message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("logs warn messages", () => {
      logger.warn("warn message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("logs error messages", () => {
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs error with Error object", () => {
      const error = new Error("Something went wrong");
      logger.error("operation failed", error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs error with data", () => {
      logger.error("operation failed", undefined, { userId: "user1" });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("scrubSecrets export", () => {
    it("exports scrubSecrets function", () => {
      expect(typeof scrubSecrets).toBe("function");
    });
  });
});
