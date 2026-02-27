/**
 * Bush Platform - SendGrid Email Provider
 *
 * Sends emails via SendGrid API (https://sendgrid.com).
 * Established email delivery provider.
 *
 * Configuration via environment:
 * - SENDGRID_API_KEY: SendGrid API key
 * - SMTP_FROM: From email address
 */
import { config } from "../../config/env";
import type {
  EmailProvider,
  EmailMessage,
  TemplateEmailOptions,
  SendResult,
  EmailAddress,
  EmailAttachment,
} from "../email";
import { renderTemplate } from "./smtp";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

/**
 * Format an email address for SendGrid API
 */
function formatAddressForSendGrid(addr: EmailAddress): { email: string; name?: string } {
  return addr.name ? { email: addr.email, name: addr.name } : { email: addr.email };
}

/**
 * Convert multiple email addresses to SendGrid format
 */
function formatAddressesForSendGrid(addrs: EmailAddress | EmailAddress[]): Array<{ email: string; name?: string }> {
  if (Array.isArray(addrs)) {
    return addrs.map(formatAddressForSendGrid);
  }
  return [formatAddressForSendGrid(addrs)];
}

/**
 * Convert our attachment format to SendGrid format
 */
function convertAttachments(attachments?: EmailAttachment[]): Array<{
  filename: string;
  content: string;
  type?: string;
  disposition: string;
}> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((att) => ({
    filename: att.filename,
    content:
      typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : att.content.toString("base64"),
    type: att.contentType,
    disposition: att.contentId ? "inline" : "attachment",
  }));
}

/**
 * SendGrid email provider configuration
 */
export interface SendGridConfig {
  apiKey: string;
  from: string;
}

/**
 * Get SendGrid configuration from environment
 */
export function getSendGridConfig(): SendGridConfig {
  return {
    apiKey: config.SENDGRID_API_KEY || "",
    from: config.SMTP_FROM,
  };
}

/**
 * SendGrid API response
 * SendGrid returns 202 Accepted on success with no body
 * Errors are returned as JSON with error messages
 */
interface SendGridError {
  errors: Array<{
    message: string;
    field?: string;
    help?: string;
  }>;
}

/**
 * SendGrid email provider
 *
 * Sends emails via SendGrid API.
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = "sendgrid";
  private apiKey: string;
  private fromAddress: EmailAddress;

  constructor(sendgridConfig?: SendGridConfig) {
    const cfg = sendgridConfig || getSendGridConfig();

    if (!cfg.apiKey) {
      throw new Error("SENDGRID_API_KEY is required for SendGrid email provider");
    }

    this.apiKey = cfg.apiKey;
    this.fromAddress = {
      email: cfg.from,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  /**
   * Build SendGrid email payload
   */
  private buildPayload(
    message: EmailMessage,
    rendered?: { subject: string; html: string; text: string }
  ): Record<string, unknown> {
    const personalizations: Record<string, unknown> = {
      to: formatAddressesForSendGrid(message.to),
    };

    if (message.cc) {
      personalizations.cc = formatAddressesForSendGrid(message.cc);
    }

    if (message.bcc) {
      personalizations.bcc = formatAddressesForSendGrid(message.bcc);
    }

    const payload: Record<string, unknown> = {
      personalizations: [personalizations],
      from: message.from
        ? formatAddressForSendGrid(message.from)
        : formatAddressForSendGrid(this.fromAddress),
      subject: rendered?.subject || message.subject,
      content: [
        {
          type: "text/plain",
          value: rendered?.text || message.text || "",
        },
        {
          type: "text/html",
          value: rendered?.html || message.html || "",
        },
      ],
    };

    if (message.replyTo) {
      payload.reply_to = formatAddressForSendGrid(message.replyTo);
    }

    if (message.attachments && message.attachments.length > 0) {
      payload.attachments = convertAttachments(message.attachments);
    }

    if (message.headers) {
      payload.headers = message.headers;
    }

    return payload;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = this.buildPayload(message);

      const response = await fetch(SENDGRID_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `SendGrid API error: ${response.status}`;
        try {
          const error = (await response.json()) as SendGridError;
          if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors.map((e) => e.message).join("; ");
          }
        } catch {
          // Ignore JSON parse errors
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      // SendGrid returns a message ID in the X-Message-Id header
      const messageId = response.headers.get("X-Message-Id");

      return {
        success: true,
        messageId: messageId || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SendGrid error",
      };
    }
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<SendResult> {
    try {
      // Render the template to HTML and text
      const rendered = renderTemplate(options.template, options.data);

      const message: EmailMessage = {
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: options.attachments,
        headers: options.headers,
      };

      const payload = this.buildPayload(message, rendered);

      const response = await fetch(SENDGRID_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `SendGrid API error: ${response.status}`;
        try {
          const error = (await response.json()) as SendGridError;
          if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors.map((e) => e.message).join("; ");
          }
        } catch {
          // Ignore JSON parse errors
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      const messageId = response.headers.get("X-Message-Id");

      return {
        success: true,
        messageId: messageId || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SendGrid error",
      };
    }
  }
}

/**
 * Create a SendGrid email provider instance
 */
export function createSendGridProvider(config?: SendGridConfig): SendGridEmailProvider {
  return new SendGridEmailProvider(config);
}
