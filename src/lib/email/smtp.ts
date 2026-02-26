/**
 * Bush Platform - SMTP Email Provider
 *
 * Generic SMTP provider that works with any SMTP server.
 * Supports template-based emails with local HTML rendering.
 *
 * Configuration via environment:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP port (default 1025 for Mailpit, 587 for production)
 * - SMTP_USER: SMTP username (optional)
 * - SMTP_PASS: SMTP password (optional)
 * - SMTP_FROM: From email address
 * - SMTP_SECURE: Use TLS (default false for dev)
 */
import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";
import type {
  EmailProvider,
  EmailMessage,
  TemplateEmailOptions,
  SendResult,
  EmailAddress,
  EmailAttachment,
  EmailTemplate,
} from "../email";
import { config } from "../../config/env";

/**
 * Format an email address for nodemailer
 */
function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Format multiple email addresses
 */
function formatAddresses(addrs: EmailAddress | EmailAddress[]): string {
  if (Array.isArray(addrs)) {
    return addrs.map(formatAddress).join(", ");
  }
  return formatAddress(addrs);
}

/**
 * Convert our attachment format to nodemailer format
 */
function convertAttachments(attachments?: EmailAttachment[]): SendMailOptions["attachments"] {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  return attachments.map((att) => ({
    filename: att.filename,
    content: att.content,
    contentType: att.contentType,
    cid: att.contentId,
  }));
}

/**
 * Email template content
 */
interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render an email template with data
 *
 * Simple template rendering using string interpolation.
 * For production, consider using a proper template engine like Handlebars or EJS.
 */
function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): EmailTemplateContent {
  switch (template) {
    case "member-invitation": {
      const d = data as {
        inviterName?: string;
        invitedBy?: string;
        accountName: string;
        role: string;
        invitationLink?: string;
        expiresAt?: Date;
      };
      const inviter = d.inviterName || d.invitedBy || "Someone";
      return {
        subject: `${inviter} invited you to join ${d.accountName} on Bush`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">You're Invited!</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviter}</strong> has invited you to join <strong>${d.accountName}</strong> as a <strong>${d.role}</strong> on Bush.
            </p>
            ${d.invitationLink ? `
            <p style="margin-bottom: 24px;">
              <a href="${d.invitationLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Accept Invitation</a>
            </p>
            ` : ""}
            ${d.expiresAt ? `
            <p style="color: #666; font-size: 14px;">This invitation expires on ${d.expiresAt.toLocaleDateString()}.</p>
            ` : ""}
            <p style="color: #888; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
              Bush - Modern Media Asset Management
            </p>
          </div>
        `,
        text: `You're Invited!\n\n${inviter} has invited you to join ${d.accountName} as a ${d.role} on Bush.\n\n${d.invitationLink ? `Accept invitation: ${d.invitationLink}\n\n` : ""}${d.expiresAt ? `This invitation expires on ${d.expiresAt.toLocaleDateString()}.\n\n` : ""}Bush - Modern Media Asset Management`,
      };
    }

    case "password-reset": {
      const d = data as { userName?: string; resetLink: string; expiresAt?: Date };
      return {
        subject: "Reset Your Bush Password",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Reset Your Password</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.userName ? `Hi ${d.userName},` : "Hello,"}
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              We received a request to reset your password. Click the button below to create a new one.
            </p>
            <p style="margin-bottom: 24px;">
              <a href="${d.resetLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
            </p>
            ${d.expiresAt ? `
            <p style="color: #666; font-size: 14px;">This link expires on ${d.expiresAt.toLocaleDateString()} at ${d.expiresAt.toLocaleTimeString()}.</p>
            ` : ""}
            <p style="color: #888; font-size: 14px; margin-top: 16px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
        text: `Reset Your Password\n\n${d.userName ? `Hi ${d.userName},\n\n` : "Hello,\n\n"}We received a request to reset your password.\n\nReset your password: ${d.resetLink}\n\n${d.expiresAt ? `This link expires on ${d.expiresAt.toLocaleDateString()} at ${d.expiresAt.toLocaleTimeString()}.\n\n` : ""}If you didn't request this, you can safely ignore this email.`,
      };
    }

    case "welcome": {
      const d = data as { userName?: string; appName?: string; loginLink?: string };
      const appName = d.appName || "Bush";
      return {
        subject: `Welcome to ${appName}!`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Welcome to ${appName}!</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.userName ? `Hi ${d.userName},` : "Hello,"}
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thanks for joining ${appName}! You're all set up and ready to start managing your media assets.
            </p>
            ${d.loginLink ? `
            <p style="margin-bottom: 24px;">
              <a href="${d.loginLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Get Started</a>
            </p>
            ` : ""}
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Here's what you can do next:
            </p>
            <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8; margin-bottom: 24px;">
              <li>Upload your first files</li>
              <li>Create a project to organize your work</li>
              <li>Invite team members to collaborate</li>
            </ul>
            <p style="color: #888; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
              ${appName} - Modern Media Asset Management
            </p>
          </div>
        `,
        text: `Welcome to ${appName}!\n\n${d.userName ? `Hi ${d.userName},\n\n` : "Hello,\n\n"}Thanks for joining ${appName}! You're all set up and ready to start managing your media assets.\n\n${d.loginLink ? `Get started: ${d.loginLink}\n\n` : ""}Here's what you can do next:\n- Upload your first files\n- Create a project to organize your work\n- Invite team members to collaborate\n\n${appName} - Modern Media Asset Management`,
      };
    }

    case "comment-mention": {
      const d = data as {
        mentionerName: string;
        fileName: string;
        commentPreview: string;
        commentLink: string;
        projectName?: string;
      };
      return {
        subject: `${d.mentionerName} mentioned you in a comment`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">You were mentioned</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              <strong>${d.mentionerName}</strong> mentioned you in a comment on <strong>${d.fileName}</strong>${d.projectName ? ` in ${d.projectName}` : ""}.
            </p>
            <blockquote style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0; font-style: italic; color: #4a4a4a;">
              "${d.commentPreview.length > 200 ? d.commentPreview.slice(0, 200) + "..." : d.commentPreview}"
            </blockquote>
            <p style="margin-bottom: 24px;">
              <a href="${d.commentLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Comment</a>
            </p>
          </div>
        `,
        text: `You were mentioned\n\n${d.mentionerName} mentioned you in a comment on ${d.fileName}${d.projectName ? ` in ${d.projectName}` : ""}.\n\n"${d.commentPreview.length > 200 ? d.commentPreview.slice(0, 200) + "..." : d.commentPreview}"\n\nView comment: ${d.commentLink}`,
      };
    }

    case "comment-reply": {
      const d = data as {
        replyAuthorName: string;
        fileName: string;
        replyPreview: string;
        commentLink: string;
        projectName?: string;
      };
      return {
        subject: `${d.replyAuthorName} replied to your comment`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">New Reply</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              <strong>${d.replyAuthorName}</strong> replied to your comment on <strong>${d.fileName}</strong>${d.projectName ? ` in ${d.projectName}` : ""}.
            </p>
            <blockquote style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0; font-style: italic; color: #4a4a4a;">
              "${d.replyPreview.length > 200 ? d.replyPreview.slice(0, 200) + "..." : d.replyPreview}"
            </blockquote>
            <p style="margin-bottom: 24px;">
              <a href="${d.commentLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Reply</a>
            </p>
          </div>
        `,
        text: `New Reply\n\n${d.replyAuthorName} replied to your comment on ${d.fileName}${d.projectName ? ` in ${d.projectName}` : ""}.\n\n"${d.replyPreview.length > 200 ? d.replyPreview.slice(0, 200) + "..." : d.replyPreview}"\n\nView reply: ${d.commentLink}`,
      };
    }

    case "share-created": {
      const d = data as {
        creatorName: string;
        shareName: string;
        shareLink: string;
        assetCount: number;
        expiresAt?: Date;
      };
      return {
        subject: `${d.creatorName} shared "${d.shareName}" with you`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Content Shared With You</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              <strong>${d.creatorName}</strong> has shared <strong>"${d.shareName}"</strong> with you.
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.assetCount} ${d.assetCount === 1 ? "file" : "files"} included.
            </p>
            <p style="margin-bottom: 24px;">
              <a href="${d.shareLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Shared Content</a>
            </p>
            ${d.expiresAt ? `
            <p style="color: #666; font-size: 14px;">This share link expires on ${d.expiresAt.toLocaleDateString()}.</p>
            ` : ""}
          </div>
        `,
        text: `Content Shared With You\n\n${d.creatorName} has shared "${d.shareName}" with you.\n\n${d.assetCount} ${d.assetCount === 1 ? "file" : "files"} included.\n\nView shared content: ${d.shareLink}\n\n${d.expiresAt ? `This share link expires on ${d.expiresAt.toLocaleDateString()}.\n` : ""}`,
      };
    }

    case "notification-digest": {
      const d = data as { userName?: string; digestContent?: string; summary?: string };
      return {
        subject: "Your Bush Activity Digest",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Activity Digest</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.userName ? `Hi ${d.userName},` : "Hello,"}
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.summary || "Here's a summary of your recent activity on Bush."}
            </p>
            ${d.digestContent ? `<div style="margin-bottom: 24px;">${d.digestContent}</div>` : ""}
          </div>
        `,
        text: `Activity Digest\n\n${d.userName ? `Hi ${d.userName},\n\n` : "Hello,\n\n"}${d.summary || "Here's a summary of your recent activity on Bush."}\n\n${d.digestContent || ""}`,
      };
    }

    case "email-verification": {
      const d = data as { userName?: string; verificationLink: string; expiresAt?: Date };
      return {
        subject: "Verify Your Email Address",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Verify Your Email</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              ${d.userName ? `Hi ${d.userName},` : "Hello,"}
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Please verify your email address by clicking the button below.
            </p>
            <p style="margin-bottom: 24px;">
              <a href="${d.verificationLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
            </p>
            ${d.expiresAt ? `
            <p style="color: #666; font-size: 14px;">This link expires on ${d.expiresAt.toLocaleDateString()} at ${d.expiresAt.toLocaleTimeString()}.</p>
            ` : ""}
          </div>
        `,
        text: `Verify Your Email\n\n${d.userName ? `Hi ${d.userName},\n\n` : "Hello,\n\n"}Please verify your email address.\n\nVerify: ${d.verificationLink}\n\n${d.expiresAt ? `This link expires on ${d.expiresAt.toLocaleDateString()} at ${d.expiresAt.toLocaleTimeString()}.\n` : ""}`,
      };
    }

    case "file-processed": {
      const d = data as { fileName: string; status: string; fileLink?: string; projectName?: string };
      return {
        subject: `File Processing Complete: ${d.fileName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">File Processed</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              <strong>${d.fileName}</strong> has been processed successfully.
            </p>
            ${d.projectName ? `<p style="color: #666; font-size: 14px; margin-bottom: 16px;">Project: ${d.projectName}</p>` : ""}
            ${d.fileLink ? `
            <p style="margin-bottom: 24px;">
              <a href="${d.fileLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View File</a>
            </p>
            ` : ""}
          </div>
        `,
        text: `File Processed\n\n${d.fileName} has been processed successfully.\n${d.projectName ? `Project: ${d.projectName}\n` : ""}${d.fileLink ? `\nView file: ${d.fileLink}` : ""}`,
      };
    }

    case "export-complete": {
      const d = data as { exportType?: string; downloadLink?: string; expiresAt?: Date };
      return {
        subject: "Your Export is Ready",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Export Complete</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Your ${d.exportType || "export"} is ready for download.
            </p>
            ${d.downloadLink ? `
            <p style="margin-bottom: 24px;">
              <a href="${d.downloadLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Download Export</a>
            </p>
            ` : ""}
            ${d.expiresAt ? `
            <p style="color: #666; font-size: 14px;">Download link expires on ${d.expiresAt.toLocaleDateString()}.</p>
            ` : ""}
          </div>
        `,
        text: `Export Complete\n\nYour ${d.exportType || "export"} is ready for download.\n\n${d.downloadLink ? `Download: ${d.downloadLink}\n\n` : ""}${d.expiresAt ? `Download link expires on ${d.expiresAt.toLocaleDateString()}.\n` : ""}`,
      };
    }

    default:
      // Fallback for unknown templates
      return {
        subject: "Notification from Bush",
        html: `<p>You have a new notification.</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
        text: `You have a new notification.\n\n${JSON.stringify(data, null, 2)}`,
      };
  }
}

/**
 * SMTP email provider configuration
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * Get SMTP configuration from environment
 */
export function getSmtpConfig(): SmtpConfig {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    user: config.SMTP_USER || undefined,
    pass: config.SMTP_PASS || undefined,
    from: config.SMTP_FROM,
  };
}

/**
 * SMTP email provider
 *
 * Sends emails via SMTP. Works with any SMTP server including:
 * - Mailpit (development)
 * - SendGrid
 * - Amazon SES
 * - Postmark
 * - Any standard SMTP server
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter;
  private fromAddress: EmailAddress;

  constructor(smtpConfig?: SmtpConfig) {
    const cfg = smtpConfig || getSmtpConfig();

    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? {
        user: cfg.user,
        pass: cfg.pass,
      } : undefined,
      // Connection timeout settings
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    this.fromAddress = {
      email: cfg.from,
      name: config.NEXT_PUBLIC_APP_NAME,
    };
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: message.from ? formatAddress(message.from) : formatAddress(this.fromAddress),
        to: formatAddresses(message.to),
        subject: message.subject,
        html: message.html,
        text: message.text,
        cc: message.cc ? formatAddresses(message.cc) : undefined,
        bcc: message.bcc ? formatAddresses(message.bcc) : undefined,
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        attachments: convertAttachments(message.attachments),
        headers: message.headers,
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SMTP error",
      };
    }
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<SendResult> {
    try {
      // Render the template to HTML and text
      const rendered = renderTemplate(options.template, options.data);

      const mailOptions: nodemailer.SendMailOptions = {
        from: formatAddress(this.fromAddress),
        to: formatAddresses(options.to),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        cc: options.cc ? formatAddresses(options.cc) : undefined,
        bcc: options.bcc ? formatAddresses(options.bcc) : undefined,
        replyTo: options.replyTo ? formatAddress(options.replyTo) : undefined,
        attachments: convertAttachments(options.attachments),
        headers: options.headers,
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SMTP error",
      };
    }
  }

  /**
   * Close the transporter connection
   */
  async close(): Promise<void> {
    this.transporter.close();
  }
}

/**
 * Create an SMTP email provider instance
 */
export function createSmtpProvider(config?: SmtpConfig): SmtpEmailProvider {
  return new SmtpEmailProvider(config);
}
