/**
 * Bush Platform - Database Module
 *
 * SQLite with Drizzle ORM for type-safe database access.
 */
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { config } from "../config/index.js";
import * as schema from "./schema.js";

// Create SQLite connection
const sqlite = new Database(config.DATABASE_URL);

// Enable WAL mode for better concurrent read/write performance
if (config.DATABASE_WAL_MODE && config.DATABASE_URL !== ":memory:") {
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec(`PRAGMA busy_timeout = ${config.DATABASE_BUSY_TIMEOUT}`);
}

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema for queries
export * from "./schema.js";

// Export the raw SQLite instance for advanced use cases
export { sqlite };

/**
 * Close the database connection (for graceful shutdown)
 */
export function closeDatabase(): void {
  try {
    sqlite.close();
    console.log("[Database] Connection closed");
  } catch (error) {
    console.error("[Database] Error closing connection:", error);
  }
}
