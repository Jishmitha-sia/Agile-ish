import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

import { getAppConfig } from '../../config/config.module.js';

/**
 * Minimal SMTP-based mailer.
 *
 * Self-hosters bring their own SMTP relay. For hosted prod, point at any
 * transactional provider (Resend, Postmark, SES, Postal). We deliberately
 * avoid coupling to a single provider SDK — SMTP is the lowest-common
 * denominator and lets operators choose their own infra.
 *
 * Templates live next to feature modules (e.g. `auth/emails/`) and are
 * rendered via `MailerService.send({ to, subject, html, text })`. Rendering
 * (Handlebars / React Email) is the caller's concern — the mailer just
 * ships bytes.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const cfg = getAppConfig(config);
    this.from = cfg.smtp.from;
    this.transporter = createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      auth:
        cfg.smtp.user && cfg.smtp.password
          ? { user: cfg.smtp.user, pass: cfg.smtp.password }
          : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async send(message: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
        headers: message.headers,
      });
      this.logger.debug({ to: message.to, messageId: info.messageId }, 'Mail sent');
    } catch (err) {
      // We log + rethrow. Callers that fire-and-forget (notifications) should
      // wrap in a try/catch; transactional callers (signup confirmation) want
      // the error to propagate.
      this.logger.error({ err, to: message.to }, 'Mail send failed');
      throw err;
    }
  }
}
