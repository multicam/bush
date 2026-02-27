/**
 * Tests for Email Service Factory
 *
 * Note: These tests verify the factory function without mocking providers.
 * Individual provider tests are in their respective test files.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createEmailService,
  getEmailService,
  resetEmailService,
  setEmailService,
  ConsoleEmailProvider,
  SmtpEmailProvider,
  ResendEmailProvider,
  SendGridEmailProvider,
  SesEmailProvider,
  PostmarkEmailProvider,
  createConsoleProvider,
  createSmtpProvider,
} from "./index";

// Mock config to control provider selection
vi.mock("../../config/env", () => ({
  config: {
    EMAIL_PROVIDER: "console",
    RESEND_API_KEY: "",
    SENDGRID_API_KEY: "",
    AWS_SES_ACCESS_KEY: "",
    AWS_SES_SECRET_KEY: "",
    POSTMARK_SERVER_TOKEN: "",
  },
}));

describe("Email Service Factory", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEmailService();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("exports", () => {
    it("exports ConsoleEmailProvider", () => {
      expect(ConsoleEmailProvider).toBeDefined();
    });

    it("exports SmtpEmailProvider", () => {
      expect(SmtpEmailProvider).toBeDefined();
    });

    it("exports ResendEmailProvider", () => {
      expect(ResendEmailProvider).toBeDefined();
    });

    it("exports SendGridEmailProvider", () => {
      expect(SendGridEmailProvider).toBeDefined();
    });

    it("exports SesEmailProvider", () => {
      expect(SesEmailProvider).toBeDefined();
    });

    it("exports PostmarkEmailProvider", () => {
      expect(PostmarkEmailProvider).toBeDefined();
    });

    it("exports createConsoleProvider", () => {
      expect(createConsoleProvider).toBeDefined();
    });

    it("exports createSmtpProvider", () => {
      expect(createSmtpProvider).toBeDefined();
    });
  });

  describe("createEmailService", () => {
    it("creates email service with console provider", () => {
      const service = createEmailService("console");
      expect(service).toBeDefined();
      expect(service.providerName).toBe("console");
    });

    it("creates email service with smtp provider", () => {
      // SMTP provider requires config, so this should work in test env
      // which has defaults
      const service = createEmailService("smtp");
      expect(service).toBeDefined();
      expect(service.providerName).toBe("smtp");
    });
  });

  describe("getEmailService", () => {
    it("creates singleton on first call", () => {
      const service = getEmailService();
      expect(service).toBeDefined();
    });

    it("returns same instance on subsequent calls", () => {
      const service1 = getEmailService();
      const service2 = getEmailService();
      expect(service1).toBe(service2);
    });
  });

  describe("resetEmailService", () => {
    it("resets the singleton", () => {
      const service1 = getEmailService();
      resetEmailService();
      const service2 = getEmailService();
      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
      expect(service1).not.toBe(service2);
    });
  });

  describe("setEmailService", () => {
    it("sets a custom email service", () => {
      const customService = {
        provider: { name: "custom" },
        providerName: "custom",
        send: async () => ({ success: true }),
        sendTemplate: async () => ({ success: true }),
        from: { email: "test@example.com" },
      } as any;
      setEmailService(customService);
      const service = getEmailService();
      expect(service).toBe(customService);
    });
  });

  describe("createEmailService fallback scenarios", () => {
    it("falls back to SMTP when resend provider selected without API key", () => {
      // Config mock has empty RESEND_API_KEY
      const service = createEmailService("resend");
      expect(service).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "RESEND_API_KEY not configured. Falling back to SMTP provider."
      );
    });

    it("falls back to SMTP when sendgrid provider selected without API key", () => {
      const service = createEmailService("sendgrid");
      expect(service).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "SENDGRID_API_KEY not configured. Falling back to SMTP provider."
      );
    });

    it("falls back to SMTP when ses provider selected without access key", () => {
      const service = createEmailService("ses");
      expect(service).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "AWS_SES_ACCESS_KEY or AWS_SES_SECRET_KEY not configured. Falling back to SMTP provider."
      );
    });

    it("falls back to SMTP when postmark provider selected without token", () => {
      const service = createEmailService("postmark");
      expect(service).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "POSTMARK_SERVER_TOKEN not configured. Falling back to SMTP provider."
      );
    });

    it("falls back to SMTP for unknown provider", () => {
      const service = createEmailService("unknown-provider" as any);
      expect(service).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Unknown email provider 'unknown-provider'. Falling back to SMTP provider."
      );
    });
  });

  describe("provider type exports", () => {
    it("exports EmailProviderType type", () => {
      const providerType: "console" | "smtp" | "resend" | "sendgrid" | "ses" | "postmark" = "console";
      expect(providerType).toBe("console");
    });
  });
});
