/**
 * Bush Platform - Console Email Provider
 *
 * Development/hollow implementation that logs emails to console.
 * Used when no real email provider is configured.
 *
 * In production with EMAIL_PROVIDER=console, emails are logged but not sent.
 * This is useful for testing email flows without actually sending.
 */
import type {
  EmailProvider,
  EmailMessage,
  TemplateEmailOptions,
  SendResult,
} from "../email";

/**
 * Format an email address for display
 */
function formatAddress(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Format multiple email addresses
 */
function formatAddresses(
  addrs: { email: string; name?: string } | { email: string; name?: string }[]
): string {
  if (Array.isArray(addrs)) {
    return addrs.map(formatAddress).join(", ");
  }
  return formatAddress(addrs);
}

/**
 * Console email provider
 *
 * Logs email content to console in a readable format.
 * Does not actually send emails.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    const lines: string[] = [
      "━".repeat(60),
      "📧 EMAIL (via Console Provider)",
      "━".repeat(60),
      `From: ${formatAddress({ email: "noreply@bush.local" })}`,
    ];

    if (message.to) {
      lines.push(`To: ${formatAddresses(message.to)}`);
    }
    if (message.cc) {
      lines.push(`Cc: ${formatAddresses(message.cc)}`);
    }
    if (message.bcc) {
      lines.push(`Bcc: ${formatAddresses(message.bcc)}`);
    }
    if (message.replyTo) {
      lines.push(`Reply-To: ${formatAddress(message.replyTo)}`);
    }

    lines.push(`Subject: ${message.subject}`);
    lines.push("─".repeat(60));

    if (message.text) {
      lines.push("[TEXT VERSION]");
      lines.push(message.text);
      lines.push("─".repeat(60));
    }

    if (message.html) {
      lines.push("[HTML VERSION]");
      lines.push(message.html.substring(0, 500) + (message.html.length > 500 ? "..." : ""));
      lines.push("─".repeat(60));
    }

    if (message.attachments?.length) {
      lines.push(`Attachments: ${message.attachments.length}`);
      for (const att of message.attachments) {
        const size =
          typeof att.content === "string"
            ? att.content.length
            : att.content.byteLength;
        lines.push(`  - ${att.filename} (${size} bytes, ${att.contentType || "unknown"})`);
      }
      lines.push("─".repeat(60));
    }

    if (message.headers) {
      lines.push("Headers:");
      for (const [key, value] of Object.entries(message.headers)) {
        lines.push(`  ${key}: ${value}`);
      }
      lines.push("─".repeat(60));
    }

    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push("━".repeat(60));

    console.log("\n" + lines.join("\n") + "\n");

    return {
      success: true,
      messageId: `console-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<SendResult> {
    const lines: string[] = [
      "━".repeat(60),
      "📧 TEMPLATE EMAIL (via Console Provider)",
      "━".repeat(60),
    ];

    if (options.to) {
      lines.push(`To: ${formatAddresses(options.to)}`);
    }
    if (options.cc) {
      lines.push(`Cc: ${formatAddresses(options.cc)}`);
    }
    if (options.bcc) {
      lines.push(`Bcc: ${formatAddresses(options.bcc)}`);
    }

    lines.push(`Template: ${options.template}`);
    lines.push("─".repeat(60));
    lines.push("Template Data:");

    // Pretty-print the template data
    for (const [key, value] of Object.entries(options.data)) {
      if (value instanceof Date) {
        lines.push(`  ${key}: ${value.toISOString()}`);
      } else if (typeof value === "object") {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`  ${key}: ${value}`);
      }
    }

    if (options.attachments?.length) {
      lines.push("─".repeat(60));
      lines.push(`Attachments: ${options.attachments.length}`);
      for (const att of options.attachments) {
        const size =
          typeof att.content === "string"
            ? att.content.length
            : att.content.byteLength;
        lines.push(`  - ${att.filename} (${size} bytes, ${att.contentType || "unknown"})`);
      }
    }

    lines.push("─".repeat(60));
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    lines.push("━".repeat(60));

    console.log("\n" + lines.join("\n") + "\n");

    return {
      success: true,
      messageId: `console-template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }
}

/**
 * Create a console email provider instance
 */
export function createConsoleProvider(): ConsoleEmailProvider {
  return new ConsoleEmailProvider();
}
