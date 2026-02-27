/**
 * Bush Platform - Postmark Email Provider
 *
 * Sends emails via Postmark API (https://postmarkapp.com).
 * Known for strong deliverability.
 *
 * Configuration via environment:
 * - POSTMARK_SERVER_TOKEN: Postmark server token
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

const POSTMARK_API_URL = "https://api.postmarkapp.com/email";

/**
 * Format an email address for Postmark API
 */
function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Convert our attachment format to Postmark format
 */
function convertAttachments(attachments?: EmailAttachment[]): Array<{
  Name: string;
  Content: string;
  ContentType?: string;
  ContentId?: string;
}> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((att) => ({
    Name: att.filename,
    Content:
      typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : att.content.toString("base64"),
    ContentType: att.contentType,
    ContentId: att.contentId,
  }));
}

/**
 * Postmark email provider configuration
 */
export interface PostmarkConfig {
  serverToken: string;
  from: string;
}

/**
 * Get Postmark configuration from environment
 */
export function getPostmarkConfig(): PostmarkConfig {
  return {
    serverToken: config.POSTMARK_SERVER_TOKEN || "",
    from: config.SMTP_FROM,
  };
}

/**
 * Postmark API response
 */
interface PostmarkResponse {
  To: string;
  SubmittedAt: string;
  MessageID: string;
  ErrorCode: number;
  Message: string;
}

/**
 * Postmark email provider
 *
 * Sends emails via Postmark API.
 */
export class PostmarkEmailProvider implements EmailProvider {
  readonly name = "postmark";
  private serverToken: string;
  private fromAddress: EmailAddress;

  constructor(postmarkConfig?: PostmarkConfig) {
    const cfg = postmarkConfig || getPostmarkConfig();

    if (!cfg.serverToken) {
      throw new Error("POSTMARK_SERVER_TOKEN is required for Postmark email provider");
    }

    this.serverToken = cfg.serverToken;
    this.fromAddress = {
      email: cfg.from,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  /**
   * Build Postmark email payload
   */
  private buildPayload(
    message: EmailMessage,
    rendered?: { subject: string; html: string; text: string }
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      From: message.from ? formatAddress(message.from) : formatAddress(this.fromAddress),
      To: Array.isArray(message.to)
        ? message.to.map((a) => formatAddress(a)).join(", ")
        : formatAddress(message.to),
      Subject: rendered?.subject || message.subject,
      HtmlBody: rendered?.html || message.html || "",
      TextBody: rendered?.text || message.text || "",
    };

    if (message.cc) {
      payload.Cc = Array.isArray(message.cc)
        ? message.cc.map((a) => formatAddress(a)).join(", ")
        : formatAddress(message.cc);
    }

    if (message.bcc) {
      payload.Bcc = Array.isArray(message.bcc)
        ? message.bcc.map((a) => formatAddress(a)).join(", ")
        : formatAddress(message.bcc);
    }

    if (message.replyTo) {
      payload.ReplyTo = formatAddress(message.replyTo);
    }

    if (message.attachments && message.attachments.length > 0) {
      payload.Attachments = convertAttachments(message.attachments);
    }

    if (message.headers) {
      payload.Headers = Object.entries(message.headers).map(([Name, Value]) => ({
        Name,
        Value,
      }));
    }

    return payload;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = this.buildPayload(message);

      const response = await fetch(POSTMARK_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.serverToken,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as PostmarkResponse;

      if (result.ErrorCode !== 0) {
        return {
          success: false,
          error: result.Message || `Postmark API error: ${result.ErrorCode}`,
        };
      }

      return {
        success: true,
        messageId: result.MessageID,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Postmark error",
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

      const response = await fetch(POSTMARK_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": this.serverToken,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as PostmarkResponse;

      if (result.ErrorCode !== 0) {
        return {
          success: false,
          error: result.Message || `Postmark API error: ${result.ErrorCode}`,
        };
      }

      return {
        success: true,
        messageId: result.MessageID,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Postmark error",
      };
    }
  }
}

/**
 * Create a Postmark email provider instance
 */
export function createPostmarkProvider(config?: PostmarkConfig): PostmarkEmailProvider {
  return new PostmarkEmailProvider(config);
}
