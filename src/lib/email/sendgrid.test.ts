/**
 * Tests for SendGrid Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendGridEmailProvider, createSendGridProvider } from "./sendgrid";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("SendGridEmailProvider", () => {
  const testConfig = {
    apiKey: "test-sendgrid-api-key",
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
      expect(() => new SendGridEmailProvider({ apiKey: "", from: "test@example.com" }))
        .toThrow("SENDGRID_API_KEY is required for SendGrid email provider");
    });

    it("creates instance with valid config", () => {
      const provider = new SendGridEmailProvider(testConfig);
      expect(provider.name).toBe("sendgrid");
    });
  });

  describe("send", () => {
    it("sends a basic email", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => name === "X-Message-Id" ? "sendgrid-message-id-123" : null,
        },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com", name: "Recipient" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("sendgrid-message-id-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.sendgrid.com/v3/mail/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-sendgrid-api-key",
            "Content-Type": "application/json",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.personalizations[0].to).toEqual([{ email: "recipient@example.com", name: "Recipient" }]);
      expect(body.subject).toBe("Test Subject");
    });

    it("sends email with CC and BCC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
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
      expect(body.personalizations[0].cc).toEqual([{ email: "cc@example.com" }]);
      expect(body.personalizations[0].bcc).toEqual([{ email: "bcc@example.com" }]);
    });

    it("handles API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ message: "The to field is required." }],
        }),
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("The to field is required.");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new SendGridEmailProvider(testConfig);
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
        headers: {
          get: (name: string) => name === "X-Message-Id" ? "sendgrid-template-id-456" : null,
        },
      });

      const provider = new SendGridEmailProvider(testConfig);
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
      expect(result.messageId).toBe("sendgrid-template-id-456");

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.subject).toContain("Welcome");
      expect(body.content).toBeDefined();
    });
  });

  describe("createSendGridProvider", () => {
    it("creates provider instance", () => {
      const provider = createSendGridProvider(testConfig);
      expect(provider).toBeInstanceOf(SendGridEmailProvider);
    });
  });

  describe("send - additional coverage", () => {
    it("sends email to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        subject: "Multi",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.personalizations[0].to).toHaveLength(2);
    });

    it("sends email with reply-to", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        replyTo: { email: "reply@example.com", name: "Reply" },
        subject: "Reply Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.reply_to).toEqual({ email: "reply@example.com", name: "Reply" });
    });

    it("sends email with string attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
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
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe("test.txt");
    });

    it("sends email with Buffer attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
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
      expect(body.attachments[0].content).toBe(Buffer.from("binary data").toString("base64"));
    });

    it("sends email with inline attachments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Inline",
        html: "<p>Test</p>",
        attachments: [{
          filename: "image.png",
          content: Buffer.from("image data"),
          contentType: "image/png",
          contentId: "inline-image",
        }],
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.attachments[0].disposition).toBe("inline");
    });

    it("sends email with custom headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Headers",
        html: "<p>Test</p>",
        headers: { "X-Custom": "value" },
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.headers).toEqual({ "X-Custom": "value" });
    });

    it("sends email with custom from address", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        from: { email: "custom@example.com", name: "Custom" },
        to: { email: "recipient@example.com" },
        subject: "Custom From",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.from).toEqual({ email: "custom@example.com", name: "Custom" });
    });

    it("handles CC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
        subject: "CC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.personalizations[0].cc).toHaveLength(2);
    });

    it("handles BCC as array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        bcc: [{ email: "bcc1@example.com" }, { email: "bcc2@example.com" }],
        subject: "BCC Array",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.personalizations[0].bcc).toHaveLength(2);
    });

    it("handles API error with unparseable JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Error",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("SendGrid API error");
    });

    it("handles non-Error exceptions", async () => {
      mockFetch.mockImplementation(() => {
        throw "string error";
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Exception",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown SendGrid error");
    });
  });

  describe("sendTemplate - additional coverage", () => {
    it("sends template to multiple recipients", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "template-id" },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(true);
    });

    it("handles template API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ message: "Template failed" }],
        }),
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Template failed");
    });

    it("handles template API error with unparseable JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("SendGrid API error");
    });

    it("handles template exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Template fail"));

      const provider = new SendGridEmailProvider(testConfig);
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

      const provider = new SendGridEmailProvider(testConfig);
      const result = await provider.sendTemplate({
        to: { email: "recipient@example.com" },
        template: "welcome",
        data: { userName: "John", appName: "Bush", loginLink: "https://example.com" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown SendGrid error");
    });
  });
});
