/**
 * Bush Platform - Email Service Factory
 *
 * Creates the appropriate email provider based on configuration.
 * Supported providers:
 * - console: Logs emails to console (development)
 * - smtp: Generic SMTP (production-ready)
 * - sendgrid: SendGrid API
 * - ses: AWS SES API
 * - postmark: Postmark API
 * - resend: Resend API
 */
import { config } from "../../config/env";
import { EmailService } from "../email";
import { ConsoleEmailProvider, createConsoleProvider } from "./console";
import { SmtpEmailProvider, createSmtpProvider } from "./smtp";
import { ResendEmailProvider, createResendProvider } from "./resend";
import { SendGridEmailProvider, createSendGridProvider } from "./sendgrid";
import { SesEmailProvider, createSesProvider } from "./ses";
import { PostmarkEmailProvider, createPostmarkProvider } from "./postmark";

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
export { ResendEmailProvider, createResendProvider };
export type { ResendConfig } from "./resend";
export { SendGridEmailProvider, createSendGridProvider };
export type { SendGridConfig } from "./sendgrid";
export { SesEmailProvider, createSesProvider };
export type { SesConfig } from "./ses";
export { PostmarkEmailProvider, createPostmarkProvider };
export type { PostmarkConfig } from "./postmark";

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
}

/**
 * Create an email service with the configured provider
 *
 * Provider is determined by EMAIL_PROVIDER environment variable.
 * Falls back to SMTP provider if provider is not configured.
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

    case "resend":
      if (!config.RESEND_API_KEY) {
        console.warn(
          "RESEND_API_KEY not configured. Falling back to SMTP provider."
        );
        emailProvider = createSmtpProvider();
      } else {
        emailProvider = createResendProvider();
      }
      break;

    case "sendgrid":
      if (!config.SENDGRID_API_KEY) {
        console.warn(
          "SENDGRID_API_KEY not configured. Falling back to SMTP provider."
        );
        emailProvider = createSmtpProvider();
      } else {
        emailProvider = createSendGridProvider();
      }
      break;

    case "ses":
      if (!config.AWS_SES_ACCESS_KEY || !config.AWS_SES_SECRET_KEY) {
        console.warn(
          "AWS_SES_ACCESS_KEY or AWS_SES_SECRET_KEY not configured. Falling back to SMTP provider."
        );
        emailProvider = createSmtpProvider();
      } else {
        emailProvider = createSesProvider();
      }
      break;

    case "postmark":
      if (!config.POSTMARK_SERVER_TOKEN) {
        console.warn(
          "POSTMARK_SERVER_TOKEN not configured. Falling back to SMTP provider."
        );
        emailProvider = createSmtpProvider();
      } else {
        emailProvider = createPostmarkProvider();
      }
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
