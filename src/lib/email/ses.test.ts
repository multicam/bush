/**
 * Tests for AWS SES Email Provider
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SesEmailProvider, createSesProvider } from "./ses";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("SesEmailProvider", () => {
  const testConfig = {
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    region: "us-east-1",
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
    it("throws error if access key is missing", () => {
      expect(() => new SesEmailProvider({
        accessKeyId: "",
        secretAccessKey: "test-secret",
        region: "us-east-1",
        from: "test@example.com",
      })).toThrow("AWS_SES_ACCESS_KEY and AWS_SES_SECRET_KEY are required for SES email provider");
    });

    it("throws error if secret key is missing", () => {
      expect(() => new SesEmailProvider({
        accessKeyId: "test-access",
        secretAccessKey: "",
        region: "us-east-1",
        from: "test@example.com",
      })).toThrow("AWS_SES_ACCESS_KEY and AWS_SES_SECRET_KEY are required for SES email provider");
    });

    it("creates instance with valid config", () => {
      const provider = new SesEmailProvider(testConfig);
      expect(provider.name).toBe("ses");
    });
  });

  describe("send", () => {
    it("sends a basic email", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <SendEmailResponse>
            <MessageId>ses-message-id-123</MessageId>
          </SendEmailResponse>
        `,
      });

      const provider = new SesEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("ses-message-id-123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://email.us-east-1.amazonaws.com/",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      // URLSearchParams encodes @ as %40 and spaces as + (both are valid)
      expect(body).toContain("Destination.ToAddresses.member.1=recipient%40example.com");
      expect(body).toContain("Message.Subject.Data=Test+Subject");
    });

    it("sends email with CC and BCC", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <SendEmailResponse>
            <MessageId>ses-message-id-123</MessageId>
          </SendEmailResponse>
        `,
      });

      const provider = new SesEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "recipient@example.com" },
        cc: { email: "cc@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain("CcAddresses");
      expect(body).toContain("BccAddresses");
    });

    it("handles API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => `
          <ErrorResponse>
            <Error>
              <Message>Invalid address</Message>
            </Error>
          </ErrorResponse>
        `,
      });

      const provider = new SesEmailProvider(testConfig);
      const result = await provider.send({
        to: { email: "invalid" },
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid address");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const provider = new SesEmailProvider(testConfig);
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
        text: async () => `
          <SendEmailResponse>
            <MessageId>ses-template-id-456</MessageId>
          </SendEmailResponse>
        `,
      });

      const provider = new SesEmailProvider(testConfig);
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
      expect(result.messageId).toBe("ses-template-id-456");

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain("Welcome");
    });
  });

  describe("createSesProvider", () => {
    it("creates provider instance", () => {
      const provider = createSesProvider(testConfig);
      expect(provider).toBeInstanceOf(SesEmailProvider);
    });
  });
});
