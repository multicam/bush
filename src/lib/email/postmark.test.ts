/**
 * Tests for Postmark Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostmarkEmailProvider, createPostmarkProvider } from "./postmark";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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

  describe("send - additional coverage", () => {
    it("sends email to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "user1@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-multi",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        subject: "Multi",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.To).toBe("user1@example.com, user2@example.com");
    });

    it("sends email with reply-to", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-reply",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        replyTo: { email: "reply@example.com", name: "Reply" },
        subject: "Reply Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.ReplyTo).toBe("Reply <reply@example.com>");
    });

    it("sends email with string attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-attach",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Attach",
        html: "<p>Test</p>",
        attachments: [{
          filename: "test.txt",
          content: "Hello World",
          contentType: "text/plain",
        }],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Attachments).toHaveLength(1);
      expect(body.Attachments[0].Name).toBe("test.txt");
    });

    it("sends email with Buffer attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-buffer",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Buffer",
        html: "<p>Test</p>",
        attachments: [{
          filename: "binary.bin",
          content: Buffer.from("binary data"),
          contentType: "application/octet-stream",
        }],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Attachments[0].Content).toBe(Buffer.from("binary data").toString("base64"));
    });

    it("handles CC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-cc-arr",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
        subject: "CC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Cc).toBe("cc1@example.com, cc2@example.com");
    });

    it("handles BCC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-bcc-arr",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
        subject: "BCC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.Bcc).toBe("bcc1@example.com, bcc2@example.com");
    });

    it("handles non-Error exceptions", async () => {
      mockFetch.mockImplementation(() => {
        throw "string error";
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Exception",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Postmark error");
    });
  });

  describe("sendTemplate - additional coverage", () => {
    it("sends template to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "user1@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "postmark-tpl-multi",
          ErrorCode: 0,
          Message: "OK",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(true);
    });

    it("handles template error", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          To: "recipient@example.com",
          SubmittedAt: "2024-01-01T00:00:00Z",
          MessageID: "",
          ErrorCode: 400,
          Message: "Template error",
        }),
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Template error");
    });

    it("handles template exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Template fail"));

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Template fail");
    });

    it("handles template non-Error exception", async () => {
      mockFetch.mockImplementation(() => {
        throw { error: "object" };
      });

      const provider = new PostmarkEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Postmark error");
    });
  });
});
