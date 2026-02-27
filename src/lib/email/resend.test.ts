/**
 * Tests for Resend Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResendEmailProvider, createResendProvider } from "./resend";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
});
