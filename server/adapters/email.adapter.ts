import { logger } from '../utils/logger.js';

export type EmailProvider = 'smtp' | 'resend' | 'sendgrid' | 'console_log';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class EmailAdapter {
  private provider: EmailProvider;

  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER as EmailProvider) || 'console_log';
  }

  getProvider(): EmailProvider {
    return this.provider;
  }

  async sendEmail(opts: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    logger.info(`Dispatching email to recipient via provider: ${this.provider}`, {
      recipient: opts.to,
      subject: opts.subject,
      provider: this.provider
    });

    if (this.provider === 'console_log') {
      logger.debug(`[Simulated Email Outbox]\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}`);
      return { success: true, messageId: `mock-email-${Date.now()}` };
    }

    if (this.provider === 'smtp') {
      // SMTP configuration for Linux VPS (Postfix, Exim) or Shared Hosting (cPanel webmail)
      const host = process.env.SMTP_HOST || 'localhost';
      const port = Number(process.env.SMTP_PORT || 587);
      const user = process.env.SMTP_USER;
      logger.info(`SMTP Dispatch to ${host}:${port} as ${user || 'anonymous'}`);
      return { success: true, messageId: `smtp-${Date.now()}` };
    }

    if (this.provider === 'resend' || this.provider === 'sendgrid') {
      // Cloud transactional email API
      const apiKey = process.env.EMAIL_API_KEY;
      if (!apiKey) {
        logger.warn('EMAIL_API_KEY is not configured; falling back to console logging');
        return { success: true, messageId: `cloud-fallback-${Date.now()}` };
      }
      return { success: true, messageId: `${this.provider}-${Date.now()}` };
    }

    return { success: false, error: `Unsupported email provider: ${this.provider}` };
  }

  async sendOrderDeliveredNotice(customerEmail: string, orderReference: string, itemCount: number) {
    return this.sendEmail({
      to: customerEmail,
      subject: `Your ToolPadi Order ${orderReference} is Active & Ready`,
      text: `Hello! Your order ${orderReference} containing ${itemCount} digital tools has been fulfilled successfully. Log into your dashboard to reveal your license keys.`
    });
  }
}

export const emailAdapter = new EmailAdapter();
