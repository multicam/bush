/**
 * Bush Platform - Manual Purge Script
 *
 * Manually trigger the purge of expired soft-deleted files.
 * Run with: bun src/scheduled/run-purge.ts
 *
 * This is useful for:
 * - Testing the purge logic
 * - Running immediate cleanup
 * - Running via cron instead of the worker
 */
import { purgeExpiredFiles } from "./processor.js";

console.log("[purge] Starting manual purge of expired files...");

purgeExpiredFiles()
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
