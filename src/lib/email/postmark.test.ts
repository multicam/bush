/**
 * Tests for Postmark Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostmarkEmailProvider, createPostmarkProvider } from "./postmark";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PostmarkEmailProvider", () => {
  const testConfig = {
    serverToken: "test-postmark-token",
    from: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("throws error if server token is missing", () => {
      expect(() => new PostmarkEmailProvider({ serverToken: "", from: "test@example.com" }))
        .toThrow("POSTMARK_SERVER_TOKEN is required for Postmark email provider");
    });

    it("creates instance with valid config", () => {
      const provider = new PostmarkEmailProvider(testConfig);
      expect(provider.name).toBe("postmark");
    });
  });

  describe("send", () => {
    it("sends a basic email", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-message-id-123",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com", name: "Recipient" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("postmark-message-id-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.postmarkapp.com/email",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Postmark-Server-Token": "test-postmark-token",
            "Content-Type": "application/json",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.To).toBe("Recipient <recipient@example.com>");
      expect(body.Subject).toBe("Test Subject");
      expect(body.HtmlBody).toBe("<p>Test body</p>");
      expect(body.TextBody).toBe("Test body");
    });

    it("sends email with CC and BCC", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-message-id-123",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        cc: { email: "cc@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Cc).toBe("cc@example.com");
      expect(body.Bcc).toBe("bcc@example.com");
    });

    it("handles API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "invalid",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "",
          ErrorCode: 300,
          Message: "Invalid 'To' address.",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "invalid" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid 'To' address.");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("sendTemplate", () => {
    it("renders and sends template email", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-template-id-456",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: {
          userName: "John",
          appName: "Bush",
          loginLink: "https://example.com/login",
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("postmark-template-id-456");

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Subject).toContain("Welcome");
      expect(body.HtmlBody).toContain("John");
    });
  });

  describe("createPostmarkProvider", () => {
    it("creates provider instance", () => {
      const provider = createPostmarkProvider(testConfig);
      expect(provider).toBeInstanceOf(PostmarkEmailProvider);
    });
  });
});
