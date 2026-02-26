/**
 * Bush Platform - Email Service Factory
 *
 * Creates the appropriate email provider based on configuration.
 * Supported providers:
 * - console: Logs emails to console (development)
 * - smtp: Generic SMTP (production-ready)
 * - sendgrid: SendGrid API (TODO)
 * - ses: AWS SES (TODO)
 * - postmark: Postmark API (TODO)
 * - resend: Resend API (TODO)
 */
import { config } from "../../config/env";
import { EmailService } from "../email";
import { ConsoleEmailProvider, createConsoleProvider } from "./console";
import { SmtpEmailProvider, createSmtpProvider } from "./smtp";

// Re-export types and classes
export type {
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  EmailTemplateData,
  EmailTemplate,
  TemplateEmailOptions,
  SendResult,
  EmailProvider,
} from "../email";

export { EmailService } from "../email";
export { ConsoleEmailProvider, createConsoleProvider };
export { SmtpEmailProvider, createSmtpProvider };
export type { SmtpConfig } from "./smtp";

/**
 * Supported email provider types
 */
export type EmailProviderType = "console" | "sendgrid" | "ses" | "postmark" | "resend" | "smtp";

/**
 * Email configuration options
 */
export interface EmailConfig {
  provider: EmailProviderType;
  from: string;
  // Provider-specific options would be added here
  // e.g., apiKey for SendGrid, region for SES, etc.
}

/**
 * Create an email service with the configured provider
 *
 * Provider is determined by EMAIL_PROVIDER environment variable.
 * Falls back to console provider if provider is not implemented.
 */
export function createEmailService(
  providerType?: EmailProviderType
): EmailService {
  // Use provided type or read from config
  const provider = providerType || (config.EMAIL_PROVIDER as EmailProviderType);
  let emailProvider;

  switch (provider) {
    case "console":
      emailProvider = createConsoleProvider();
      break;

    case "smtp":
      emailProvider = createSmtpProvider();
      break;

    case "sendgrid":
      // TODO: Implement SendGrid provider
      console.warn(
        "SendGrid email provider not yet implemented. Falling back to SMTP provider."
      );
      emailProvider = createSmtpProvider();
      break;

    case "ses":
      // TODO: Implement AWS SES provider
      console.warn(
        "AWS SES email provider not yet implemented. Falling back to SMTP provider."
      );
      emailProvider = createSmtpProvider();
      break;

    case "postmark":
      // TODO: Implement Postmark provider
      console.warn(
        "Postmark email provider not yet implemented. Falling back to SMTP provider."
      );
      emailProvider = createSmtpProvider();
      break;

    case "resend":
      // TODO: Implement Resend provider
      console.warn(
        "Resend email provider not yet implemented. Falling back to SMTP provider."
      );
      emailProvider = createSmtpProvider();
      break;

    default:
      console.warn(
        `Unknown email provider '${provider}'. Falling back to SMTP provider.`
      );
      emailProvider = createSmtpProvider();
  }

  return new EmailService(emailProvider);
}

/**
 * Default email service instance
 *
 * Created on first access (singleton pattern).
 * Uses EMAIL_PROVIDER from environment configuration.
 */
let defaultEmailService: EmailService | null = null;

/**
 * Get the default email service instance
 *
 * Creates the service on first access (singleton pattern).
 */
export function getEmailService(): EmailService {
  if (!defaultEmailService) {
    defaultEmailService = createEmailService();
  }
  return defaultEmailService;
}

/**
 * Reset the email service (useful for testing)
 */
export function resetEmailService(): void {
  defaultEmailService = null;
}

/**
 * Set a custom email service instance (useful for testing)
 */
export function setEmailService(service: EmailService): void {
  defaultEmailService = service;
}
