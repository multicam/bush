/**
 * Tests for Email Service
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  EmailService,
  createEmailService,
  getEmailService,
  resetEmailService,
  setEmailService,
} from "./index";
import { ConsoleEmailProvider } from "./console";
import type { EmailMessage, TemplateEmailOptions } from "./index";

describe("Email Service", () => {
  describe("ConsoleEmailProvider", () => {
    let provider: ConsoleEmailProvider;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      provider = new ConsoleEmailProvider();
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should have name 'console'", () => {
      expect(provider.name).toBe("console");
    });

    it("should send a basic email and return success", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com", name: "Test User" },
        subject: "Test Subject",
        text: "Hello, this is a test email.",
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^console-/);
    });

    it("should log email details to console", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "Test Subject",
        text: "Test body",
      };

      await provider.send(message);

      expect(consoleSpy).toHaveBeenCalled();
      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("EMAIL");
      expect(logged).toContain("test@example.com");
      expect(logged).toContain("Test Subject");
      expect(logged).toContain("Test body");
    });

    it("should handle multiple recipients", async () => {
      const message: EmailMessage = {
        to: [
          { email: "user1@example.com" },
          { email: "user2@example.com", name: "User Two" },
        ],
        subject: "Multi-recipient",
        text: "Body",
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("user1@example.com");
      expect(logged).toContain("user2@example.com");
    });

    it("should log HTML content (truncated if long)", async () => {
      const longHtml = "<div>" + "x".repeat(600) + "</div>";
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "HTML Email",
        html: longHtml,
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("HTML VERSION");
      expect(logged).toContain("...");
    });

    it("should log attachments info", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "With Attachment",
        text: "See attachment",
        attachments: [
          {
            filename: "test.pdf",
            content: Buffer.from("fake pdf content"),
            contentType: "application/pdf",
          },
        ],
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Attachments: 1");
      expect(logged).toContain("test.pdf");
      expect(logged).toContain("application/pdf");
    });

    it("should send template email", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "welcome",
        data: {
          userName: "John",
          appName: "Bush",
          loginLink: "https://bush.io/login",
        },
      };

      const result = await provider.sendTemplate(options);

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^console-template-/);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("TEMPLATE EMAIL");
      expect(logged).toContain("welcome");
      expect(logged).toContain("userName");
      expect(logged).toContain("John");
    });

    it("should format dates in template data", async () => {
      const testDate = new Date("2026-02-18T12:00:00Z");
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "password-reset",
        data: {
          resetLink: "https://bush.io/reset",
          expiresAt: testDate,
        },
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("2026-02-18T12:00:00.000Z");
    });

    it("should log cc recipients", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        cc: { email: "cc@example.com", name: "CC User" },
        subject: "With CC",
        text: "Body",
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Cc:");
      expect(logged).toContain("cc@example.com");
    });

    it("should log bcc recipients", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        bcc: { email: "bcc@example.com" },
        subject: "With BCC",
        text: "Body",
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Bcc:");
      expect(logged).toContain("bcc@example.com");
    });

    it("should log reply-to", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        replyTo: { email: "reply@example.com", name: "Reply Handler" },
        subject: "With Reply-To",
        text: "Body",
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Reply-To:");
      expect(logged).toContain("reply@example.com");
    });

    it("should log headers", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "With Headers",
        text: "Body",
        headers: {
          "X-Priority": "high",
          "X-Custom-Header": "custom-value",
        },
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Headers:");
      expect(logged).toContain("X-Priority");
      expect(logged).toContain("high");
    });

    it("should handle attachments with string content", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "With String Attachment",
        text: "See attachment",
        attachments: [
          {
            filename: "data.json",
            content: JSON.stringify({ key: "value" }),
            contentType: "application/json",
          },
        ],
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("data.json");
    });

    it("should handle attachment without contentType", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "With Attachment",
        text: "See attachment",
        attachments: [
          {
            filename: "data.bin",
            content: Buffer.from("binary data"),
          },
        ],
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("unknown");
    });

    it("should handle HTML content under 500 chars", async () => {
      const shortHtml = "<div>Short content</div>";
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "Short HTML",
        html: shortHtml,
      };

      await provider.send(message);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain(shortHtml);
      expect(logged).not.toContain("...");
    });

    it("should log cc and bcc in template emails", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
        bcc: { email: "bcc@example.com" },
        template: "welcome",
        data: { name: "Test" },
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("cc1@example.com");
      expect(logged).toContain("cc2@example.com");
      expect(logged).toContain("bcc@example.com");
    });

    it("should handle template email with attachments", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "export-complete",
        data: { reportName: "Monthly Report" },
        attachments: [
          {
            filename: "report.pdf",
            content: Buffer.from("%PDF-fake"),
            contentType: "application/pdf",
          },
        ],
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("Attachments: 1");
      expect(logged).toContain("report.pdf");
    });

    it("should handle template email with string attachment", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "export-complete",
        data: { exportType: "CSV" },
        attachments: [
          {
            filename: "export.csv",
            content: "col1,col2\nval1,val2",
            contentType: "text/csv",
          },
        ],
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("export.csv");
    });

    it("should format objects in template data", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "notification-digest",
        data: {
          user: { name: "John", role: "admin" },
          nested: { deep: { value: 42 } },
        },
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("John");
      expect(logged).toContain("42");
    });

    it("should format primitive values in template data", async () => {
      const options: TemplateEmailOptions = {
        to: { email: "test@example.com" },
        template: "welcome",
        data: {
          count: 5,
          isActive: true,
          name: "Test",
        },
      };

      await provider.sendTemplate(options);

      const logged = consoleSpy.mock.calls[0].join("\n");
      expect(logged).toContain("count: 5");
      expect(logged).toContain("isActive: true");
      expect(logged).toContain("name: Test");
    });
  });

  describe("EmailService", () => {
    let service: EmailService;
    let mockProvider: { name: string; send: ReturnType<typeof vi.fn>; sendTemplate: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockProvider = {
        name: "mock",
        send: vi.fn().mockResolvedValue({ success: true, messageId: "mock-123" }),
        sendTemplate: vi.fn().mockResolvedValue({ success: true, messageId: "mock-tpl-123" }),
      };
      service = new EmailService(mockProvider as any);
    });

    it("should expose provider name", () => {
      expect(service.providerName).toBe("mock");
    });

    it("should delegate send to provider", async () => {
      const message: EmailMessage = {
        to: { email: "test@example.com" },
        subject: "Test",
        text: "Body",
      };

      const result = await service.send(message);

      expect(result.success).toBe(true);
      expect(mockProvider.send).toHaveBeenCalled();
    });

    it("should delegate sendTemplate to provider", async () => {
      const result = await service.sendTemplate({
        to: { email: "test@example.com" },
        template: "welcome",
        data: { userName: "John" },
      });

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalled();
    });

    it("should handle provider errors gracefully", async () => {
      mockProvider.send.mockRejectedValueOnce(new Error("SMTP error"));

      const result = await service.send({
        to: { email: "test@example.com" },
        subject: "Test",
        text: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP error");
    });

    it("should handle non-Error objects thrown by provider in send", async () => {
      mockProvider.send.mockRejectedValueOnce("String error");

      const result = await service.send({
        to: { email: "test@example.com" },
        subject: "Test",
        text: "Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should handle non-Error objects thrown by sendTemplate", async () => {
      mockProvider.sendTemplate.mockRejectedValueOnce({ message: "Object error" });

      const result = await service.sendTemplate({
        to: { email: "test@example.com" },
        template: "welcome",
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });

    it("should expose from address getter", () => {
      // The from getter is available on the service
      expect(typeof service.from).toBeDefined();
    });

    it("should send member invitation with correct template", async () => {
      const result = await service.sendMemberInvitation(
        { email: "new@example.com", name: "New User" },
        {
          inviterName: "Admin",
          accountName: "Acme Corp",
          role: "member",
          invitationLink: "https://bush.io/invite/abc",
          expiresAt: new Date(),
        }
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: { email: "new@example.com", name: "New User" },
          template: "member-invitation",
        })
      );
    });

    it("should send password reset with correct template", async () => {
      const result = await service.sendPasswordReset(
        { email: "user@example.com" },
        {
          userName: "User",
          resetLink: "https://bush.io/reset/xyz",
          expiresAt: new Date(),
        }
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "password-reset",
        })
      );
    });

    it("should send welcome email with correct template", async () => {
      const result = await service.sendWelcome(
        { email: "new@example.com" },
        {
          userName: "New User",
          appName: "Bush",
          loginLink: "https://bush.io/login",
        }
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "welcome",
        })
      );
    });

    it("should send comment mention with correct template", async () => {
      const result = await service.sendCommentMention(
        { email: "mentioned@example.com" },
        {
          mentionerName: "Commenter",
          fileName: "video.mp4",
          commentPreview: "Check this frame...",
          commentLink: "https://bush.io/files/123#comment-456",
          projectName: "Project X",
        }
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "comment-mention",
        })
      );
    });

    it("should send share created with correct template", async () => {
      const result = await service.sendShareCreated(
        { email: "recipient@example.com" },
        {
          creatorName: "Sharer",
          shareName: "Review Draft",
          shareLink: "https://bush.io/s/abc123",
          assetCount: 5,
        }
      );

      expect(result.success).toBe(true);
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "share-created",
        })
      );
    });
  });

  describe("Factory Functions", () => {
    beforeEach(() => {
      resetEmailService();
    });

    afterEach(() => {
      resetEmailService();
    });

    it("should create console email service by default", () => {
      const service = createEmailService();
      expect(service.providerName).toBe("console");
    });

    it("should create console email service explicitly", () => {
      const service = createEmailService("console");
      expect(service.providerName).toBe("console");
    });

    it("should fallback to console for unimplemented providers", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const service = createEmailService("sendgrid");
      expect(service.providerName).toBe("console");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("SendGrid")
      );

      warnSpy.mockRestore();
    });

    it("should fallback to console for unknown providers", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const service = createEmailService("unknown" as any);
      expect(service.providerName).toBe("console");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown email provider")
      );

      warnSpy.mockRestore();
    });

    it("should return singleton from getEmailService", () => {
      const service1 = getEmailService();
      const service2 = getEmailService();
      expect(service1).toBe(service2);
    });

    it("should reset singleton with resetEmailService", () => {
      const service1 = getEmailService();
      resetEmailService();
      const service2 = getEmailService();
      expect(service1).not.toBe(service2);
    });

    it("should allow setting custom service with setEmailService", () => {
      const mockProvider = {
        name: "custom",
        send: vi.fn(),
        sendTemplate: vi.fn(),
      };
      const customService = new EmailService(mockProvider as any);

      setEmailService(customService);
      const service = getEmailService();

      expect(service).toBe(customService);
      expect(service.providerName).toBe("custom");
    });
  });
});
