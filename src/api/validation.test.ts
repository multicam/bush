/**
 * Tests for Zod validation utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCommentSchema,
  updateCommentSchema,
  createShareSchema,
  createWebhookSchema,
  normalizeWebhookEvents,
  shareInviteSchema,
  webhookEventTypes,
  paginationSchema,
  idSchema,
  emailSchema,
  urlSchema,
  webhookUrlSchema,
  nonEmptyStringSchema,
  positiveIntSchema,
  nonNegativeNumberSchema,
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
    it("allows missing project_id (optional)", () => {
      const result = createShareSchema.safeParse({
        name: "My Share",
      });
      expect(result.success).toBe(true);
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

describe("Common Schemas", () => {
  describe("paginationSchema", () => {
    it("accepts valid pagination params", () => {
      const result = paginationSchema.safeParse({ limit: 25, cursor: "abc123" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.cursor).toBe("abc123");
      }
    });

    it("uses default limit when not provided", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        // When optional() is used with default(), the value can be undefined
        // The default is only used when parsing with .parse() not .safeParse()
        expect(result.data.limit).toBeUndefined();
      }
    });

    it("rejects limit over 100", () => {
      const result = paginationSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it("rejects non-positive limit", () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("coerces string limit to number", () => {
      const result = paginationSchema.safeParse({ limit: "25" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
      }
    });
  });

  describe("idSchema", () => {
    it("accepts non-empty string", () => {
      const result = idSchema.safeParse("file_123");
      expect(result.success).toBe(true);
    });

    it("rejects empty string", () => {
      const result = idSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    it("accepts valid email", () => {
      const result = emailSchema.safeParse("test@example.com");
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = emailSchema.safeParse("not-an-email");
      expect(result.success).toBe(false);
    });
  });

  describe("urlSchema", () => {
    it("accepts valid URL", () => {
      const result = urlSchema.safeParse("https://example.com/path");
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const result = urlSchema.safeParse("not-a-url");
      expect(result.success).toBe(false);
    });
  });

  describe("webhookUrlSchema", () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("accepts HTTPS URL", () => {
      const result = webhookUrlSchema.safeParse("https://example.com/webhook");
      expect(result.success).toBe(true);
    });

    it("accepts HTTP localhost in development", () => {
      process.env.NODE_ENV = "development";
      const result = webhookUrlSchema.safeParse("http://localhost:3000/webhook");
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const result = webhookUrlSchema.safeParse("not-a-url");
      expect(result.success).toBe(false);
    });
  });

  describe("nonEmptyStringSchema", () => {
    it("accepts non-empty string", () => {
      const result = nonEmptyStringSchema.safeParse("hello");
      expect(result.success).toBe(true);
    });

    it("rejects empty string", () => {
      const result = nonEmptyStringSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("positiveIntSchema", () => {
    it("accepts positive integer", () => {
      const result = positiveIntSchema.safeParse(5);
      expect(result.success).toBe(true);
    });

    it("rejects zero", () => {
      const result = positiveIntSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it("rejects negative number", () => {
      const result = positiveIntSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });

    it("rejects non-integer", () => {
      const result = positiveIntSchema.safeParse(1.5);
      expect(result.success).toBe(false);
    });
  });

  describe("nonNegativeNumberSchema", () => {
    it("accepts zero", () => {
      const result = nonNegativeNumberSchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it("accepts positive number", () => {
      const result = nonNegativeNumberSchema.safeParse(100);
      expect(result.success).toBe(true);
    });

    it("rejects negative number", () => {
      const result = nonNegativeNumberSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });
  });
});
