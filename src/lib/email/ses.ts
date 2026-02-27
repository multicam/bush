/**
 * Bush Platform - AWS SES Email Provider
 *
 * Sends emails via AWS Simple Email Service (SES).
 * Good for AWS-heavy deployments.
 *
 * Configuration via environment:
 * - AWS_SES_ACCESS_KEY: AWS access key
 * - AWS_SES_SECRET_KEY: AWS secret key
 * - AWS_SES_REGION: AWS region (default: us-east-1)
 * - SMTP_FROM: From email address
 */
import { config } from "../../config/env";
import type {
  EmailProvider,
  EmailMessage,
  TemplateEmailOptions,
  SendResult,
  EmailAddress,
} from "../email";
import { renderTemplate } from "./smtp";

/**
 * Format an email address for SES
 */
function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * SES email provider configuration
 */
export interface SesConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  from: string;
}

/**
 * Get SES configuration from environment
 */
export function getSesConfig(): SesConfig {
  return {
    accessKeyId: config.AWS_SES_ACCESS_KEY || "",
    secretAccessKey: config.AWS_SES_SECRET_KEY || "",
    region: config.AWS_SES_REGION,
    from: config.SMTP_FROM,
  };
}

/**
 * Create AWS signature for SES API request
 * Implements AWS Signature Version 4
 */
async function signRequest(
  method: string,
  host: string,
  path: string,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ "X-Amz-Date": string; Authorization: string }> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const service = "ses";
  const algorithm = "AWS4-HMAC-SHA256";

  // Create canonical request
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-date";
  const payloadHash = await sha256Hex(body);

  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Calculate signature
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256Hex(kSigning, stringToSign);

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "X-Amz-Date": amzDate,
    Authorization: authorization,
  };
}

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyBuffer = typeof key === "string" ? encoder.encode(key) : key;
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}

async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const signature = await hmacSha256(key, data);
  return Array.from(signature)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SES email provider
 *
 * Sends emails via AWS SES API.
 */
export class SesEmailProvider implements EmailProvider {
  readonly name = "ses";
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;
  private fromAddress: EmailAddress;

  constructor(sesConfig?: SesConfig) {
    const cfg = sesConfig || getSesConfig();

    if (!cfg.accessKeyId || !cfg.secretAccessKey) {
      throw new Error("AWS_SES_ACCESS_KEY and AWS_SES_SECRET_KEY are required for SES email provider");
    }

    this.accessKeyId = cfg.accessKeyId;
    this.secretAccessKey = cfg.secretAccessKey;
    this.region = cfg.region;
    this.fromAddress = {
      email: cfg.from,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  /**
   * Build SES API request body
   */
  private buildRequestBody(
    message: EmailMessage,
    rendered?: { subject: string; html: string; text: string }
  ): URLSearchParams {
    const params = new URLSearchParams();

    const from = message.from ? formatAddress(message.from) : formatAddress(this.fromAddress);
    params.append("Source", from);

    // Add recipients
    const toAddresses = Array.isArray(message.to)
      ? message.to.map((a) => a.email)
      : [message.to.email];
    toAddresses.forEach((addr, i) => {
      params.append(`Destination.ToAddresses.member.${i + 1}`, addr);
    });

    if (message.cc) {
      const ccAddresses = Array.isArray(message.cc)
        ? message.cc.map((a) => a.email)
        : [message.cc.email];
      ccAddresses.forEach((addr, i) => {
        params.append(`Destination.CcAddresses.member.${i + 1}`, addr);
      });
    }

    if (message.bcc) {
      const bccAddresses = Array.isArray(message.bcc)
        ? message.bcc.map((a) => a.email)
        : [message.bcc.email];
      bccAddresses.forEach((addr, i) => {
        params.append(`Destination.BccAddresses.member.${i + 1}`, addr);
      });
    }

    // Subject
    params.append("Message.Subject.Data", rendered?.subject || message.subject);
    params.append("Message.Subject.Charset", "UTF-8");

    // HTML body
    if (rendered?.html || message.html) {
      params.append("Message.Body.Html.Data", rendered?.html || message.html || "");
      params.append("Message.Body.Html.Charset", "UTF-8");
    }

    // Text body
    if (rendered?.text || message.text) {
      params.append("Message.Body.Text.Data", rendered?.text || message.text || "");
      params.append("Message.Body.Text.Charset", "UTF-8");
    }

    // Reply-To
    if (message.replyTo) {
      params.append("ReplyToAddresses.member.1", formatAddress(message.replyTo));
    }

    // Attachments would require SendRawEmail which is more complex
    // For now, we'll log a warning if attachments are provided
    if (message.attachments && message.attachments.length > 0) {
      console.warn("SES provider: Attachments not yet supported. Consider using SendRawEmail API.");
    }

    // Headers (custom headers via X-headers)
    if (message.headers) {
      Object.entries(message.headers).forEach(([key, value], i) => {
        params.append(`Headers.member.${i + 1}.Name`, key);
        params.append(`Headers.member.${i + 1}.Value`, value);
      });
    }

    return params;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const host = `email.${this.region}.amazonaws.com`;
      const path = "/";
      const body = this.buildRequestBody(message).toString();

      const headers = await signRequest(
        "POST",
        host,
        path,
        body,
        this.accessKeyId,
        this.secretAccessKey,
        this.region
      );

      const response = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...headers,
        },
        body,
      });

      const responseText = await response.text();

      if (!response.ok) {
        // Parse SES error response
        const errorMatch = responseText.match(/<Message>([^<]+)<\/Message>/);
        const errorMessage = errorMatch
          ? errorMatch[1]
          : `SES API error: ${response.status}`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Parse message ID from response
      const messageIdMatch = responseText.match(/<MessageId>([^<]+)<\/MessageId>/);
      const messageId = messageIdMatch ? messageIdMatch[1] : undefined;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SES error",
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

      const host = `email.${this.region}.amazonaws.com`;
      const path = "/";
      const body = this.buildRequestBody(message, rendered).toString();

      const headers = await signRequest(
        "POST",
        host,
        path,
        body,
        this.accessKeyId,
        this.secretAccessKey,
        this.region
      );

      const response = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...headers,
        },
        body,
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorMatch = responseText.match(/<Message>([^<]+)<\/Message>/);
        const errorMessage = errorMatch
          ? errorMatch[1]
          : `SES API error: ${response.status}`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      const messageIdMatch = responseText.match(/<MessageId>([^<]+)<\/MessageId>/);
      const messageId = messageIdMatch ? messageIdMatch[1] : undefined;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SES error",
      };
    }
  }
}

/**
 * Create an SES email provider instance
 */
export function createSesProvider(config?: SesConfig): SesEmailProvider {
  return new SesEmailProvider(config);
}
