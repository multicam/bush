/**
 * Tests for Resend Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResendEmailProvider, createResendProvider } from "./resend";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("ResendEmailProvider", () => {
  const testConfig = {
    apiKey: "test-resend-api-key",
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
    it("throws error if API key is missing", () => {
      expect(() => new ResendEmailProvider({ apiKey: "", from: "test@example.com" }))
        .toThrow("RESEND_API_KEY is required for Resend email provider");
    });

    it("creates instance with valid config", () => {
      const provider = new ResendEmailProvider(testConfig);
      expect(provider.name).toBe("resend");
    });
  });

  describe("send", () => {
    it("sends a basic email", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-message-id-123",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("resend-message-id-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-resend-api-key",
            "Content-Type": "application/json",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.to).toEqual(["recipient@example.com"]);
      expect(body.subject).toBe("Test Subject");
      expect(body.html).toBe("<p>Test body</p>");
      expect(body.text).toBe("Test body");
    });

    it("sends email with CC and BCC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-message-id-123",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
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
      expect(body.cc).toEqual(["cc@example.com"]);
      expect(body.bcc).toEqual(["bcc@example.com"]);
    });

    it("handles API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          name: "validation_error",
          message: "Invalid 'to' field",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "invalid-email" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid 'to' field");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new ResendEmailProvider(testConfig);
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
        ok: true,
        json: async () => ({
          id: "resend-template-id-456",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
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
      expect(result.messageId).toBe("resend-template-id-456");

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.subject).toContain("Welcome");
      expect(body.html).toContain("John");
    });
  });

  describe("createResendProvider", () => {
    it("creates provider instance", () => {
      const provider = createResendProvider(testConfig);
      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  describe("send - additional coverage", () => {
    it("sends email to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-multi-id",
          from: "test@example.com",
          to: ["user1@example.com", "user2@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        subject: "Multi-recipient",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.to).toEqual(["user1@example.com", "user2@example.com"]);
    });

    it("sends email with reply-to", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-reply-to",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        replyTo: { email: "reply@example.com" },
        subject: "Reply Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.reply_to).toBe("reply@example.com");
    });

    it("sends email with attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-attachment",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Attachment Test",
        html: "<p>Test</p>",
        attachments: [
          {
            filename: "test.txt",
            content: "Hello World",
            contentType: "text/plain",
          },
        ],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe("test.txt");
    });

    it("sends email with Buffer attachment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-buffer",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Buffer Attachment",
        html: "<p>Test</p>",
        attachments: [
          {
            filename: "binary.bin",
            content: Buffer.from("binary data"),
            contentType: "application/octet-stream",
          },
        ],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.attachments[0].content).toBe(Buffer.from("binary data").toString("base64"));
    });

    it("sends email with custom headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-headers",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Headers Test",
        html: "<p>Test</p>",
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.headers).toEqual({ "X-Custom-Header": "custom-value" });
    });

    it("sends email with custom from address", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-custom-from",
          from: "custom@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        from: { email: "custom@example.com", name: "Custom Sender" },
        to: { email: "recipient@example.com" },
        subject: "Custom From",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.from).toBe("Custom Sender <custom@example.com>");
    });

    it("handles CC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-cc-array",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
        subject: "CC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
    });

    it("handles BCC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-bcc-array",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
        subject: "BCC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
    });

    it("handles API error without message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ name: "error" }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Error Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Resend API error");
    });

    it("handles non-Error exceptions", async () => {
      mockFetch.mockImplementation(() => {
        throw "string error";
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Exception Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Resend error");
    });
  });

  describe("sendTemplate - additional coverage", () => {
    it("sends template to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-template-multi",
          from: "test@example.com",
          to: ["user1@example.com", "user2@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.to).toEqual(["user1@example.com", "user2@example.com"]);
    });

    it("sends template with CC and BCC arrays", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-template-cc-bcc",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
        bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.cc).toEqual(["cc1@example.com", "cc2@example.com"]);
      expect(body.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
    });

    it("sends template with reply-to", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-template-reply",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        replyTo: { email: "reply@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.reply_to).toBe("reply@example.com");
    });

    it("sends template with attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-template-attach",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
        attachments: [{ filename: "doc.pdf", content: "base64content", contentType: "application/pdf" }],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.attachments).toHaveLength(1);
    });

    it("sends template with headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resend-template-headers",
          from: "test@example.com",
          to: ["recipient@example.com"],
          created_at: "2024-01-01T00:00:00Z",
        }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
        headers: { "X-Template": "welcome" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.headers).toEqual({ "X-Template": "welcome" });
    });

    it("handles template API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ name: "error", message: "Template failed" }),
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Template failed");
    });

    it("handles template exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Template network error"));

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Template network error");
    });

    it("handles template non-Error exception", async () => {
      mockFetch.mockImplementation(() => {
        throw { custom: "error" };
      });

      const provider = new ResendEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Resend error");
    });
  });
});
