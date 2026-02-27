/**
 * Bush Platform - Resend Email Provider
 *
 * Sends emails via Resend API (https://resend.com).
 * Preferred provider for new deployments.
 *
 * Configuration via environment:
 * - RESEND_API_KEY: Resend API key
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

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Format an email address for Resend API
 */
function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Convert our attachment format to Resend format
 */
function convertAttachments(attachments?: EmailAttachment[]): Array<{
  filename: string;
  content: string;
  content_type?: string;
}> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((att) => ({
    filename: att.filename,
    content:
      typeof att.content === "string"
        ? att.content
        : att.content.toString("base64"),
    content_type: att.contentType,
  }));
}

/**
 * Resend email provider configuration
 */
export interface ResendConfig {
  apiKey: string;
  from: string;
}

/**
 * Get Resend configuration from environment
 */
export function getResendConfig(): ResendConfig {
  return {
    apiKey: config.RESEND_API_KEY || "",
    from: config.SMTP_FROM,
  };
}

/**
 * Resend API response
 */
interface ResendResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

interface ResendError {
  name: string;
  message: string;
  statusCode?: number;
}

/**
 * Resend email provider
 *
 * Sends emails via Resend API.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private apiKey: string;
  private fromAddress: EmailAddress;

  constructor(resendConfig?: ResendConfig) {
    const cfg = resendConfig || getResendConfig();

    if (!cfg.apiKey) {
      throw new Error("RESEND_API_KEY is required for Resend email provider");
    }

    this.apiKey = cfg.apiKey;
    this.fromAddress = {
      email: cfg.from,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload: Record<string, unknown> = {
        from: message.from ? formatAddress(message.from) : formatAddress(this.fromAddress),
        to: Array.isArray(message.to)
          ? message.to.map((a) => a.email)
          : [message.to.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      };

      if (message.cc) {
        payload.cc = Array.isArray(message.cc)
          ? message.cc.map((a) => a.email)
          : [message.cc.email];
      }

      if (message.bcc) {
        payload.bcc = Array.isArray(message.bcc)
          ? message.bcc.map((a) => a.email)
          : [message.bcc.email];
      }

      if (message.replyTo) {
        payload.reply_to = message.replyTo.email;
      }

      if (message.attachments && message.attachments.length > 0) {
        payload.attachments = convertAttachments(message.attachments);
      }

      if (message.headers) {
        payload.headers = message.headers;
      }

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json()) as ResendError;
        return {
          success: false,
          error: error.message || `Resend API error: ${response.status}`,
        };
      }

      const result = (await response.json()) as ResendResponse;

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Resend error",
      };
    }
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<SendResult> {
    try {
      // Render the template to HTML and text
      const rendered = renderTemplate(options.template, options.data);

      const payload: Record<string, unknown> = {
        from: formatAddress(this.fromAddress),
        to: Array.isArray(options.to)
          ? options.to.map((a) => a.email)
          : [options.to.email],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      };

      if (options.cc) {
        payload.cc = Array.isArray(options.cc)
          ? options.cc.map((a) => a.email)
          : [options.cc.email];
      }

      if (options.bcc) {
        payload.bcc = Array.isArray(options.bcc)
          ? options.bcc.map((a) => a.email)
          : [options.bcc.email];
      }

      if (options.replyTo) {
        payload.reply_to = options.replyTo.email;
      }

      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = convertAttachments(options.attachments);
      }

      if (options.headers) {
        payload.headers = options.headers;
      }

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json()) as ResendError;
        return {
          success: false,
          error: error.message || `Resend API error: ${response.status}`,
        };
      }

      const result = (await response.json()) as ResendResponse;

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Resend error",
      };
    }
  }
}

/**
 * Create a Resend email provider instance
 */
export function createResendProvider(config?: ResendConfig): ResendEmailProvider {
  return new ResendEmailProvider(config);
}
