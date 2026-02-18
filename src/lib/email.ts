/**
 * Bush Platform - Email Service Interface
 *
 * Provider-agnostic email interface allowing easy swapping of providers
 * (SendGrid, SES, Postmark, Resend) without code changes beyond the adapter.
 *
 * For MVP: Uses console/hollow implementation. Provider to be added later.
 */
import { config } from "../config/env";

/**
 * Email address representation
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  contentId?: string; // For inline images
}

/**
 * Email template data - typed per template
 */
export interface EmailTemplateData {
  [key: string]: unknown;
}

/**
 * Supported email templates
 */
export type EmailTemplate =
  | "member-invitation"
  | "password-reset"
  | "email-verification"
  | "notification-digest"
  | "share-created"
  | "comment-mention"
  | "comment-reply"
  | "file-processed"
  | "export-complete"
  | "welcome";

/**
 * Email message structure
 */
export interface EmailMessage {
  from?: EmailAddress;
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

/**
 * Template-based email options
 */
export interface TemplateEmailOptions {
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  replyTo?: EmailAddress;
  template: EmailTemplate;
  data: EmailTemplateData;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

/**
 * Result of sending an email
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email provider interface
 *
 * All email providers must implement this interface.
 * The factory in index.ts creates the appropriate provider based on config.
 */
export interface EmailProvider {
  /**
   * Send a raw email message
   */
  send(message: EmailMessage): Promise<SendResult>;

  /**
   * Send a template-based email
   *
   * Template rendering is provider-specific. For the console provider,
   * templates are logged with their data. Real providers will use
   * provider-specific template IDs or render HTML/text locally.
   */
  sendTemplate(options: TemplateEmailOptions): Promise<SendResult>;

  /**
   * Provider name for logging
   */
  readonly name: string;
}

/**
 * Base email service class
 *
 * Provides common functionality and delegates to provider.
 */
export class EmailService {
  private provider: EmailProvider;
  private fromAddress: EmailAddress;

  constructor(provider: EmailProvider) {
    this.provider = provider;
    this.fromAddress = {
      email: config.SMTP_FROM,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  /**
   * Get the configured from address
   */
  get from(): EmailAddress {
    return this.fromAddress;
  }

  /**
   * Get the provider name
   */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Send a raw email message
   */
  async send(message: EmailMessage): Promise<SendResult> {
    const enrichedMessage: EmailMessage = {
      ...message,
      from: this.fromAddress,
    };

    try {
      return await this.provider.send(enrichedMessage);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a template-based email
   *
   * @param options - Template email options
   * @returns Send result with success status
   */
  async sendTemplate(options: TemplateEmailOptions): Promise<SendResult> {
    const enrichedOptions: TemplateEmailOptions = {
      ...options,
    };

    try {
      return await this.provider.sendTemplate(enrichedOptions);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send a member invitation email
   */
  async sendMemberInvitation(
    to: EmailAddress,
    data: {
      inviterName: string;
      accountName: string;
      role: string;
      invitationLink: string;
      expiresAt: Date;
    }
  ): Promise<SendResult> {
    return this.sendTemplate({
      to,
      template: "member-invitation",
      data,
    });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordReset(
    to: EmailAddress,
    data: {
      userName: string;
      resetLink: string;
      expiresAt: Date;
    }
  ): Promise<SendResult> {
    return this.sendTemplate({
      to,
      template: "password-reset",
      data,
    });
  }

  /**
   * Send a welcome email
   */
  async sendWelcome(
    to: EmailAddress,
    data: {
      userName: string;
      appName: string;
      loginLink: string;
    }
  ): Promise<SendResult> {
    return this.sendTemplate({
      to,
      template: "welcome",
      data,
    });
  }

  /**
   * Send a comment mention notification
   */
  async sendCommentMention(
    to: EmailAddress,
    data: {
      mentionerName: string;
      fileName: string;
      commentPreview: string;
      commentLink: string;
      projectName: string;
    }
  ): Promise<SendResult> {
    return this.sendTemplate({
      to,
      template: "comment-mention",
      data,
    });
  }

  /**
   * Send a share created notification
   */
  async sendShareCreated(
    to: EmailAddress,
    data: {
      creatorName: string;
      shareName: string;
      shareLink: string;
      assetCount: number;
      expiresAt?: Date;
    }
  ): Promise<SendResult> {
    return this.sendTemplate({
      to,
      template: "share-created",
      data,
    });
  }
}
