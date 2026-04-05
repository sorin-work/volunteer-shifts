import nodemailer from 'nodemailer';
import type { Logger } from '../lib/logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Sends through any SMTP server; in docker compose that's Mailpit. */
export function createSmtpMailer(url: string, from: string): Mailer {
  const transport = nodemailer.createTransport(url);
  return {
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
}

/** Keeps messages in memory. Used by the tests and when no SMTP_URL is set. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage) {
    this.sent.push(message);
  }

  to(address: string) {
    return this.sent.filter((m) => m.to === address);
  }

  clear() {
    this.sent.length = 0;
  }
}

/** Email is best effort: a failed send is logged and never fails the request. */
export async function sendSafely(mailer: Mailer, logger: Logger, message: MailMessage) {
  try {
    await mailer.send(message);
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, 'failed to send email');
  }
}
