/**
 * Bush Platform - Email Service Factory
 *
 * Creates the appropriate email provider based on configuration.
 * Currently only supports 'console' provider for development.
 *
 * Future providers to be added:
 * - sendgrid: SendGrid API
 * - ses: AWS SES
 * - postmark: Postmark API
 * - resend: Resend API
 * - smtp: Generic SMTP
 */
import { EmailService } from "../email";
import { ConsoleEmailProvider, createConsoleProvider } from "./console";

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
 * For MVP, only 'console' provider is supported.
 * Real providers will be added when needed.
 */
export function createEmailService(
  providerType: EmailProviderType = "console"
): EmailService {
  let provider;

  switch (providerType) {
    case "console":
      provider = createConsoleProvider();
      break;

    case "sendgrid":
      // TODO: Implement SendGrid provider
      console.warn(
        "SendGrid email provider not yet implemented. Falling back to console provider."
      );
      provider = createConsoleProvider();
      break;

    case "ses":
      // TODO: Implement AWS SES provider
      console.warn(
        "AWS SES email provider not yet implemented. Falling back to console provider."
      );
      provider = createConsoleProvider();
      break;

    case "postmark":
      // TODO: Implement Postmark provider
      console.warn(
        "Postmark email provider not yet implemented. Falling back to console provider."
      );
      provider = createConsoleProvider();
      break;

    case "resend":
      // TODO: Implement Resend provider
      console.warn(
        "Resend email provider not yet implemented. Falling back to console provider."
      );
      provider = createConsoleProvider();
      break;

    case "smtp":
      // TODO: Implement generic SMTP provider
      console.warn(
        "SMTP email provider not yet implemented. Falling back to console provider."
      );
      provider = createConsoleProvider();
      break;

    default:
      console.warn(
        `Unknown email provider '${providerType}'. Falling back to console provider.`
      );
      provider = createConsoleProvider();
  }

  return new EmailService(provider);
}

/**
 * Default email service instance
 *
 * Uses the console provider by default.
 * In production, configure via environment variable.
 */
let defaultEmailService: EmailService | null = null;

/**
 * Get the default email service instance
 *
 * Creates the service on first access (singleton pattern).
 */
export function getEmailService(): EmailService {
  if (!defaultEmailService) {
    // Default to console provider for now
    // In the future, read from config.EMAIL_PROVIDER
    defaultEmailService = createEmailService("console");
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
