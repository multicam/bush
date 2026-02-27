/**
 * Tests for Email Service Factory
 *
 * Note: These tests verify the factory function without mocking providers.
 * Individual provider tests are in their respective test files.
 */
import { describe, it, expect, beforeEach } from "vitest";
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

describe("Email Service Factory", () => {
  beforeEach(() => {
    resetEmailService();
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
});
