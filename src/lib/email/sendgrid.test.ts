/**
 * Tests for SendGrid Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendGridEmailProvider, createSendGridProvider } from "./sendgrid";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
});
