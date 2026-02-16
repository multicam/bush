/**
 * Bush Platform - Database Module
 *
 * SQLite with Drizzle ORM for type-safe database access.
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { config } from "../config/index.js";
import * as schema from "./schema.js";

// Create SQLite connection
const sqlite = new Database(config.DATABASE_URL);

// Enable WAL mode for better concurrent read/write performance
if (config.DATABASE_WAL_MODE && config.DATABASE_URL !== ":memory:") {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma(`busy_timeout = ${config.DATABASE_BUSY_TIMEOUT}`);
}

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export schema for queries
export * from "./schema.js";

// Export the raw SQLite instance for advanced use cases
export { sqlite };
