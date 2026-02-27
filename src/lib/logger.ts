/**
 * Bush Platform - Structured Logging Utility
 *
 * Production-safe logging with automatic secret scrubbing and log level filtering.
 * This module provides a unified logging interface that:
 * 1. Automatically scrubs secrets from log messages
 * 2. Respects LOG_LEVEL environment variable
 * 3. Outputs structured JSON in production, pretty-printed in development
 * 4. Never includes stack traces in production for security
 *
 * Reference: REVIEW_PLAN.md M12
 */

import { scrubSecrets, config, isDev, isTest } from "../config/index.js";

/**
 * Log levels in order of severity
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log level numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the current log level from config
 */
function getCurrentLogLevel(): LogLevel {
  return config.LOG_LEVEL;
}

/**
 * Check if a log level should be logged based on current config
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[currentLevel];
}

/**
 * Format a log entry with metadata
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Create a formatted log entry
 */
function createLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Scrub any secrets from the message and stringified data
  entry.message = scrubSecrets(message);

  // Scrub secrets from data values
  if (data) {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === "string") {
        entry[key] = scrubSecrets(value);
      } else if (typeof value === "object" && value !== null) {
        try {
          entry[key] = JSON.parse(scrubSecrets(JSON.stringify(value)));
        } catch {
          entry[key] = value;
        }
      }
    }
  }

  return entry;
}

/**
 * Format error for logging (without stack trace in production)
 */
function formatError(error: Error, includeStack: boolean): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
    name: error.name,
    message: scrubSecrets(error.message),
  };

  if (includeStack && error.stack) {
    formatted.stack = scrubSecrets(error.stack);
  }

  return formatted;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

/**
 * Create a logger with an optional module prefix
 */
export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;

  /**
   * Output the log entry
   */
  function output(level: LogLevel, entry: LogEntry): void {
    if (!shouldLog(level)) {
      return;
    }

    // In development/test, use pretty printing
    if (isDev || isTest) {
      const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      const dataStr = Object.keys(entry).some(k => k !== "level" && k !== "message" && k !== "timestamp")
        ? ` ${JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([k]) => k !== "level" && k !== "message" && k !== "timestamp")))}`
        : "";
      consoleMethod(`${entry.timestamp} [${level.toUpperCase()}] ${prefix} ${entry.message}${dataStr}`);
    } else {
      // In production, output structured JSON
      console.log(JSON.stringify(entry));
    }
  }

  return {
    debug(message: string, data?: Record<string, unknown>): void {
      const entry = createLogEntry("debug", `${prefix} ${message}`, data);
      output("debug", entry);
    },

    info(message: string, data?: Record<string, unknown>): void {
      const entry = createLogEntry("info", `${prefix} ${message}`, data);
      output("info", entry);
    },

    warn(message: string, data?: Record<string, unknown>): void {
      const entry = createLogEntry("warn", `${prefix} ${message}`, data);
      output("warn", entry);
    },

    error(message: string, error?: Error, data?: Record<string, unknown>): void {
      const errorData = error ? { error: formatError(error, isDev) } : {};
      const entry = createLogEntry("error", `${prefix} ${message}`, { ...errorData, ...data });
      output("error", entry);
    },
  };
}

/**
 * Default logger instance (no module prefix)
 */
export const logger: Logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog("debug")) return;
    const entry = createLogEntry("debug", message, data);
    if (isDev || isTest) {
      console.log(`${entry.timestamp} [DEBUG] ${entry.message}`);
    } else {
      console.log(JSON.stringify(entry));
    }
  },

  info(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog("info")) return;
    const entry = createLogEntry("info", message, data);
    if (isDev || isTest) {
      console.log(`${entry.timestamp} [INFO] ${entry.message}`);
    } else {
      console.log(JSON.stringify(entry));
    }
  },

  warn(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog("warn")) return;
    const entry = createLogEntry("warn", message, data);
    if (isDev || isTest) {
      console.warn(`${entry.timestamp} [WARN] ${entry.message}`);
    } else {
      console.warn(JSON.stringify(entry));
    }
  },

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;
    const errorData = error ? { error: formatError(error, isDev) } : {};
    const entry = createLogEntry("error", message, { ...errorData, ...data });
    if (isDev || isTest) {
      console.error(`${entry.timestamp} [ERROR] ${entry.message}`, errorData);
    } else {
      console.error(JSON.stringify(entry));
    }
  },
};

// Export convenience functions for structured auth logging (used by middleware)
export { scrubSecrets };
