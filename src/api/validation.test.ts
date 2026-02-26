/**
 * Tests for Zod validation utilities
 */
import { describe, it, expect } from "bun:test";
import {
  createCommentSchema,
  updateCommentSchema,
  createShareSchema,
  updateShareSchema,
  createWebhookSchema,
  updateWebhookSchema,
  normalizeWebhookEvents,
  shareInviteSchema,
  webhookEventTypes,
} from "./validation.js";

describe("Comment Schemas", () => {
  describe("createCommentSchema", () => {
    it("validates a valid comment", () => {
      const result = createCommentSchema.safeParse({
        text: "This is a comment",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty text", () => {
      const result = createCommentSchema.safeParse({
        text: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects text over 10000 characters", () => {
      const result = createCommentSchema.safeParse({
        text: "a".repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional fields", () => {
      const result = createCommentSchema.safeParse({
        text: "Comment",
        timestamp: 10.5,
        duration: 5.0,
        page: 1,
        is_internal: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative timestamp", () => {
      const result = createCommentSchema.safeParse({
        text: "Comment",
        timestamp: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-positive page", () => {
      const result = createCommentSchema.safeParse({
        text: "Comment",
        page: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateCommentSchema", () => {
    it("allows partial updates", () => {
      const result = updateCommentSchema.safeParse({
        text: "Updated text",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      const result = updateCommentSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("Share Schemas", () => {
  describe("createShareSchema", () => {
    it("requires project_id", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid share", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
        project_id: "proj_123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all optional fields", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
        project_id: "proj_123",
        layout: "grid",
        allow_comments: true,
        allow_downloads: false,
        show_all_versions: true,
        show_transcriptions: false,
        passphrase: "secret123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid layout", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
        project_id: "proj_123",
        layout: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short passphrase", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
        project_id: "proj_123",
        passphrase: "abc",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("shareInviteSchema", () => {
    it("validates email addresses", () => {
      const result = shareInviteSchema.safeParse({
        recipients: ["test@example.com", "user@example.org"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = shareInviteSchema.safeParse({
        recipients: ["not-an-email"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 50 recipients", () => {
      const recipients = Array(51).fill("test@example.com");
      const result = shareInviteSchema.safeParse({
        recipients,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Webhook Schemas", () => {
  describe("createWebhookSchema", () => {
    it("validates a valid webhook with string events", () => {
      const result = createWebhookSchema.safeParse({
        name: "My Webhook",
        url: "https://example.com/webhook",
        events: ["file.created", "file.updated"],
      });
      expect(result.success).toBe(true);
    });

    it("validates a valid webhook with object events", () => {
      const result = createWebhookSchema.safeParse({
        name: "My Webhook",
        url: "https://example.com/webhook",
        events: [
          { type: "file.created", filters: { projectId: "proj_123" } },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid event type", () => {
      const result = createWebhookSchema.safeParse({
        name: "My Webhook",
        url: "https://example.com/webhook",
        events: ["invalid.event"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty events array", () => {
      const result = createWebhookSchema.safeParse({
        name: "My Webhook",
        url: "https://example.com/webhook",
        events: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("normalizeWebhookEvents", () => {
    it("converts string events to objects", () => {
      const result = normalizeWebhookEvents(["file.created", "file.updated"]);
      expect(result).toEqual([
        { type: "file.created" },
        { type: "file.updated" },
      ]);
    });

    it("preserves object events with filters", () => {
      const result = normalizeWebhookEvents([
        { type: "file.created", filters: { projectId: "proj_123" } },
      ]);
      expect(result).toEqual([
        { type: "file.created", filters: { projectId: "proj_123" } },
      ]);
    });

    it("handles mixed events", () => {
      const result = normalizeWebhookEvents([
        "file.created",
        { type: "file.updated", filters: { workspaceId: "ws_123" } },
      ]);
      expect(result).toEqual([
        { type: "file.created" },
        { type: "file.updated", filters: { workspaceId: "ws_123" } },
      ]);
    });
  });

  describe("webhookEventTypes", () => {
    it("contains all expected event types", () => {
      expect(webhookEventTypes).toContain("file.created");
      expect(webhookEventTypes).toContain("comment.created");
      expect(webhookEventTypes).toContain("transcription.completed");
    });
  });
});
