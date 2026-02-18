/**
 * Bush Platform - API Routes Index
 *
 * Exports all API route modules.
 */
export { default as authRoutes } from "./auth.js";
export { default as accountRoutes } from "./accounts.js";
export { default as workspaceRoutes } from "./workspaces.js";
export { default as projectRoutes } from "./projects.js";
export { default as fileRoutes } from "./files.js";
export { default as userRoutes } from "./users.js";
export { default as folderRoutes } from "./folders.js";
export { default as bulkRoutes } from "./bulk.js";
export { default as searchRoutes } from "./search.js";
export { default as versionStackRoutes } from "./version-stacks.js";
export { default as commentRoutes } from "./comments.js";
export { default as customFieldRoutes } from "./custom-fields.js";
export { default as metadataRoutes } from "./metadata.js";
export { default as shareRoutes } from "./shares.js";
export { default as notificationRoutes, createNotification, NOTIFICATION_TYPES } from "./notifications.js";
export { default as collectionRoutes } from "./collections.js";
export { default as webhookRoutes, emitWebhookEvent } from "./webhooks.js";
export { default as transcriptionRoutes, captionsApp as captionsRoutes } from "./transcription.js";
export {
  getVersionStackComments,
  createVersionStackComment,
} from "./comments.js";
export { getShareBySlug } from "./shares.js";
