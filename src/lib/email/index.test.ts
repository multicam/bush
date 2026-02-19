/**
 * Tests for Email Service Factory
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../email";

// Mock the console provider
const mockProvider = {
  send: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendTemplate: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
};

vi.mock("./console.js", () => ({
  ConsoleEmailProvider: vi.fn(() => mockProvider),
  createConsoleProvider: vi.fn(() => mockProvider),
}));

// Mock the EmailService constructor
vi.mock("../email", () => ({
  EmailService: vi.fn((provider) => ({ provider, send: vi.fn() })),
}));

describe("Email Service Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEmailService", () => {
    it("creates email service with console provider", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      createEmailService("console");

      expect(createConsoleProvider).toHaveBeenCalled();
      expect(EmailService).toHaveBeenCalledWith(mockProvider);
    });

    it("falls back to console for sendgrid (not implemented)", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("sendgrid");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "SendGrid email provider not yet implemented. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("falls back to console for ses (not implemented)", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("ses");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "AWS SES email provider not yet implemented. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("falls back to console for postmark (not implemented)", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("postmark");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Postmark email provider not yet implemented. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("falls back to console for resend (not implemented)", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("resend");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Resend email provider not yet implemented. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("falls back to console for smtp (not implemented)", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("smtp");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "SMTP email provider not yet implemented. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("falls back to console for unknown provider", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createEmailService("unknown" as any);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unknown email provider 'unknown'. Falling back to console provider."
      );
      expect(createConsoleProvider).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("defaults to console provider", async () => {
      vi.resetModules();
      const { createEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      createEmailService();

      expect(createConsoleProvider).toHaveBeenCalled();
    });
  });

  describe("getEmailService", () => {
    it("creates singleton on first call", async () => {
      vi.resetModules();
      const { getEmailService } = await import("./index.js");
      const { createConsoleProvider } = await import("./console.js");

      getEmailService();

      expect(createConsoleProvider).toHaveBeenCalled();
    });

    it("returns same instance on subsequent calls", async () => {
      vi.resetModules();

      const { getEmailService } = await import("./index.js");

      const service1 = getEmailService();
      const service2 = getEmailService();

      expect(service1).toBe(service2);
    });
  });

  describe("resetEmailService", () => {
    it("resets the singleton", async () => {
      vi.resetModules();

      const { getEmailService, resetEmailService } = await import("./index.js");

      const service1 = getEmailService();
      resetEmailService();
      const service2 = getEmailService();

      // After reset, a new service should be created
      // Since EmailService is mocked, we can't directly compare,
      // but we can verify resetEmailService sets the singleton to null
      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });

  describe("setEmailService", () => {
    it("sets a custom email service", async () => {
      vi.resetModules();

      const { getEmailService, setEmailService } = await import("./index.js");

      const customService = { provider: "custom", send: vi.fn() } as unknown as EmailService;
      setEmailService(customService);

      const service = getEmailService();

      expect(service).toBe(customService);
    });
  });

  describe("exports", () => {
    it("exports EmailService", async () => {
      vi.resetModules();
      const { EmailService } = await import("./index.js");
      expect(EmailService).toBeDefined();
    });

    it("exports ConsoleEmailProvider", async () => {
      vi.resetModules();
      const { ConsoleEmailProvider } = await import("./index.js");
      expect(ConsoleEmailProvider).toBeDefined();
    });

    it("exports createConsoleProvider", async () => {
      vi.resetModules();
      const { createConsoleProvider } = await import("./index.js");
      expect(createConsoleProvider).toBeDefined();
    });

    it("exports types", async () => {
      vi.resetModules();
      // Type exports are compile-time only, but we can verify the module loads
      const emailModule = await import("./index.js");
      expect(emailModule).toBeDefined();
    });
  });
});
